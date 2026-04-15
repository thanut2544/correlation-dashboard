"use client";
import { useEffect, useState } from "react";
import { subscribe } from "../lib/socket";

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
};

export function useStrategy() {
  const [signals, setSignals] = useState<StrategySignal[]>([]);

  useEffect(() => {
    const unsub = subscribe("strategy:update", (data) => setSignals(data));
    return unsub;
  }, []);

  return { signals };
}
