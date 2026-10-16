import { randomBytes } from "node:crypto";
import { getRedis } from "@/lib/redis";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/** Sliding-window log in a sorted set. Rejected attempts also count, so a client that keeps hammering stays blocked. */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const redisKey = `ratelimit:${key}`;

  const results = await getRedis()
    .multi()
    .zremrangebyscore(redisKey, "-inf", String(now - windowMs))
    .zadd(redisKey, String(now), `${now}-${randomBytes(4).toString("hex")}`)
    .zcard(redisKey)
    .zrange(redisKey, "0", "0", "WITHSCORES")
    .pexpire(redisKey, windowMs)
    .exec();

  const count = Number(results?.[2]?.[1] ?? 0);
  const oldest = Number((results?.[3]?.[1] as string[] | undefined)?.[1] ?? now);
  const allowed = count <= limit;
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
  };
}
