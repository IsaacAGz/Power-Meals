import "server-only";
import { eq, sql } from "drizzle-orm";
import { clearGuestCart, clearUserCart } from "@/lib/cart";
import { getDb, schema, type Database } from "@/lib/db";
import type { Charge } from "@/lib/openpay";
import { getRedis } from "@/lib/redis";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type WebhookEvent = { eventType: string; transactionId: string; payload: unknown };

export type PaymentOutcome = "paid" | "failed" | "duplicate" | "ignored" | "unknown_order" | "amount_mismatch";

const PAID_STATUSES = new Set(["paid", "confirmed", "preparing", "ready", "completed"]);
const CHECKOUT_CART_TTL_SECONDS = 60 * 60 * 48;
const checkoutCartKey = (ref: string) => `checkout:cart:${ref}`;

/** The guest cart lives under a session id the webhook never sees, so checkout records which one to clear. */
export async function rememberCheckoutCart(ref: string, sessionId: string) {
  await getRedis().set(checkoutCartKey(ref), sessionId, "EX", CHECKOUT_CART_TTL_SECONDS);
}

/** Row lock: concurrent deliveries for the same order run one after another, so the status gate below is strict. */
async function lockOrder(tx: Tx, ref: string | null) {
  if (!ref) return undefined;
  const [order] = await tx
    .select({
      id: schema.orders.id,
      status: schema.orders.status,
      totalCents: schema.orders.totalCents,
      userId: schema.orders.userId,
    })
    .from(schema.orders)
    .where(eq(schema.orders.publicOrderRef, ref))
    .for("update");
  return order;
}

async function logEvent(tx: Tx, event: WebhookEvent, orderId: string | null, outcome: PaymentOutcome) {
  await tx.insert(schema.openpayWebhookEvents).values({
    openpayTransactionId: event.transactionId,
    orderId,
    eventType: event.eventType,
    rawPayload: event.payload,
    isDuplicate: outcome === "duplicate",
    outcome,
  });
  return outcome;
}

/**
 * First success moves the order to paid, records the charge, and clears the cart. Any later success for an
 * order that is already paid is logged as a duplicate with no side effects (no status change, no dispatch).
 */
export async function recordChargeSucceeded(charge: Charge, event: WebhookEvent): Promise<PaymentOutcome> {
  const outcome = await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, charge.orderId);
    if (!order) return logEvent(tx, event, null, "unknown_order");
    if (PAID_STATUSES.has(order.status)) return logEvent(tx, event, order.id, "duplicate");
    if (Math.round(charge.amount * 100) !== order.totalCents || charge.currency.toUpperCase() !== "MXN") {
      return logEvent(tx, event, order.id, "amount_mismatch");
    }

    await tx
      .update(schema.orders)
      .set({ status: "paid", paidAt: sql`now()` })
      .where(eq(schema.orders.id, order.id));
    await tx.insert(schema.orderStatusEvents).values({ orderId: order.id, fromStatus: order.status, toStatus: "paid" });
    await tx
      .update(schema.payments)
      .set({ status: "succeeded", openpayChargeId: charge.id })
      .where(eq(schema.payments.orderId, order.id));
    if (order.userId) await clearUserCart(tx, order.userId);
    return logEvent(tx, event, order.id, "paid");
  });

  if (outcome === "paid" && charge.orderId) {
    const redis = getRedis();
    const sessionId = await redis.get(checkoutCartKey(charge.orderId));
    if (sessionId) await Promise.all([clearGuestCart(sessionId), redis.del(checkoutCartKey(charge.orderId))]);
  }
  return outcome;
}

/** A failed or cancelled charge closes a still-pending order; the customer's cart is left intact to retry. */
export async function recordChargeFailed(charge: Charge, event: WebhookEvent): Promise<PaymentOutcome> {
  return getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, charge.orderId);
    if (!order) return logEvent(tx, event, null, "unknown_order");
    if (order.status === "cancelled") return logEvent(tx, event, order.id, "duplicate");
    if (order.status !== "pending_payment") return logEvent(tx, event, order.id, "ignored");

    await tx.update(schema.orders).set({ status: "cancelled" }).where(eq(schema.orders.id, order.id));
    await tx.insert(schema.orderStatusEvents).values({ orderId: order.id, fromStatus: order.status, toStatus: "cancelled" });
    await tx
      .update(schema.payments)
      .set({ status: "failed", openpayChargeId: charge.id })
      .where(eq(schema.payments.orderId, order.id));
    return logEvent(tx, event, order.id, "failed");
  });
}

export async function recordOtherEvent(charge: Charge | null, event: WebhookEvent): Promise<PaymentOutcome> {
  return getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, charge?.orderId ?? null);
    return logEvent(tx, event, order?.id ?? null, order || !charge ? "ignored" : "unknown_order");
  });
}
