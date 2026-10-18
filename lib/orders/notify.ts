import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, schema, type Database } from "@/lib/db";
import { isOrderEmailConfigured, sendOrderEmail } from "@/lib/email";
import { receiptPath } from "@/lib/orders/ref";
import { isWhatsAppConfigured, sendWhatsAppTemplate, whatsAppRecipient } from "@/lib/whatsapp-cloud";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type NotifyResult = "sent" | "pending" | "failed" | "not_pending";

// The retry timer runs every minute, so this is roughly an hour of retries before the row is failed.
const MAX_ATTEMPTS = 60;

function log(fields: Record<string, unknown>) {
  console.info(JSON.stringify({ event: "order.notify", ...fields }));
}

function receiptUrl(ref: string): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${origin}${receiptPath(ref)}`;
}

export function paidReceiptMessage(orderNumber: number, url: string): { subject: string; text: string } {
  return {
    subject: `Pedido #${orderNumber} pagado`,
    text: `Tu pedido #${orderNumber} está pagado.\n\nSigue el estado de tu pedido aquí:\n${url}\n\nPower Meals\n`,
  };
}

function skipReason(channel: "email" | "whatsapp"): string | null {
  if (channel === "email" && !isOrderEmailConfigured()) return "ORDER_EMAIL_FROM is not set";
  if (channel === "whatsapp" && !isWhatsAppConfigured()) return "WhatsApp is not configured";
  return null;
}

/**
 * Call inside the transaction that first moves an order to paid. One row per order.
 * Email is used when the order has an address; otherwise WhatsApp. A channel that is not configured
 * is stored as skipped, so turning it on later does not message old orders.
 */
export async function queueOrderNotification(tx: Tx, orderId: string) {
  const [order] = await tx
    .select({ email: schema.orders.customerEmail, phone: schema.orders.customerPhone })
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  if (!order) return;

  const email = order.email.trim();
  const channel = email ? "email" : "whatsapp";
  const destination = email || order.phone.trim();
  const reason = skipReason(channel);
  await tx
    .insert(schema.orderNotifications)
    .values({
      orderId,
      channel,
      destination,
      status: reason ? "skipped" : "pending",
      lastError: reason,
    })
    .onConflictDoNothing({ target: schema.orderNotifications.orderId });
}

/** Sends one pending email or WhatsApp message. The row lock means the after-response send and the retry timer never both send it. */
export async function sendOrderNotification(orderId: string): Promise<NotifyResult> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: schema.orderNotifications.id,
        channel: schema.orderNotifications.channel,
        attempts: schema.orderNotifications.attempts,
        destination: schema.orderNotifications.destination,
        orderNumber: schema.orders.orderNumber,
        publicOrderRef: schema.orders.publicOrderRef,
        customerName: schema.orders.customerName,
      })
      .from(schema.orderNotifications)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderNotifications.orderId))
      .where(and(eq(schema.orderNotifications.orderId, orderId), eq(schema.orderNotifications.status, "pending")))
      .for("update", { skipLocked: true });
    if (!row) return "not_pending";

    const attempts = row.attempts + 1;
    const url = receiptUrl(row.publicOrderRef);
    try {
      if (row.channel === "whatsapp") {
        const firstName = row.customerName.trim().split(/\s+/)[0] || row.customerName;
        await sendWhatsAppTemplate({
          to: whatsAppRecipient(row.destination),
          firstName,
          orderNumber: String(row.orderNumber),
          receiptUrl: url,
        });
      } else {
        const message = paidReceiptMessage(row.orderNumber, url);
        await sendOrderEmail({ to: row.destination, subject: message.subject, text: message.text });
      }
      await tx
        .update(schema.orderNotifications)
        .set({ status: "sent", attempts, sentAt: sql`now()`, lastError: null })
        .where(eq(schema.orderNotifications.id, row.id));
      log({ orderId, outcome: "sent", attempts });
      return "sent";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const status = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
      await tx
        .update(schema.orderNotifications)
        .set({ status, attempts, lastError: reason.slice(0, 500) })
        .where(eq(schema.orderNotifications.id, row.id));
      console.error(JSON.stringify({ event: "order.notify", orderId, outcome: status, attempts, message: reason }));
      return status;
    }
  });
}

/** Retries messages whose first send failed. Skipped rows stay skipped. */
export async function sendPendingOrderNotifications(limit = 50) {
  const rows = await getDb()
    .select({ orderId: schema.orderNotifications.orderId })
    .from(schema.orderNotifications)
    .where(eq(schema.orderNotifications.status, "pending"))
    .orderBy(asc(schema.orderNotifications.createdAt))
    .limit(limit);

  const results: Record<NotifyResult, number> = { sent: 0, pending: 0, failed: 0, not_pending: 0 };
  for (const row of rows) results[await sendOrderNotification(row.orderId)] += 1;
  return results;
}
