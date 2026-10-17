import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema, type Database } from "@/lib/db";
import { KITCHEN_STATUSES, nextKitchenStep, type KitchenStatus } from "./types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type TransitionResult = { ok: true; status: KitchenStatus } | { ok: false; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isKitchenStatus(value: string): value is KitchenStatus {
  return (KITCHEN_STATUSES as readonly string[]).includes(value);
}

/**
 * Moves one order a single step, and only if it belongs to this kitchen and is still in `fromStatus`.
 * ordered_whatsapp → paid is the transfer confirmation. Phase 3 publishes to the kitchen queue from that
 * commit; this function only records the transition.
 */
export async function advanceKitchenOrderStatus(
  facilityId: string,
  staffUserId: string,
  orderId: string,
  fromStatus: KitchenStatus,
): Promise<TransitionResult> {
  const step = nextKitchenStep[fromStatus];
  if (!step || !UUID_PATTERN.test(orderId)) return { ok: false, message: "Ese cambio no está permitido." };

  const outcome = await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order || order.kitchenFacilityId !== facilityId) {
      return { ok: false as const, message: "Este pedido no está en tu cocina." };
    }
    if (!isKitchenStatus(order.status)) return { ok: false as const, message: "Ese cambio no está permitido." };
    if (order.status === step.to) return { ok: true as const, status: order.status, becamePaid: false };
    if (order.status !== fromStatus) return { ok: false as const, message: "Este pedido ya cambió. Actualiza la lista." };

    const to = step.to;
    await tx
      .update(schema.orders)
      .set(to === "paid" ? { status: to, paidAt: sql`now()` } : { status: to })
      .where(eq(schema.orders.id, order.id));
    await tx.insert(schema.orderStatusEvents).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: to,
      changedByUserId: staffUserId,
    });
    if (to === "paid") {
      await tx
        .update(schema.payments)
        .set({ status: "succeeded" })
        .where(and(eq(schema.payments.orderId, order.id), eq(schema.payments.status, "pending")));
    }
    return { ok: true as const, status: to, becamePaid: to === "paid" };
  });

  if (outcome.ok && outcome.becamePaid) {
    console.info(JSON.stringify({ event: "kitchen.order_paid", orderId, facilityId }));
  }
  return outcome.ok ? { ok: true, status: outcome.status } : outcome;
}

async function lockOrder(tx: Tx, orderId: string) {
  const [order] = await tx
    .select({
      id: schema.orders.id,
      status: schema.orders.status,
      kitchenFacilityId: schema.orders.kitchenFacilityId,
    })
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .for("update");
  return order;
}
