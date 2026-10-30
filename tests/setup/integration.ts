import { sql } from "drizzle-orm";
import { afterAll, beforeEach, vi } from "vitest";
import { cookieJar, cookieStore } from "../helpers/cookies";
import { emailFailures, sentEmails } from "../helpers/outbox";
import { applyTestEnv } from "./test-env";

applyTestEnv();

// Route Handlers read the session cookie through next/headers; outside Next there is no request scope.
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore(),
  headers: async () => new Headers(),
}));

// SES: record instead of sending. Set emailFailures.next to make the next N sends throw.
vi.mock("@/lib/email", () => ({
  isOrderEmailConfigured: () => Boolean(process.env.ORDER_EMAIL_FROM?.trim()),
  sendOrderEmail: async (input: { to: string; subject: string; text: string }) => {
    if (emailFailures.next > 0) {
      emailFailures.next -= 1;
      throw new Error("SES is down");
    }
    sentEmails.push(input);
  },
}));

// Turnstile: the token "pass" is a solved challenge; anything else fails.
vi.mock("@/lib/auth/turnstile", () => ({
  verifyTurnstile: async (token: string) => token === "pass",
}));

const { getDb, getPool } = await import("@/lib/db");
const { getRedis } = await import("@/lib/redis");

// Catalog, kitchens, pickup points, and zones are seeded once and kept.
const PER_TEST_TABLES = [
  "order_notifications",
  "kitchen_dispatches",
  "openpay_webhook_events",
  "payments",
  "order_status_events",
  "order_line_items",
  "orders",
  "cart_line_items",
  "users",
];

beforeEach(async () => {
  await getDb().execute(sql.raw(`TRUNCATE ${PER_TEST_TABLES.join(", ")} RESTART IDENTITY CASCADE`));
  await getRedis().flushdb();
  cookieJar.clear();
  sentEmails.length = 0;
  emailFailures.next = 0;
});

afterAll(async () => {
  await getPool().end();
  getRedis().disconnect();
  const globals = globalThis as { pgPool?: unknown; db?: unknown; redis?: unknown };
  delete globals.pgPool;
  delete globals.db;
  delete globals.redis;
});
