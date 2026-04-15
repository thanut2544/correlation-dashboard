"use client";
import { useEffect, useState } from "react";
import { subscribe } from "../lib/socket";

type PricePoint = { ts: number; price: number };
type Series = Record<string, PricePoint[]>;

export function useLivePrices() {
  const [priceSeries, setSeries] = useState<Series>({});

  useEffect(() => {
    const unsub = subscribe("price:update", (data: any[]) => {
      setSeries(prev => {
        const next: Series = { ...prev };
        data.forEach((p: any) => {
          // Skip any entry that slipped through without a valid finite price
          if (!p.symbol || !isFinite(p.price) || p.price <= 0) return;
          const arr = next[p.symbol] ?? [];
          next[p.symbol] = [...arr.slice(-200), { ts: p.ts, price: p.price }];
        });
        return next;
      });
    });
    return unsub;
  }, []);

  return { priceSeries };
}
