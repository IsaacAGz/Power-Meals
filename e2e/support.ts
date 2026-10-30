import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

export const CUSTOMER = { email: "cliente.e2e@example.com", password: "contraseña-e2e-1", name: "Mariana López" };
export const STAFF = { email: "cocina.otay.e2e@powermeals.test", password: "contraseña-e2e-2", name: "Cocina Otay" };

let pool: Pool | undefined;

/** The same test database the server is using, for setup and for reading back what the app wrote. */
export function db() {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return pool;
}

export async function latestOrder(email: string) {
  const { rows } = await db().query<{ id: string; public_order_ref: string; status: string; order_number: number }>(
    `select o.id, o.public_order_ref, o.status, o.order_number
       from orders o join users u on u.id = o.user_id
      where u.email = $1 order by o.created_at desc limit 1`,
    [email],
  );
  return rows[0];
}

export async function signIn(page: Page, user: { email: string; password: string }, next = "/cuenta") {
  await page.goto(`/ingresar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL((url) => url.pathname === next);
}

/** Builds and confirms one plate in the open row of the Arma tu platillo builder. */
export async function confirmPlate(page: Page, plate: { base: string; protein: string; price: string }) {
  await page.getByLabel("Base").selectOption({ label: plate.base });
  await page.getByLabel("Proteína").selectOption({ label: plate.protein });
  const confirm = page.getByRole("button", { name: `Confirmar · ${plate.price}` });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByRole("button", { name: /^Confirmar$/ })).toBeDisabled();
}

/** WhatsApp opens in a new tab; keep it from leaving for wa.me and return the message it would send. */
export async function submitWhatsApp(page: Page): Promise<string> {
  await page.context().route("https://wa.me/**", (route) => route.fulfill({ status: 200, body: "wa.me" }));
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Enviar pedido por WhatsApp" }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/wa\.me/);
  const text = new URL(popup.url()).searchParams.get("text") ?? "";
  await popup.close();
  return text;
}
