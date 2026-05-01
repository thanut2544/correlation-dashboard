import { config } from "../config";

export type DailyStats = {
  dailyPnL: number;
  dailyTarget: number;
  dailyDrawdown: number;
  canTrade: boolean;
  blockReason: string | null;
  tradesCount: number;
  maxConcurrent: number;
  isPocketMode: boolean;
  currentLotSize: number;
};

/**
 * DailyRiskManager — จัดการ Daily Target / Drawdown / Position Sizing
 *
 * กฎฟามดอล่า:
 * 1. หยุด auto-trade เมื่อ dailyPnL ≥ dailyTargetPips (กำไรพอแล้ว → ออกได้เลย)
 * 2. หยุด auto-trade เมื่อ dailyPnL ≤ -dailyDrawdownPips (ตัดขาดทุน ห้ามฝืน)
 * 3. ห้ามเปิด position เกิน maxConcurrentTrades พร้อมกัน
 * 4. Reset ทุกเที่ยงคืนตามเวลาไทย (17:00 UTC = 00:00 Bangkok UTC+7)
 *
 * Position Sizing:
 * - Pocket Mode (<$2,000): lot = 0.01 fixed (micro lot)
 * - Regular Mode (≥$2,000): lot = (balance × riskPercent%) / (SL pips × $10/pip)
 */
export class DailyRiskManager {
  private dailyPnL = 0;
  private tradesCount = 0;
  private lastResetKey = this.bangkokDayKey();

  /**
   * คืน "วันปัจจุบัน" ในมุมมองของ Bangkok (UTC+7)
   * ใช้เป็น key สำหรับตรวจว่าวันใหม่เริ่มแล้วหรือยัง
   * Reset จะเกิดขึ้นเมื่อ 17:00 UTC (= 00:00 Bangkok)
   */
  private bangkokDayKey(): string {
    const now = new Date();
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now); // "YYYY-MM-DD" ตาม Bangkok timezone
  }

  /** เรียกทุก strategy cycle เพื่อ reset เมื่อเป็นวันใหม่ (Bangkok midnight) */
  resetIfNewDay(): void {
    const today = this.bangkokDayKey();
    if (today !== this.lastResetKey) {
      console.log(
        `[DailyRiskManager] New Bangkok day (${today}) — resetting P&L counters ` +
        `| Previous day: PnL=${this.dailyPnL.toFixed(1)} pips, trades=${this.tradesCount}`
      );
      this.dailyPnL = 0;
      this.tradesCount = 0;
      this.lastResetKey = today;
    }
  }

  /**
   * ตรวจสอบว่า auto-trading ยังเปิดอยู่หรือไม่
   * @param openTradesCount จำนวน position ที่เปิดอยู่ขณะนี้
   */
  canTrade(openTradesCount: number): boolean {
    return this.getBlockReason(openTradesCount) === null;
  }

  getBlockReason(openTradesCount: number): string | null {
    // กฎ 1: ถึง Daily Target → หยุด (กำไรพอแล้ว)
    if (this.dailyPnL >= config.dailyTargetPips) {
      return `Daily target reached (+${this.dailyPnL.toFixed(1)} pips) — come back tomorrow`;
    }
    // กฎ 2: ถึง Daily Drawdown → หยุด (ห้ามฝืนตลาด)
    if (this.dailyPnL <= -config.dailyDrawdownPips) {
      return `Daily drawdown limit hit (${this.dailyPnL.toFixed(1)} pips) — protect the account`;
    }
    // กฎ 3: เกิน max concurrent positions
    if (openTradesCount >= config.maxConcurrentTrades) {
      return `Max concurrent trades (${config.maxConcurrentTrades}) reached`;
    }
    return null;
  }

  /** บันทึก P&L หลัง close position (หน่วยเป็น pips) */
  recordPnL(pips: number): void {
    this.dailyPnL += pips;
    this.tradesCount++;
    const emoji = pips >= 0 ? "✓" : "✗";
    console.log(
      `[DailyRiskManager] ${emoji} ${pips >= 0 ? "+" : ""}${pips.toFixed(1)} pips | ` +
      `Daily: ${this.dailyPnL.toFixed(1)} / Target: +${config.dailyTargetPips} | ` +
      `Drawdown limit: -${config.dailyDrawdownPips} | Trades today: ${this.tradesCount}`
    );
  }

  /**
   * คำนวณ lot size ที่เหมาะสม
   *
   * Pocket Mode (balance < $2,000):
   *   → 0.01 lot fixed (micro lot) — ปลอดภัยสำหรับบัญชีเล็ก
   *
   * Regular Mode (balance ≥ $2,000):
   *   lot = (balance × riskPercent%) / (stopLossPips × $10/pip per standard lot)
   *   ตัวอย่าง: balance=$5,000, risk=0.5%, SL=35 pips
   *   → lot = ($5,000 × 0.005) / (35 × $10) = $25 / $350 = 0.07 lot
   */
  calculateLotSize(): number {
    if (config.isPocketMode) {
      return config.pocketModeLot; // 0.01 fixed
    }

    // zStopLoss × 10 = ประมาณ pips ที่ SL อยู่ห่างจาก entry
    const stopLossPips = config.strategy.zStopLoss * 10;
    const pipValuePerLot = 10; // USD per pip สำหรับ standard lot (USD-quoted pairs)
    const riskAmount = (config.accountBalance * config.riskPercent) / 100;
    const rawLot = riskAmount / (stopLossPips * pipValuePerLot);

    // Round down ไปยัง 0.01 ที่ใกล้ที่สุด, min = 0.01
    return Math.max(0.01, Math.floor(rawLot * 100) / 100);
  }

  /** ดึง stats สำหรับ broadcast ไปยัง frontend */
  getDailyStats(openTradesCount: number): DailyStats {
    return {
      dailyPnL: this.dailyPnL,
      dailyTarget: config.dailyTargetPips,
      dailyDrawdown: config.dailyDrawdownPips,
      canTrade: this.canTrade(openTradesCount),
      blockReason: this.getBlockReason(openTradesCount),
      tradesCount: this.tradesCount,
      maxConcurrent: config.maxConcurrentTrades,
      isPocketMode: config.isPocketMode,
      currentLotSize: this.calculateLotSize(),
    };
  }
}
