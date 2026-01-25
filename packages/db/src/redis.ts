import type { RedisClientType } from "redis";
import process from "node:process";
import { createClient } from "redis";

export const redis: RedisClientType = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

redis.on("error", error => console.error(`Redis: ${error}`));

if (!redis.isOpen) {
  await redis.connect();
}
