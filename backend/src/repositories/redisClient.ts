import Redis from "ioredis";
import { config } from "../config";

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    if (!config.redisUrl) throw new Error("REDIS_URL is not configured");
    client = new Redis(config.redisUrl, { lazyConnect: false });
    client.on("error", (err) => console.error("[Redis] Connection error:", err));
    client.on("connect", () => console.log("[Redis] Connected"));
  }
  return client;
}

export async function closeRedisClient(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
