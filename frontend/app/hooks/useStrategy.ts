"use client";
import { useEffect, useState } from "react";
import { subscribe } from "../lib/socket";

export type AIContext = {
  confidence: number;
  readyForAI: boolean;
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
  history: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    avgWinPips: number;
    avgLossPips: number;
    recentResults: ("W" | "L")[];
  };
  risk: {
    dailyPnLPips: number;
    targetPips: number;
    remainingPips: number;
    lotSize: number;
    mode: "pocket" | "regular";
  };
  promptPreview: string;
};

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
  };
  aiContext?: AIContext;
};

export function useStrategy() {
  const [signals, setSignals] = useState<StrategySignal[]>([]);

  useEffect(() => {
    const unsub = subscribe("strategy:update", (data) => setSignals(data));
    return unsub;
  }, []);

  return { signals };
}
