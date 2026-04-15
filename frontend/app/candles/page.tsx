"use client";
import NavBar from "../dashboard/NavBar";
import CandleChart from "../dashboard/CandleChart";
import { useLivePrices } from "../hooks/useLivePrices";

export default function CandlesPage() {
  const { priceSeries } = useLivePrices();
  return (
    <div className="p-6 space-y-6">
      <NavBar />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Candles</h1>
          <p className="text-sm text-slate-400">1m buckets per pair</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(priceSeries).map(([symbol, series]) => (
          <CandleChart key={symbol} symbol={symbol} series={series} />
        ))}
      </div>
    </div>
  );
}
