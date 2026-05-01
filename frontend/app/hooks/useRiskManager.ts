"use client";
import { useEffect, useState } from "react";
import { subscribe } from "../lib/socket";

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

export function useRiskManager() {
  const [stats, setStats] = useState<DailyStats | null>(null);

  useEffect(() => {
    const unsub = subscribe("daily:risk", (data: DailyStats) => {
      setStats(data);
    });
    return unsub;
  }, []);

  return { stats };
}
