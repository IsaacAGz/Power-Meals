import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, schema, type Database } from "@/lib/db";
import { isKitchenQueueConfigured, publishKitchenTicket } from "@/lib/sqs";
import { getKitchenTicket } from "./orders";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type DispatchResult = "sent" | "pending" | "failed" | "not_pending";

// The retry timer runs every minute, so this is roughly an hour of retries before staff must reprint by hand.
const MAX_ATTEMPTS = 60;

function log(fields: Record<string, unknown>) {
  console.info(JSON.stringify({ event: "kitchen.dispatch", ...fields }));
}

/**
 * Call inside the transaction that first moves an order to paid. Without a queue configured the row is
 * recorded as skipped, so configuring SQS later does not print a backlog of old orders.
 */
export async function queueKitchenTicket(tx: Tx, orderId: string, kitchenFacilityId: string) {
  const configured = isKitchenQueueConfigured();
  await tx
    .insert(schema.kitchenDispatches)
    .values({
      orderId,
      kitchenFacilityId,
      status: configured ? "pending" : "skipped",
      lastError: configured ? null : "SQS_QUEUE_URL is not set",
    })
    .onConflictDoNothing({ target: schema.kitchenDispatches.orderId });
}

/** Sends one pending ticket. The row lock means the after-response send and the retry timer never both send it. */
export async function sendKitchenTicket(orderId: string): Promise<DispatchResult> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ id: schema.kitchenDispatches.id, attempts: schema.kitchenDispatches.attempts })
      .from(schema.kitchenDispatches)
      .where(and(eq(schema.kitchenDispatches.orderId, orderId), eq(schema.kitchenDispatches.status, "pending")))
      .for("update", { skipLocked: true });
    if (!row) return "not_pending";

    const attempts = row.attempts + 1;
    try {
      const ticket = await getKitchenTicket(orderId);
      if (!ticket) throw new Error("Order not found");
      const messageId = await publishKitchenTicket(ticket);
      await tx
        .update(schema.kitchenDispatches)
        .set({ status: "sent", attempts, sqsMessageId: messageId, sentAt: sql`now()`, lastError: null })
        .where(eq(schema.kitchenDispatches.id, row.id));
      log({ orderId, outcome: "sent", messageId, attempts });
      return "sent";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
      await tx
        .update(schema.kitchenDispatches)
        .set({ status, attempts, lastError: message.slice(0, 500) })
        .where(eq(schema.kitchenDispatches.id, row.id));
      console.error(JSON.stringify({ event: "kitchen.dispatch", orderId, outcome: status, attempts, message }));
      return status;
    }
  });
}

/** Retries tickets whose first send failed (SQS outage, app restart before the send ran). */
export async function sendPendingKitchenTickets(limit = 50) {
  const rows = await getDb()
    .select({ orderId: schema.kitchenDispatches.orderId })
    .from(schema.kitchenDispatches)
    .where(eq(schema.kitchenDispatches.status, "pending"))
    .orderBy(asc(schema.kitchenDispatches.createdAt))
    .limit(limit);

  const results: Record<DispatchResult, number> = { sent: 0, pending: 0, failed: 0, not_pending: 0 };
  for (const row of rows) results[await sendKitchenTicket(row.orderId)] += 1;
  return results;
}
