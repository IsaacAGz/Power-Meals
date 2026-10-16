import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getRedis } from "@/lib/redis";

const LINK_TOKEN_TTL_SECONDS = 60 * 60 * 24;
const linkKey = (ref: string) => `link:order:${ref}`;

/** Issued when the paid receipt renders; reused until it expires or the order is linked. */
export async function issueLinkToken(ref: string): Promise<string> {
  const redis = getRedis();
  await redis.set(linkKey(ref), randomBytes(24).toString("base64url"), "EX", LINK_TOKEN_TTL_SECONDS, "NX");
  return (await redis.get(linkKey(ref))) ?? "";
}

export async function checkLinkToken(ref: string, token: string): Promise<boolean> {
  const stored = await getRedis().get(linkKey(ref));
  if (!stored || stored.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(stored), Buffer.from(token));
}

/**
 * Attaches a paid guest order to the signed-in user. The account email must match the email given at
 * checkout, so holding someone's order link isn't enough to claim their order.
 */
export async function attachOrderToUser(ref: string, user: { id: string; email: string }): Promise<boolean> {
  const updated = await getDb()
    .update(schema.orders)
    .set({ userId: user.id })
    .where(
      and(
        eq(schema.orders.publicOrderRef, ref),
        isNull(schema.orders.userId),
        sql`lower(${schema.orders.customerEmail}) = ${user.email.toLowerCase()}`,
        inArray(schema.orders.status, ["paid", "confirmed", "preparing", "ready", "completed"]),
      ),
    )
    .returning({ id: schema.orders.id });
  if (updated.length > 0) await getRedis().del(linkKey(ref));
  return updated.length > 0;
}
