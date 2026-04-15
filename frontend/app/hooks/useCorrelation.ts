"use client";
import { useEffect, useState } from "react";
import { subscribe } from "../lib/socket";

type CorrelationResult = { pair: [string, string]; value: number; ts: number; thresholdBreached: boolean };

export function useCorrelation() {
  const [correlations, setCorr] = useState<CorrelationResult[]>([]);

  useEffect(() => {
    const unsub = subscribe("correlation:update", (data) => setCorr(data));
    return unsub;
  }, []);

  return { correlations };
}
