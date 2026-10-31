import "dotenv/config";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL?.trim() || "redis://localhost:6379";

/**
 * Shared Redis connection. Redis is an optional cache dependency: callers should
 * handle command errors and continue with their primary data source.
 */
export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 1_000,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: true,
  retryStrategy(times) {
    return Math.min(times * 500, 5_000);
  },
});

redis.on("connect", () => {
  console.info("[Redis] Connected");
});

redis.on("error", (error) => {
  // Redis is only used as a cache, so connection failures must not take down the API.
  console.warn("[Redis] Connection error:", error.message);
});
