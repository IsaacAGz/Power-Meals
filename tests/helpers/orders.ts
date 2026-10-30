import { eq } from "drizzle-orm";
import { getPricedCart, type CartOwner } from "@/lib/cart";
import { getDb, schema } from "@/lib/db";
import { readCheckoutInput } from "@/lib/orders/checkout-input";
import { createWhatsAppOrder } from "@/lib/orders/create";
import { resolveFulfillment } from "@/lib/orders/fulfillment";
import { meal } from "../fixtures/catalog";
import { addToCart, createUser, pickupBody, signIn } from "./factory";

/** A placed WhatsApp order (ordered_whatsapp), built the way POST /api/orders/whatsapp builds one. */
export async function placeWhatsAppOrder(
  options: { punto?: string; email?: string; owner?: CartOwner & { userId: string } } = {},
) {
  const owner = options.owner ?? (await signIn((await createUser()).id));
  if ((await getPricedCart(owner)).length === 0) await addToCart(owner, meal(), 2);
  const input = readCheckoutInput(pickupBody({ punto: options.punto ?? "otay" }));
  const target = await resolveFulfillment(input);
  if (!target) throw new Error(`Pickup point ${input.punto} did not resolve`);
  const order = await createWhatsAppOrder({
    userId: owner.userId,
    customer: { name: input.nombre, email: options.email ?? "mariana@example.com", phone: input.telefono },
    ...target,
    notes: null,
    lines: await getPricedCart(owner),
  });
  return { ...order, owner, kitchenFacilityId: target.kitchenFacilityId };
}

export async function orderRow(orderId: string) {
  const [row] = await getDb().select().from(schema.orders).where(eq(schema.orders.id, orderId));
  return row;
}

export async function outboxFor(orderId: string) {
  const db = getDb();
  const [dispatches, notifications, payments, events] = await Promise.all([
    db.select().from(schema.kitchenDispatches).where(eq(schema.kitchenDispatches.orderId, orderId)),
    db.select().from(schema.orderNotifications).where(eq(schema.orderNotifications.orderId, orderId)),
    db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)),
    db.select().from(schema.orderStatusEvents).where(eq(schema.orderStatusEvents.orderId, orderId)),
  ]);
  return { dispatches, notifications, payments, events };
}
