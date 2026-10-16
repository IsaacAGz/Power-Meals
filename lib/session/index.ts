import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { cartKey } from "@/lib/cart/keys";
import { getRedis } from "@/lib/redis";

export const SESSION_COOKIE = "pm_session";

// Redis is the source of truth for expiry; the cookie only has to outlive the sliding TTL.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type SessionData = {
  userId?: string;
  createdAt: number;
};

export type Session = {
  id: string;
  data: SessionData;
};

export function sessionTtlSeconds(): number {
  const value = Number(process.env.REDIS_SESSION_TTL_SECONDS ?? 86_400);
  return Number.isInteger(value) && value > 0 ? value : 86_400;
}

const sessionKey = (id: string) => `session:${id}`;

async function readSessionId(): Promise<string | undefined> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value && SESSION_ID_PATTERN.test(value) ? value : undefined;
}

async function writeCookie(id: string) {
  (await cookies()).set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

async function storeSession(data: SessionData): Promise<Session> {
  const id = randomBytes(32).toString("base64url");
  await getRedis().set(sessionKey(id), JSON.stringify(data), "EX", sessionTtlSeconds());
  await writeCookie(id);
  return { id, data };
}

/** Reads the current session and slides the TTL of the session and its guest cart. */
export const getSession = cache(async (): Promise<Session | null> => {
  const id = await readSessionId();
  if (!id) return null;

  const ttl = sessionTtlSeconds();
  const results = await getRedis()
    .multi()
    .get(sessionKey(id))
    .expire(sessionKey(id), ttl)
    .expire(cartKey(id), ttl)
    .exec();
  const raw = results?.[0]?.[1];
  if (typeof raw !== "string") return null;

  try {
    return { id, data: JSON.parse(raw) as SessionData };
  } catch {
    return null;
  }
});

/** Returns the current session, creating an anonymous one if needed. Server Functions and Route Handlers only. */
export async function ensureSession(): Promise<Session> {
  return (await getSession()) ?? storeSession({ createdAt: Date.now() });
}

/**
 * Issues a new session id for a privilege change (login, register) so a pre-auth id can't be fixed on the victim.
 * The guest cart follows the session to the new id.
 */
export async function rotateSession(data: Omit<SessionData, "createdAt">): Promise<Session> {
  const previous = await getSession();
  const next = await storeSession({ ...data, createdAt: Date.now() });
  if (previous) {
    const redis = getRedis();
    if (await redis.exists(cartKey(previous.id))) {
      await redis.rename(cartKey(previous.id), cartKey(next.id));
    }
    await redis.del(sessionKey(previous.id));
  }
  return next;
}

export async function destroySession() {
  const id = await readSessionId();
  if (id) await getRedis().del(sessionKey(id), cartKey(id));
  (await cookies()).delete(SESSION_COOKIE);
}
