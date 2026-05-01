import { CandleService } from "./candleService";
import { AIContext } from "./aiContextService";
import { pearson } from "../utils/correlation";
import { atr, ema, rsi, stddev, zScore } from "../utils/indicators";
import { config } from "../config";

export type StrategySignal = {
  pair: [string, string];
  qualified: boolean;
  direction: "long-spread" | "short-spread" | "none";
  reasons: string[];
  metrics: {
    rShort: number;
    rMid: number;
    z: number;
    emaFastA: number;
    emaSlowA: number;
    emaFastB: number;
    emaSlowB: number;
    rsiA: number;
    rsiB: number;
    atrSpread: number;
    priceA: number;
    priceB: number;
  };
  /** ข้อมูลที่เตรียมไว้สำหรับ AI วิเคราะห์ (ยังไม่ส่ง AI จริง) */
  aiContext?: AIContext;
};

export class StrategyService {
  constructor(private candleService: CandleService) { }

  async evaluate(): Promise<StrategySignal[]> {
    const syms = this.candleService.symbols();
    const signals: StrategySignal[] = [];
    const sessionOk = isAllowedSession();

    // จำนวน candles ที่ต้องการมากที่สุด (ครอบคลุม EMA slow + correlation windows)
    const needed = Math.max(
      config.strategy.corrMidWindow,
      config.strategy.emaSlow,
      config.strategy.rsiPeriod + 1,
      config.strategy.atrPeriod + 1
    );

    // โหลด M15 candle closes ทีเดียวทุก symbol
    const closeCache = new Map<string, number[]>();
    for (const sym of syms) {
      const closes = await this.candleService.getCloses(sym, needed);
      closeCache.set(sym, closes);
    }

    for (let i = 0; i < syms.length; i++) {
      for (let j = i + 1; j < syms.length; j++) {
        const a = closeCache.get(syms[i])!;
        const b = closeCache.get(syms[j])!;
        if (!a.length || !b.length) continue;

        const len = Math.min(a.length, b.length);
        const aArr = a.slice(-len);
        const bArr = b.slice(-len);

        // ── Correlation short vs mid (M15 bars) ──────────────────────────────
        const rShort = pearson(
          aArr.slice(-config.strategy.corrShortWindow),
          bArr.slice(-config.strategy.corrShortWindow)
        );
        const rMid = pearson(
          aArr.slice(-config.strategy.corrMidWindow),
          bArr.slice(-config.strategy.corrMidWindow)
        );

        if (isNaN(rShort) || isNaN(rMid)) continue;

        // ── Correlation stability (volatility ของ rShort series) ─────────────
        const rShortSeries = aArr
          .slice(-config.strategy.corrShortWindow)
          .map((_, idx) =>
            pearson(
              aArr.slice(-(config.strategy.corrShortWindow + idx)).slice(-config.strategy.corrShortWindow),
              bArr.slice(-(config.strategy.corrShortWindow + idx)).slice(-config.strategy.corrShortWindow)
            )
          )
          .filter(v => !isNaN(v));
        const rShortVol = stddev(rShortSeries);

        const corrStable =
          Math.abs(rShort - rMid) < config.strategy.corrStabilityMaxDiff &&
          rShortVol < config.strategy.corrStabilityVol &&
          rMid > config.thresholdHigh;

        // ── Spread & Z-score (M15 candle closes) ─────────────────────────────
        const spread = aArr.map((v, idx) => v - bArr[idx]);
        const z = zScore(spread.slice(-config.strategy.corrMidWindow));

        // ── Trend alignment (EMA บน M15 candles) ────────────────────────────
        const emaFastA = last(ema(aArr, config.strategy.emaFast));
        const emaSlowA = last(ema(aArr, config.strategy.emaSlow));
        const emaFastB = last(ema(bArr, config.strategy.emaFast));
        const emaSlowB = last(ema(bArr, config.strategy.emaSlow));
        const aligned =
          (z > 0 && emaFastA > emaSlowA && emaFastB > emaSlowB) ||
          (z < 0 && emaFastA < emaSlowA && emaFastB < emaSlowB);
        const counterTrend = !aligned;

        // ── Momentum exhaustion (RSI บน M15 candles) ─────────────────────────
        const rsiA = rsi(aArr, config.strategy.rsiPeriod);
        const rsiB = rsi(bArr, config.strategy.rsiPeriod);
        const rsiAVal = isNaN(rsiA) ? 50 : rsiA;
        const rsiBVal = isNaN(rsiB) ? 50 : rsiB;
        const momentumOk =
          (z > 0 && (rsiAVal > 65 || rsiBVal < 35)) ||
          (z < 0 && (rsiAVal < 35 || rsiBVal > 65));

        // ── Volatility regime (ATR บน M15 spread) ────────────────────────────
        const atrSpread = atr(spread, config.strategy.atrPeriod);
        const regimeOk =
          atrSpread >= config.strategy.atrMin &&
          atrSpread <= config.strategy.atrMax;

        // ── Final qualification ───────────────────────────────────────────────
        // counter-trend ต้องการ Z สูงกว่า (เสี่ยงมากกว่า)
        const zThreshold = counterTrend
          ? config.strategy.zEntryStrict
          : config.strategy.zEntry;
        const qualifies =
          corrStable &&
          Math.abs(z) > zThreshold &&
          momentumOk &&
          regimeOk &&
          sessionOk;
        const direction: StrategySignal["direction"] = qualifies
          ? z > 0
            ? "short-spread"
            : "long-spread"
          : "none";

        const reasons: string[] = [];
        if (!corrStable) reasons.push("Correlation unstable or too low");
        if (Math.abs(z) <= zThreshold) reasons.push("Z-score not high enough");
        if (!momentumOk) reasons.push("Momentum exhaustion not confirmed");
        if (!regimeOk) reasons.push("Volatility regime not acceptable");
        if (!sessionOk) reasons.push("Session not allowed");
        if (counterTrend) reasons.push("Counter-trend: stricter threshold applied");

        signals.push({
          pair: [syms[i], syms[j]],
          qualified: qualifies,
          direction,
          reasons: reasons.length ? reasons : ["Qualified"],
          metrics: {
            rShort,
            rMid,
            z,
            emaFastA,
            emaSlowA,
            emaFastB,
            emaSlowB,
            rsiA: rsiAVal,
            rsiB: rsiBVal,
            atrSpread,
            priceA: last(aArr),
            priceB: last(bArr),
          },
        });
      }
    }
    return signals;
  }
}

function last(arr: number[]): number {
  return arr.length ? arr[arr.length - 1] : 0;
}

/**
 * DST-aware session check
 * London: 08:00–17:00 Europe/London
 * New York: 08:00–17:00 America/New_York
 */
function isAllowedSession(): boolean {
  const now = new Date();

  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/London",
    }).format(now)
  );
  const nyHour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/New_York",
    }).format(now)
  );

  const london = londonHour >= 8 && londonHour < 17;
  const ny = nyHour >= 8 && nyHour < 17;

  const allowed = config.strategy.allowSessions;
  if (allowed.includes("london") && london) return true;
  if (allowed.includes("ny") && ny) return true;
  if (allowed.includes("all")) return true;
  return false;
}
