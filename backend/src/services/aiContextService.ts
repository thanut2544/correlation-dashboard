import { TradeIntent } from "./tradeService";
import { config } from "../config";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AIContext = {
  /** คะแนนความน่าเชื่อถือของสัญญาณ (0–100) คำนวณจากกฎของระบบ */
  confidence: number;
  /** ข้อมูลพร้อมส่ง AI หรือยัง (มีข้อมูลเพียงพอ) */
  readyForAI: boolean;

  /** สรุปสภาพตลาดเป็นภาษามนุษย์ */
  snapshot: {
    pair: string;
    session: string;
    correlationStrength: "strong" | "moderate" | "weak";
    correlationStable: boolean;
    spreadCondition: "overbought" | "oversold" | "neutral";
    momentumExhausted: boolean;
    trendAlignment: "with-trend" | "counter-trend" | "unclear";
    direction: "long-spread" | "short-spread" | "none";
  };

  /** ตัวเลขดิบสำหรับส่ง AI */
  metrics: {
    rShort: number;
    rMid: number;
    rDiff: number;
    z: number;
    rsiA: number;
    rsiB: number;
    atrSpread: number;
    emaFastA: number;
    emaSlowA: number;
  };

  /** ประวัติการเทรดของคู่นี้ */
  history: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    avgWinPips: number;
    avgLossPips: number;
    recentResults: ("W" | "L")[];
  };

  /** ความเสี่ยงรายวัน */
  risk: {
    dailyPnLPips: number;
    targetPips: number;
    remainingPips: number;
    lotSize: number;
    mode: "pocket" | "regular";
  };

  /** Prompt สำเร็จรูปสำหรับส่ง Claude API ในอนาคต */
  promptPreview: string;
};

// ── Input types ───────────────────────────────────────────────────────────────

type SignalMetrics = {
  rShort: number;
  rMid: number;
  z: number;
  rsiA: number;
  rsiB: number;
  atrSpread: number;
  emaFastA: number;
  emaSlowA: number;
  emaFastB: number;
  emaSlowB: number;
};

type DailyRiskSnapshot = {
  dailyPnL: number;
  dailyTarget: number;
  currentLotSize: number;
  isPocketMode: boolean;
};

// ── AIContextService ──────────────────────────────────────────────────────────

