"use client";
import { useEffect, useRef } from "react";
import { createChart, ISeriesApi, ColorType } from "lightweight-charts";

type PricePoint = { ts: number; price: number };
type Candle = { time: number; open: number; high: number; low: number; close: number };

function toCandles(series: PricePoint[], bucketMs = 60_000): Candle[] {
  if (!series.length) return [];
  const buckets: Record<number, PricePoint[]> = {};
  series.forEach(p => {
    const t = Math.floor(p.ts / bucketMs) * bucketMs;
    if (!buckets[t]) buckets[t] = [];
    buckets[t].push(p);
  });
  return Object.entries(buckets)
    .map(([t, points]) => {
      const open = points[0].price;
      const close = points[points.length - 1].price;
      let high = points[0].price;
      let low = points[0].price;
      points.forEach(p => {
        if (p.price > high) high = p.price;
        if (p.price < low) low = p.price;
      });
      return { time: Number(t) / 1000, open, high, low, close };
    })
    .sort((a, b) => a.time - b.time);
}

export default function CandleChart({ symbol, series }: { symbol: string; series: PricePoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!chartRef.current) {
      chartRef.current = createChart(containerRef.current, {
        height: 260,
        layout: { background: { type: ColorType.Solid, color: "#0f172a" }, textColor: "#cbd5e1" },
        grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
        timeScale: { timeVisible: true, secondsVisible: false },
        rightPriceScale: { borderVisible: false },
      });
      candleSeriesRef.current = chartRef.current.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
        borderVisible: false,
      });
    }
    const candles = toCandles(series);
    candleSeriesRef.current?.setData(candles);
    chartRef.current?.timeScale().fitContent();
  }, [series]);

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-slate-50">{symbol} Candles</div>
        <div className="text-xs text-slate-400">1m buckets</div>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
