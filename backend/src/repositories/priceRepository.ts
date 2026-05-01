type PricePoint = { ts: number; price: number };

export interface PriceRepository {
  push(symbol: string, price: number, ts?: number): void | Promise<void>;
  getHistory(symbol: string): PricePoint[] | Promise<PricePoint[]>;
  getHistoryLast(symbol: string, limit: number): PricePoint[] | Promise<PricePoint[]>;
  getLatest(symbol: string): PricePoint | undefined | Promise<PricePoint | undefined>;
}

export class InMemoryPriceRepo implements PriceRepository {
  private store = new Map<string, PricePoint[]>();

  /**
   * maxPoints = 50,000 ticks ต่อ symbol
   *
   * ที่ feed interval 2s:
   *   50,000 × 2s = 100,000s ≈ 27.8 ชั่วโมงของ tick data
   *   27.8h / 15min = ~111 M15 bars → ครอบคลุม corrMidWindow=96 ✓
   *
   * ที่ feed interval 500ms (MT5 EA):
   *   50,000 × 0.5s = 25,000s ≈ 6.9 ชั่วโมง = ~27 M15 bars
   *   → ถ้า EA ส่งถี่กว่า 2s ให้เพิ่ม maxPoints หรือลด corrMidWindow
   */
  constructor(private maxPoints = 50_000) { }

  push(symbol: string, price: number, ts?: number) {
    const arr = this.store.get(symbol) ?? [];
    arr.push({ ts: ts ?? Date.now(), price });
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
