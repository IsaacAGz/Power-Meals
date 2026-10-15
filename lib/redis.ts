import { Redis } from "ioredis";
import { requireEnv } from "@/lib/env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(requireEnv("REDIS_URL"), {
      maxRetriesPerRequest: 2,
      connectTimeout: 5_000,
    });
  }
  return globalForRedis.redis;
}
