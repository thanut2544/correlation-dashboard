import { PriceService } from "./priceService";
import { config } from "../config";

type PricePoint = { ts: number; price: number };

/**
 * CandleService — แปลง raw tick stream เป็น M15 candle closes
 *
 * วิธีทำงาน:
 * - ดึง ticks จาก PriceService
 * - จัดกลุ่มตาม timestamp window (ทุก 15 นาที)
 * - ราคาสุดท้ายของแต่ละ window = candle close
 * - ส่งคืน array ของ close prices เรียงตามเวลา
 */
export class CandleService {
  private readonly candleMs: number;
  /** ticks ต่อ candle โดยประมาณ (ใช้ feed interval 2s) */
  private readonly ticksPerCandle: number;

  constructor(private priceService: PriceService) {
    this.candleMs = config.candleIntervalMs;
    this.ticksPerCandle = Math.ceil(this.candleMs / 2000);
  }

  symbols(): string[] {
    return this.priceService.symbols();
  }

  /**
   * คืน last `count` M15 candle close prices สำหรับ symbol หนึ่งตัว
   * ถ้า tick ในระบบมีน้อยกว่า count candles → คืนเท่าที่มี (อาจ < count)
   */
  async getCloses(symbol: string, count: number): Promise<number[]> {
    // ดึง ticks มากพอเพื่อครอบคลุม count candles (+ buffer 2x)
    const ticks = await this.priceService.historyLast(
      symbol,
      Math.min(count * this.ticksPerCandle * 2, 50_000)
    );
    return this.resample(ticks, count);
  }

  /**
   * แปลง tick array → candle close array
   * แต่ละ bucket = หนึ่ง 15-นาที window, ค่า = ราคาสุดท้ายใน window
   */
  private resample(ticks: PricePoint[], count: number): number[] {
    if (ticks.length === 0) return [];

    const buckets = new Map<number, number>();
    for (const { ts, price } of ticks) {
      const bucket = Math.floor(ts / this.candleMs);
      buckets.set(bucket, price); // เขียนทับทุกครั้ง → ค่าสุดท้าย = close
    }

    const closes = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, price]) => price);

    return closes.slice(-count);
  }
}
