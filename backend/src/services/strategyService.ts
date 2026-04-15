import { PriceService } from "./priceService";
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
};

export class StrategyService {
  constructor(private priceService: PriceService) { }

  async evaluate(): Promise<StrategySignal[]> {
    const syms = this.priceService.symbols();
    const signals: StrategySignal[] = [];
    const sessionOk = isAllowedSession();

    // Fetch only the required window once per symbol, not full history
    const needed = Math.max(config.strategy.corrMidWindow, config.strategy.emaSlow, config.strategy.rsiPeriod + 1, config.strategy.atrPeriod + 1);
    const histCache = new Map<string, number[]>();
    for (const sym of syms) {
      const hist = await this.priceService.historyLast(sym, needed);
      histCache.set(sym, hist.map(p => p.price));
    }

    for (let i = 0; i < syms.length; i++) {
      for (let j = i + 1; j < syms.length; j++) {
        const aPrices = histCache.get(syms[i])!;
        const bPrices = histCache.get(syms[j])!;
        if (!aPrices.length || !bPrices.length) continue;

        const len = Math.min(aPrices.length, bPrices.length);
        const a = aPrices.slice(-len);
        const b = bPrices.slice(-len);

        // Correlation short vs mid
        const rShort = pearson(a.slice(-config.strategy.corrShortWindow), b.slice(-config.strategy.corrShortWindow));
        const rMid = pearson(a.slice(-config.strategy.corrMidWindow), b.slice(-config.strategy.corrMidWindow));

        // Skip pair if correlation is undefined (insufficient or zero-variance data)
        if (isNaN(rShort) || isNaN(rMid)) continue;

        const rShortSeries = a.slice(-config.strategy.corrShortWindow).map((_, idx) =>
          pearson(
            a.slice(-(config.strategy.corrShortWindow + idx)).slice(-config.strategy.corrShortWindow),
            b.slice(-(config.strategy.corrShortWindow + idx)).slice(-config.strategy.corrShortWindow),
          )
        ).filter(v => !isNaN(v));
        const rShortVol = stddev(rShortSeries);

        const corrStable =
          Math.abs(rShort - rMid) < config.strategy.corrStabilityMaxDiff &&
          rShortVol < config.strategy.corrStabilityVol &&
          rMid > config.thresholdHigh;

        // Spread & Z-score
        const spread = a.map((v, idx) => v - b[idx]);
        const z = zScore(spread.slice(-config.strategy.corrMidWindow));

        // Trend alignment
        const emaFastA = last(ema(a, config.strategy.emaFast));
        const emaSlowA = last(ema(a, config.strategy.emaSlow));
        const emaFastB = last(ema(b, config.strategy.emaFast));
        const emaSlowB = last(ema(b, config.strategy.emaSlow));
        const aligned =
          (z > 0 && emaFastA > emaSlowA && emaFastB > emaSlowB) ||
          (z < 0 && emaFastA < emaSlowA && emaFastB < emaSlowB);
        const counterTrend = !aligned;

        // Momentum exhaustion
        const rsiA = rsi(a, config.strategy.rsiPeriod);
        const rsiB = rsi(b, config.strategy.rsiPeriod);
        // NaN means insufficient data — treat as not confirmed
        const rsiAVal = isNaN(rsiA) ? 50 : rsiA;
        const rsiBVal = isNaN(rsiB) ? 50 : rsiB;
        const momentumOk =
          (z > 0 && (rsiAVal > 65 || rsiBVal < 35)) ||
          (z < 0 && (rsiAVal < 35 || rsiBVal > 65));

        // Volatility regime
        const atrSpread = atr(spread, config.strategy.atrPeriod);
        const regimeOk = atrSpread >= config.strategy.atrMin && atrSpread <= config.strategy.atrMax;

        // Qualification
        const zThreshold = counterTrend ? config.strategy.zEntryStrict : config.strategy.zEntry;
        const qualifies = corrStable && Math.abs(z) > zThreshold && momentumOk && regimeOk && sessionOk;
        const direction: StrategySignal["direction"] =
          qualifies ? (z > 0 ? "short-spread" : "long-spread") : "none";

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
            priceA: last(a),
            priceB: last(b),
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
 * DST-aware session check using the Intl API so that London/NY hour boundaries
 * remain correct throughout daylight-saving transitions.
 */
function isAllowedSession(): boolean {
  const now = new Date();

  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(now)
  );
  const nyHour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(now)
  );

  const london = londonHour >= 8 && londonHour < 17;
  const ny = nyHour >= 8 && nyHour < 17;

  const allowed = config.strategy.allowSessions;
  if (allowed.includes("london") && london) return true;
  if (allowed.includes("ny") && ny) return true;
  if (allowed.includes("all")) return true;
  return false;
}
