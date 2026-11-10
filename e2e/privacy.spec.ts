import { expect, test } from "@playwright/test";

test("the aviso de privacidad is linked from the footer, registration and checkout", async ({ page }) => {
  await page.goto("/registro");
  await expect(page.getByRole("link", { name: "Aviso de privacidad" })).toHaveCount(2); // the form and the footer

  await page.goto("/pedido");
  await expect(page.getByRole("main").getByRole("link", { name: "Aviso de privacidad" })).toBeVisible();

  await page.getByRole("contentinfo").getByRole("link", { name: "Aviso de privacidad" }).click();
  await expect(page).toHaveURL(/\/aviso-de-privacidad$/);
  await expect(page.getByRole("heading", { level: 1, name: "Aviso de privacidad" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /derechos ARCO/ })).toBeVisible();
  await page.screenshot({ path: `${process.env.SHOT_DIR ?? "test-results"}/aviso-${test.info().project.name}.png`, fullPage: true });
});