export class AIContextService {
  /**
   * สร้าง AIContext สำหรับ 1 คู่เงิน
   * รวมข้อมูลจาก signal metrics + trade history + daily risk
   */
  build(
    pair: [string, string],
    direction: "long-spread" | "short-spread" | "none",
    qualified: boolean,
    metrics: SignalMetrics,
    allTrades: TradeIntent[],
    dailyRisk: DailyRiskSnapshot
  ): AIContext {
    const history = this.buildHistory(pair, allTrades);
    const snapshot = this.buildSnapshot(pair, direction, metrics);
    const confidence = this.calcConfidence(metrics, qualified, history, snapshot);
    const risk = this.buildRisk(dailyRisk);
    const promptPreview = this.buildPrompt(pair, direction, snapshot, metrics, history, risk, confidence);

    return {
      confidence,
      readyForAI: history.totalTrades >= 3, // ต้องมีประวัติอย่างน้อย 3 trades
      snapshot,
      metrics: {
        rShort: metrics.rShort,
        rMid: metrics.rMid,
        rDiff: Math.abs(metrics.rShort - metrics.rMid),
        z: metrics.z,
        rsiA: metrics.rsiA,
        rsiB: metrics.rsiB,
        atrSpread: metrics.atrSpread,
        emaFastA: metrics.emaFastA,
        emaSlowA: metrics.emaSlowA,
      },
      history,
      risk,
      promptPreview,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private buildSnapshot(
    pair: [string, string],
    direction: "long-spread" | "short-spread" | "none",
    m: SignalMetrics
  ): AIContext["snapshot"] {
    // Correlation strength
    const correlationStrength =
      m.rMid > 0.85 ? "strong" : m.rMid > 0.70 ? "moderate" : "weak";

    // Correlation stability
    const correlationStable = Math.abs(m.rShort - m.rMid) < 0.15;

    // Spread condition
    const spreadCondition =
      m.z > 1.0 ? "overbought" : m.z < -1.0 ? "oversold" : "neutral";

    // Momentum exhaustion
    const momentumExhausted =
      (m.z > 0 && (m.rsiA > 65 || m.rsiB < 35)) ||
      (m.z < 0 && (m.rsiA < 35 || m.rsiB > 65));

    // Trend alignment
    const withTrend =
      (m.z > 0 && m.emaFastA > m.emaSlowA && m.emaFastB > m.emaSlowB) ||
      (m.z < 0 && m.emaFastA < m.emaSlowA && m.emaFastB < m.emaSlowB);
    const trendAlignment = withTrend ? "with-trend" : "counter-trend";

    // Session label
    const londonHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "numeric", hour12: false, timeZone: "Europe/London",
      }).format(new Date())
    );
    const nyHour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric", hour12: false, timeZone: "America/New_York",
      }).format(new Date())
    );
    const inLondon = londonHour >= 8 && londonHour < 17;
    const inNY = nyHour >= 8 && nyHour < 17;
    const session =
      inLondon && inNY ? "London+NY Overlap"
      : inLondon ? "London"
      : inNY ? "New York"
      : "Off-hours";

    return {
      pair: `${pair[0]}/${pair[1]}`,
      session,
      correlationStrength,
      correlationStable,
      spreadCondition,
      momentumExhausted,
      trendAlignment,
      direction,
    };
  }

  private buildHistory(
    pair: [string, string],
    allTrades: TradeIntent[]
  ): AIContext["history"] {
    // กรองเฉพาะ closed open-trades ของคู่นี้ที่มี PnL
    const closed = allTrades.filter(
      t =>
        t.pair[0] === pair[0] &&
        t.pair[1] === pair[1] &&
        t.action === "open" &&
        t.status === "closed" &&
        t.finalPnL !== undefined
    );

    if (closed.length === 0) {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgWinPips: 0,
        avgLossPips: 0,
        recentResults: [],
      };
    }

    const wins = closed.filter(t => (t.finalPnL ?? 0) > 0);
    const losses = closed.filter(t => (t.finalPnL ?? 0) <= 0);
    const avgWinPips =
      wins.length > 0
        ? wins.reduce((s, t) => s + (t.finalPnL ?? 0), 0) / wins.length
        : 0;
    const avgLossPips =
      losses.length > 0
        ? losses.reduce((s, t) => s + (t.finalPnL ?? 0), 0) / losses.length
        : 0;

    // Recent 5 trades
    const recentResults = closed
      .slice(-5)
      .map(t => ((t.finalPnL ?? 0) > 0 ? "W" : "L") as "W" | "L");

    return {
      totalTrades: closed.length,
      wins: wins.length,
      losses: losses.length,
      winRate: (wins.length / closed.length) * 100,
      avgWinPips,
      avgLossPips,
      recentResults,
    };
  }

  private buildRisk(daily: DailyRiskSnapshot): AIContext["risk"] {
    return {
      dailyPnLPips: daily.dailyPnL,
      targetPips: daily.dailyTarget,
      remainingPips: Math.max(0, daily.dailyTarget - daily.dailyPnL),
      lotSize: daily.currentLotSize,
      mode: daily.isPocketMode ? "pocket" : "regular",
    };
  }

  /**
   * คำนวณ confidence score 0–100 จากกฎของระบบ
   *
   * สูตร:
   * - Correlation strength  : สูงสุด 25 คะแนน
   * - Correlation stability : สูงสุด 20 คะแนน
   * - Z-score magnitude     : สูงสุด 20 คะแนน
   * - Momentum exhaustion   : 15 คะแนน
   * - Trade history         : สูงสุด 15 คะแนน
   * - Counter-trend penalty : -10 คะแนน
   */
  private calcConfidence(
    m: SignalMetrics,
    qualified: boolean,
    history: AIContext["history"],
    snap: AIContext["snapshot"]
  ): number {
    if (!qualified) return 0;

    let score = 0;

    // Correlation strength (25 pts)
    if (m.rMid > 0.90) score += 25;
    else if (m.rMid > 0.85) score += 20;
    else if (m.rMid > 0.80) score += 15;
    else score += 5;

    // Correlation stability (20 pts)
    const diff = Math.abs(m.rShort - m.rMid);
    if (diff < 0.05) score += 20;
    else if (diff < 0.10) score += 15;
    else if (diff < 0.15) score += 8;

    // Z-score magnitude (20 pts)
    const absZ = Math.abs(m.z);
    if (absZ > 3.5) score += 20;
    else if (absZ > 3.0) score += 16;
    else if (absZ > 2.5) score += 12;
    else if (absZ > 2.0) score += 6;

    // Momentum exhaustion (15 pts)
    if (snap.momentumExhausted) score += 15;

    // Trade history for this pair (15 pts)
    if (history.totalTrades >= 10 && history.winRate >= 60) score += 15;
    else if (history.totalTrades >= 5 && history.winRate >= 50) score += 10;
    else if (history.totalTrades >= 3) score += 5;

    // Counter-trend penalty (-10 pts)
    if (snap.trendAlignment === "counter-trend") score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * สร้าง prompt สำเร็จรูปสำหรับส่ง Claude API
   * ตอนนี้แค่ preview — ยังไม่ได้ส่งจริง
   */
  private buildPrompt(
    pair: [string, string],
    direction: "long-spread" | "short-spread" | "none",
    snap: AIContext["snapshot"],
    m: SignalMetrics,
    history: AIContext["history"],
    risk: AIContext["risk"],
    confidence: number
  ): string {
    const dirLabel =
      direction === "long-spread"
        ? `LONG SPREAD (Buy ${pair[0]}, Sell ${pair[1]})`
        : direction === "short-spread"
        ? `SHORT SPREAD (Sell ${pair[0]}, Buy ${pair[1]})`
        : "NO SIGNAL";

    const histLine =
      history.totalTrades > 0
        ? `${history.totalTrades} trades | ${history.wins}W/${history.losses}L | Win Rate: ${history.winRate.toFixed(1)}% | Avg Win: +${history.avgWinPips.toFixed(1)} pips | Avg Loss: ${history.avgLossPips.toFixed(1)} pips | Recent: ${history.recentResults.join(" ")}`
        : "No trade history for this pair yet";

    return `You are a forex trading assistant analyzing a M15 correlation pairs trade.

PAIR: ${pair[0]} / ${pair[1]}
TIMEFRAME: M15 (15-minute candles)
SESSION: ${snap.session}
SIGNAL: ${dirLabel}
RULE-BASED CONFIDENCE: ${confidence}/100

CORRELATION:
- Short window (7h):  ${m.rShort.toFixed(4)} — ${snap.correlationStrength}
- Mid window (24h):   ${m.rMid.toFixed(4)} — reference
- Stability (|diff|): ${Math.abs(m.rShort - m.rMid).toFixed(4)} ${snap.correlationStable ? "(stable)" : "(UNSTABLE)"}

SPREAD (Z-SCORE):
- Current Z: ${m.z.toFixed(3)}σ — ${snap.spreadCondition}
- Entry threshold: ±2.5σ | TP: 0.5σ | SL: 3.5σ
- Risk:Reward = 2:1

MOMENTUM:
- RSI ${pair[0]}: ${m.rsiA.toFixed(1)} ${m.rsiA > 65 ? "(overbought)" : m.rsiA < 35 ? "(oversold)" : "(neutral)"}
- RSI ${pair[1]}: ${m.rsiB.toFixed(1)} ${m.rsiB > 65 ? "(overbought)" : m.rsiB < 35 ? "(oversold)" : "(neutral)"}
- Exhaustion: ${snap.momentumExhausted ? "CONFIRMED" : "not confirmed"}

TREND:
- EMA Fast/Slow ${pair[0]}: ${m.emaFastA.toFixed(5)} / ${m.emaSlowA.toFixed(5)}
- Alignment: ${snap.trendAlignment}

TRADE HISTORY (this pair):
- ${histLine}

DAILY RISK:
- P&L today: ${risk.dailyPnLPips >= 0 ? "+" : ""}${risk.dailyPnLPips.toFixed(1)} / ${risk.targetPips} pips
- Remaining budget: ${risk.remainingPips.toFixed(1)} pips
- Lot size: ${risk.lotSize.toFixed(2)} (${risk.mode} mode)

QUESTION: Should we enter this trade?
Please provide: (1) recommendation: enter or skip, (2) confidence 0-100, (3) key risks, (4) brief reasoning in 2-3 sentences.`;
  }
}
