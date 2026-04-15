type PricePoint = { ts: number; price: number };

export interface PriceRepository {
  push(symbol: string, price: number): void | Promise<void>;
  getHistory(symbol: string): PricePoint[] | Promise<PricePoint[]>;
  getHistoryLast(symbol: string, limit: number): PricePoint[] | Promise<PricePoint[]>;
  getLatest(symbol: string): PricePoint | undefined | Promise<PricePoint | undefined>;
}

export class InMemoryPriceRepo implements PriceRepository {
  private store = new Map<string, PricePoint[]>();
  constructor(private maxPoints = 10_000) { }

  push(symbol: string, price: number) {
    const arr = this.store.get(symbol) ?? [];
    arr.push({ ts: Date.now(), price });
    if (arr.length > this.maxPoints) arr.shift();
    this.store.set(symbol, arr);
  }

  getHistory(symbol: string): PricePoint[] {
    return this.store.get(symbol) ?? [];
  }

  getHistoryLast(symbol: string, limit: number): PricePoint[] {
    const arr = this.store.get(symbol) ?? [];
    return arr.slice(-limit);
  }

  getLatest(symbol: string): PricePoint | undefined {
    const arr = this.store.get(symbol) ?? [];
    return arr[arr.length - 1];
  }
}
