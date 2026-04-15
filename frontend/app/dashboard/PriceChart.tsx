"use client";
import { Line } from "react-chartjs-2";
import { Chart, LineElement, PointElement, LinearScale, TimeScale, Tooltip } from "chart.js";
import "chartjs-adapter-date-fns";
Chart.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip);

export default function PriceChart({ symbol, series }: { symbol: string; series: { ts: number; price: number }[] }) {
  return (
    <div className="bg-slate-900 p-3 rounded-lg">
      <div className="font-semibold mb-1">{symbol}</div>
      <Line
        data={{
          labels: series.map(p => p.ts),
          datasets: [{ label: "Price", data: series.map(p => p.price), borderColor: "#38bdf8", pointRadius: 0 }],
        }}
        options={{
          animation: false,
          scales: { x: { type: "time", time: { unit: "minute" } }, y: { ticks: { color: "#cbd5e1" } } },
          plugins: { legend: { display: false } },
        }}
      />
    </div>
  );
}
