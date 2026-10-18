import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { isOrderEmailConfigured, sendOrderEmail } from "@/lib/email";
import { hashPassword } from "@/lib/auth/password";
import { getDb, schema } from "@/lib/db";
import { getRedis } from "@/lib/redis";

const TTL_SECONDS = 60 * 60;

const tokenKey = (token: string) => `reset:password:${token}`;
const userKey = (userId: string) => `reset:password:user:${userId}`;

function resetUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base}/recuperar/nueva?token=${encodeURIComponent(token)}`;
}

/** Replaces any previous reset link for this user. Single-use, one hour. */
export async function issuePasswordReset(userId: string): Promise<string> {
  const redis = getRedis();
  const previous = await redis.get(userKey(userId));
  if (previous) await redis.del(tokenKey(previous));
  const token = randomBytes(32).toString("base64url");
  await redis.set(tokenKey(token), userId, "EX", TTL_SECONDS);
  await redis.set(userKey(userId), token, "EX", TTL_SECONDS);
  return token;
}

async function clearPasswordReset(userId: string, token: string): Promise<void> {
  await getRedis().del(tokenKey(token), userKey(userId));
}

export async function consumePasswordReset(token: string): Promise<string | null> {
  if (!token || token.length > 128) return null;
  const redis = getRedis();
  const userId = await redis.getdel(tokenKey(token));
  if (!userId) return null;
  await redis.del(userKey(userId));
  return userId;
}

/** Sends one reset email. A failed send removes the link so it cannot be used. */
export async function sendPasswordReset(userId: string, email: string): Promise<void> {
  if (!isOrderEmailConfigured()) return;
  const token = await issuePasswordReset(userId);
  try {
    await sendOrderEmail({
      to: email,
      subject: "Restablece tu contraseña — Power Meals",
      text: [
        "Restablece tu contraseña de Power Meals.",
        "",
        resetUrl(token),
        "",
        "El enlace vence en 1 hora. Si no pediste este cambio, ignora este mensaje.",
      ].join("\n"),
    });
  } catch {
    await clearPasswordReset(userId, token);
  }
}

export async function setPassword(userId: string, password: string): Promise<boolean> {
  const [user] = await getDb()
    .update(schema.users)
    .set({ passwordHash: await hashPassword(password), emailVerifiedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning({ id: schema.users.id });
  return Boolean(user);
}
