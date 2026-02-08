import type { RedisClientType } from "redis";
import process from "node:process";
import { assertEnv } from "@anglish/core";
import { createClient } from "redis";

assertEnv([
  "REDIS_URL",
]);

export const redis: RedisClientType = createClient({
  url: process.env.REDIS_URL,
});

redis.on("error", error => console.error(`Redis: ${error}`));

if (!redis.isOpen) {
  await redis.connect();
}
