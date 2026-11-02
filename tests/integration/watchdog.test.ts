import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb, schema } from "@/lib/db";
import { runWatchdogChecks } from "@/lib/ops/watchdog";
import { getRedis } from "@/lib/redis";
import { placeWhatsAppOrder } from "../helpers/orders";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

async function notification(orderId: string, status: string, ageMinutes: number) {
  await getDb()
    .insert(schema.orderNotifications)
    .values({ orderId, channel: "email", destination: "mariana@example.com", status, createdAt: minutesAgo(ageMinutes) });
}

async function dispatch(order: { id: string; kitchenFacilityId: string }, status: string, ageMinutes: number) {
  await getDb()
    .insert(schema.kitchenDispatches)
    .values({ orderId: order.id, kitchenFacilityId: order.kitchenFacilityId, status, createdAt: minutesAgo(ageMinutes) });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runWatchdogChecks", () => {
  it("is quiet with no orders", async () => {
    expect(await runWatchdogChecks()).toEqual([]);
  });

  it("reports failed and stuck messages and tickets with their order numbers", async () => {
    const failed = await placeWhatsAppOrder();
    const stuck = await placeWhatsAppOrder();
    const fresh = await placeWhatsAppOrder();
    await notification(failed.id, "failed", 30);
    await notification(stuck.id, "pending", 20);
    await notification(fresh.id, "pending", 1);
    await dispatch(stuck, "pending", 10);
    await dispatch(fresh, "pending", 1);

    const alerts = await runWatchdogChecks();
    expect(alerts).toEqual([
      { check: "notify.failed", count: 1, orderNumbers: [failed.orderNumber] },
      { check: "notify.stuck", count: 1, orderNumbers: [stuck.orderNumber] },
      { check: "dispatch.stuck", count: 1, orderNumbers: [stuck.orderNumber] },
    ]);
  });

  it("forgets failures older than a day", async () => {
    const order = await placeWhatsAppOrder();
    await dispatch(order, "failed", 25 * 60);
    expect(await runWatchdogChecks()).toEqual([]);
  });

  it("reports paid orders the kitchen has not started", async () => {
    const late = await placeWhatsAppOrder();
    const recent = await placeWhatsAppOrder();
    await getDb()
      .update(schema.orders)
      .set({ status: "paid", paidAt: sql`now() - interval '2 hours'` })
      .where(eq(schema.orders.id, late.id));
    await getDb().update(schema.orders).set({ status: "paid", paidAt: sql`now()` }).where(eq(schema.orders.id, recent.id));

    expect(await runWatchdogChecks()).toEqual([
      { check: "orders.paid_not_started", count: 1, orderNumbers: [late.orderNumber] },
    ]);
  });

  it("reports Openpay amount mismatches from the last day only", async () => {
    const recent = await placeWhatsAppOrder();
    const old = await placeWhatsAppOrder();
    const mismatch = (orderId: string, ageMinutes: number) => ({
      orderId,
      openpayTransactionId: `tr-${orderId.slice(0, 8)}`,
      eventType: "charge.succeeded",
      rawPayload: {},
      outcome: "amount_mismatch",
      processedAt: minutesAgo(ageMinutes),
    });
    await getDb()
      .insert(schema.openpayWebhookEvents)
      .values([mismatch(recent.id, 5), mismatch(old.id, 25 * 60)]);

    expect(await runWatchdogChecks()).toEqual([
      { check: "openpay.amount_mismatch", count: 1, orderNumbers: [recent.orderNumber] },
    ]);
  });

  it("reports Redis above 90% of maxmemory, and stays quiet without a limit", async () => {
    // Stub INFO instead of CONFIG SET maxmemory, which would change the shared local Redis.
    const info = (used: number, max: number) =>
      vi.spyOn(getRedis(), "info").mockImplementation((async (section?: string) =>
        section === "memory" ? `# Memory\r\nused_memory:${used}\r\nmaxmemory:${max}\r\n` : "evicted_keys:0\r\n") as never);

    info(95, 100);
    expect(await runWatchdogChecks()).toEqual([{ check: "redis.memory_high", count: 1, percent: 95 }]);

    vi.restoreAllMocks();
    info(95, 0);
    expect(await runWatchdogChecks()).toEqual([]);
  });
});
