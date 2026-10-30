import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { changeCartLine, ensureCartOwner, type CartOwner } from "@/lib/cart";
import type { CartItem } from "@/lib/catalog/types";
import { getDb, schema } from "@/lib/db";
import { rotateSession } from "@/lib/session";

export const PASSWORD = "contraseña-segura";

let counter = 0;

export async function facilityId(slug: string): Promise<string> {
  const [row] = await getDb()
    .select({ id: schema.kitchenFacilities.id })
    .from(schema.kitchenFacilities)
    .where(eq(schema.kitchenFacilities.slug, slug));
  if (!row) throw new Error(`No kitchen ${slug}`);
  return row.id;
}

export async function createUser(
  options: { email?: string; name?: string; verified?: boolean; staffAt?: string; password?: string } = {},
) {
  counter += 1;
  const email = options.email ?? `cliente${counter}@example.com`;
  const [user] = await getDb()
    .insert(schema.users)
    .values({
      email,
      name: options.name ?? "Mariana López",
      phone: "664 123 4567",
      passwordHash: await hashPassword(options.password ?? PASSWORD),
      emailVerifiedAt: options.verified === false ? null : new Date(),
      role: options.staffAt ? "kitchen_staff" : "customer",
      kitchenFacilityId: options.staffAt ? await facilityId(options.staffAt) : null,
    })
    .returning();
  return user;
}

/** Signs this test's cookie jar in as the user, as login would. */
export async function signIn(userId: string): Promise<CartOwner & { userId: string }> {
  const session = await rotateSession({ userId });
  return { sessionId: session.id, userId };
}

/** A guest session in this test's cookie jar. */
export const guest = () => ensureCartOwner();

export async function addToCart(owner: CartOwner, item: CartItem, quantity = 1) {
  await changeCartLine(owner, item, quantity, "add");
}

export const pickupBody = (overrides: Record<string, unknown> = {}) => ({
  nombre: "Mariana López",
  telefono: "664 123 4567",
  correo: "",
  metodo: "recoleccion",
  punto: "otay",
  notas: "",
  ...overrides,
});

const ORIGIN = "http://localhost:3000";

/** A same-origin JSON request, as the browser sends it. */
export function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000", "x-real-ip": "10.0.0.1", ...headers },
    body: JSON.stringify(body),
  });
}

export async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
