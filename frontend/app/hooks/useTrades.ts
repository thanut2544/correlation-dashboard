"use client";
import { useEffect, useState } from "react";
import { subscribe } from "../lib/socket";

export type TradeIntent = {
  id: string;
  pair: [string, string];
  action: "open" | "close";
  direction?: "long-spread" | "short-spread";
  entryPrices?: [number, number];
  exitPrices?: [number, number];
  finalPnL?: number;
  ts: number;
  status: "pending" | "filled" | "cancelled" | "closed";
};

export function useTrades() {
  const [trades, setTrades] = useState<TradeIntent[]>([]);

  useEffect(() => {
    const unsub = subscribe("trades:update", (data) => setTrades(data));
    return unsub;
  }, []);

  return { trades };
}
