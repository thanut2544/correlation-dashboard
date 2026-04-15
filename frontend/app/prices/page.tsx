"use client";
import NavBar from "../dashboard/NavBar";
import PriceChart from "../dashboard/PriceChart";
import { useLivePrices } from "../hooks/useLivePrices";

export default function PricesPage() {
  const { priceSeries } = useLivePrices();
  return (
    <div className="p-6 space-y-6">
      <NavBar />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prices</h1>
          <p className="text-sm text-slate-400">Live line charts per pair</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(priceSeries).map(([symbol, series]) => (
          <PriceChart key={symbol} symbol={symbol} series={series} />
        ))}
      </div>
    </div>
  );
}
