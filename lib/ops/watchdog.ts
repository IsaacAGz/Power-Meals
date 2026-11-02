import "server-only";
import { getPool } from "@/lib/db";
import { getRedis } from "@/lib/redis";

export type WatchdogAlert = { check: string; count: number; orderNumbers?: number[]; percent?: number };

// Failed rows are never deleted, so failures only alert for a day; after that the incident is assumed handled.
const FAILED_LOOKBACK = "24 hours";
const MAX_LISTED_ORDERS = 10;

function minutes(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

type Row = { count: number; order_numbers: number[] | null };

async function countOrders(query: string, params: unknown[] = []): Promise<Row> {
  const { rows } = await getPool().query<Row>(
    `select count(*)::int as count,
            (array_agg(o.order_number order by o.order_number))[1:${MAX_LISTED_ORDERS}] as order_numbers
       from (${query}) matched
       join orders o on o.id = matched.order_id`,
    params,
  );
  return rows[0] ?? { count: 0, order_numbers: null };
}

/**
 * Problems that do not throw anywhere: messages and kitchen tickets that gave up or never went out, paid orders
 * the kitchen has not started, and card payments whose amount did not match. Run by scripts/watchdog.ts.
 */
export async function runWatchdogChecks(): Promise<WatchdogAlert[]> {
  const notifyStale = minutes("WATCHDOG_NOTIFY_STALE_MINUTES", 15);
  const dispatchStale = minutes("WATCHDOG_DISPATCH_STALE_MINUTES", 5);
  const paidStale = minutes("WATCHDOG_PAID_STALE_MINUTES", 60);

  const checks: Record<string, Promise<Row>> = {
    "notify.failed": countOrders(
      `select order_id from order_notifications where status = 'failed' and created_at > now() - interval '${FAILED_LOOKBACK}'`,
    ),
    "notify.stuck": countOrders(
      `select order_id from order_notifications where status = 'pending' and created_at < now() - make_interval(mins => $1)`,
      [notifyStale],
    ),
    "dispatch.failed": countOrders(
      `select order_id from kitchen_dispatches where status = 'failed' and created_at > now() - interval '${FAILED_LOOKBACK}'`,
    ),
    "dispatch.stuck": countOrders(
      `select order_id from kitchen_dispatches where status = 'pending' and created_at < now() - make_interval(mins => $1)`,
      [dispatchStale],
    ),
    "orders.paid_not_started": countOrders(
      `select id as order_id from orders where status = 'paid' and paid_at < now() - make_interval(mins => $1)`,
      [paidStale],
    ),
    "openpay.amount_mismatch": countOrders(
      `select order_id from openpay_webhook_events
        where outcome = 'amount_mismatch' and order_id is not null and processed_at > now() - interval '${FAILED_LOOKBACK}'`,
    ),
  };

  const alerts: WatchdogAlert[] = [];
  for (const [check, pending] of Object.entries(checks)) {
    const row = await pending;
    if (row.count > 0) alerts.push({ check, count: row.count, orderNumbers: row.order_numbers ?? [] });
  }

  const redis = await redisMemory();
  if (redis.maxBytes > 0 && redis.usedBytes / redis.maxBytes > 0.9) {
    alerts.push({ check: "redis.memory_high", count: 1, percent: Math.round((redis.usedBytes / redis.maxBytes) * 100) });
  }
  return alerts;
}

/** Sessions and guest carts live in Redis; near maxmemory it starts evicting them and people get signed out. */
export async function redisMemory(): Promise<{ usedBytes: number; maxBytes: number; evictedKeys: number }> {
  const [memory, stats] = await Promise.all([getRedis().info("memory"), getRedis().info("stats")]);
  const field = (info: string, name: string) => Number(info.match(new RegExp(`^${name}:(\\d+)`, "m"))?.[1] ?? 0);
  return {
    usedBytes: field(memory, "used_memory"),
    maxBytes: field(memory, "maxmemory"),
    evictedKeys: field(stats, "evicted_keys"),
  };
}
