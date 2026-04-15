import { config } from "../config";
import { getRedisClient } from "./redisClient";
import { PriceRepository } from "./priceRepository";

type PricePoint = { ts: number; price: number };

/**
 * Redis-backed price store using a list per symbol.
 * Keeps a bounded list (maxPoints) with LPUSH / LTRIM / LRANGE.
 * Uses the shared singleton Redis client to avoid connection proliferation.
 */
export class RedisPriceRepo implements PriceRepository {
  constructor(private maxPoints = 10_000) {}

  private key(symbol: string) {
    return `${config.redisNamespace}:${symbol}`;
  }

  private get client() {
    return getRedisClient();
  }

  async push(symbol: string, price: number) {
    const payload = JSON.stringify({ ts: Date.now(), price });
    const k = this.key(symbol);
    await this.client.multi().lpush(k, payload).ltrim(k, 0, this.maxPoints - 1).exec();
  }

  async getHistory(symbol: string): Promise<PricePoint[]> {
    const raw = await this.client.lrange(this.key(symbol), 0, this.maxPoints - 1);
    return raw.map(item => JSON.parse(item) as PricePoint).reverse(); // oldest first
  }

  async getHistoryLast(symbol: string, limit: number): Promise<PricePoint[]> {
    // Redis list is stored newest-first (LPUSH), so index 0..limit-1 = newest N
    const raw = await this.client.lrange(this.key(symbol), 0, limit - 1);
    return raw.map(item => JSON.parse(item) as PricePoint).reverse(); // oldest first
  }

  async getLatest(symbol: string): Promise<PricePoint | undefined> {
    const item = await this.client.lindex(this.key(symbol), 0);
    return item ? (JSON.parse(item) as PricePoint) : undefined;
  }
}
