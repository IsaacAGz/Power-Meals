import "server-only";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { isOrderEmailConfigured, sendOrderEmail } from "@/lib/email";
import { getDb, schema } from "@/lib/db";
import { getRedis } from "@/lib/redis";

const TTL_SECONDS = 60 * 60 * 24;

const tokenKey = (token: string) => `verify:email:${token}`;
const userKey = (userId: string) => `verify:email:user:${userId}`;

export function verificationUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base}/verificar?token=${encodeURIComponent(token)}`;
}

/** Replaces any previous link for this user. The token is single-use and lasts 24 hours. */
export async function issueEmailVerification(userId: string): Promise<string> {
  const redis = getRedis();
  const previous = await redis.get(userKey(userId));
  if (previous) await redis.del(tokenKey(previous));
  const token = randomBytes(32).toString("base64url");
  await redis.set(tokenKey(token), userId, "EX", TTL_SECONDS);
  await redis.set(userKey(userId), token, "EX", TTL_SECONDS);
  return token;
}

export async function consumeEmailVerification(token: string): Promise<string | null> {
  if (!token || token.length > 128) return null;
  const redis = getRedis();
  const userId = await redis.getdel(tokenKey(token));
  if (!userId) return null;
  await redis.del(userKey(userId));
  return userId;
}

export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const token = await issueEmailVerification(userId);
  try {
    await sendOrderEmail({
      to: email,
      subject: "Confirma tu correo — Power Meals",
      text: [
        "Confirma tu correo para entrar a Power Meals.",
        "",
        verificationUrl(token),
        "",
        "El enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje.",
      ].join("\n"),
    });
  } catch (error) {
    await getRedis().del(tokenKey(token), userKey(userId));
    throw error;
  }
}

export async function findUserByEmail(email: string) {
  const [user] = await getDb()
    .select({
      id: schema.users.id,
      email: schema.users.email,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      passwordHash: schema.users.passwordHash,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email}`)
    .limit(1);
  return user ?? null;
}

export async function markEmailVerified(userId: string): Promise<boolean> {
  const [user] = await getDb()
    .update(schema.users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning({ id: schema.users.id });
  return Boolean(user);
}

export { isOrderEmailConfigured };
