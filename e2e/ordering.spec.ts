import { expect, test } from "@playwright/test";
import { confirmPlate, CUSTOMER, db, latestOrder, signIn, STAFF, submitWhatsApp } from "./support";

async function fillPickup(page: import("@playwright/test").Page) {
  await page.getByLabel("Nombre").fill(CUSTOMER.name);
  await page.getByLabel("Teléfono", { exact: true }).fill("664 123 4567");
  await page.getByLabel("Punto de recolección").selectOption({ label: "Otay" });
}

test("a guest builds plates and sends a written order to WhatsApp without creating one", async ({ page }) => {
  await page.goto("/pedido");
  await confirmPlate(page, { base: "Arroz", protein: "Pollo", price: "$139" });
  await confirmPlate(page, { base: "Camote", protein: "Salmón", price: "$214" });
  await expect(page.getByText("Pollo + arroz + veggies · Regular").first()).toBeVisible();
  await expect(page.getByText("Salmón + camote + veggies · Regular").first()).toBeVisible();

  await expect(page.getByRole("radio", { name: "Entrega a domicilio" })).toBeDisabled();
  await fillPickup(page);
  const message = await submitWhatsApp(page);

  expect(message).toContain("Método: Recolección");
  expect(message).toContain("Punto: Otay");
  expect(message).toContain("Pollo + arroz + veggies · Regular");
  expect(message).toContain("Total estimado: $353 MXN");
  const { rows } = await db().query("select count(*)::int as n from orders");
  expect(rows[0].n).toBe(0);
});

test("a suggested plate fills the open row without adding it", async ({ page }) => {
  await page.goto("/pedido");
  await page.getByRole("button", { name: /Pollo \+ camote \+ veggies/ }).click();
  await expect(page.getByLabel("Base")).toHaveValue("camote");
  await expect(page.getByLabel("Proteína")).toHaveValue("pollo");
  await expect(page.getByRole("button", { name: /Quitar/ })).toHaveCount(0);
});

test("the kitchen board sends anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/kitchen/dashboard");
  await expect(page).toHaveURL(/\/ingresar\?next=%2Fkitchen%2Fdashboard/);
});

test("a signed-in WhatsApp order is confirmed paid by the Otay kitchen and the receipt follows", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One full lifecycle is enough; it writes shared rows.");

  await signIn(page, CUSTOMER, "/pedido");
  await confirmPlate(page, { base: "Arroz", protein: "Asada", price: "$164" });
  await fillPickup(page);
  await submitWhatsApp(page);

  await expect.poll(async () => (await latestOrder(CUSTOMER.email))?.status).toBe("ordered_whatsapp");
  const order = await latestOrder(CUSTOMER.email);

  await page.goto(`/pedido/success?order_ref=${order.public_order_ref}`);
  await expect(page.getByText(`#${order.order_number}`)).toBeVisible();
  await expect(page.getByText("El pago por transferencia sigue pendiente.", { exact: false })).toBeVisible();

  const kitchen = await browser.newPage();
  await signIn(kitchen, STAFF, "/kitchen/dashboard");
  await expect(kitchen.getByText("Cocina Otay")).toBeVisible();
  await expect(kitchen.getByText(`#${order.order_number}`)).toBeVisible();
  await kitchen.getByRole("button", { name: "Confirmar transferencia" }).click();
  await expect.poll(async () => (await latestOrder(CUSTOMER.email))?.status).toBe("paid");
  await kitchen.close();

  await page.reload();
  await expect(page.getByText("Tu pago está confirmado.", { exact: false })).toBeVisible();

  // With SES and SQS unset in this server, the outbox rows exist and are skipped, not sent.
  const { rows } = await db().query(
    `select (select status from kitchen_dispatches where order_id = $1) as ticket,
            (select status from order_notifications where order_id = $1) as message`,
    [order.id],
  );
  expect(rows[0]).toEqual({ ticket: "skipped", message: "skipped" });
});

test.afterAll(async () => {
  await db().end();
});
