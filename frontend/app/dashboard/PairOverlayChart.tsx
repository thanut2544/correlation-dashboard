"use client";
import { Line } from "react-chartjs-2";
import {
  Chart,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
} from "chart.js";
import "chartjs-adapter-date-fns";

Chart.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend);

type PricePoint = { ts: number; price: number };

export default function PairOverlayChart({
  pair,
  seriesA,
  seriesB,
}: {
  pair: [string, string];
  seriesA: PricePoint[];
  seriesB: PricePoint[];
}) {
  const [a, b] = pair;
  const norm = (series: PricePoint[]) => {
    if (!series.length) return [];
    const base = series[0].price || 1;
    return series.map(p => ({ x: p.ts, y: ((p.price - base) / base) * 100 }));
  };
  const normA = norm(seriesA);
  const normB = norm(seriesB);

  const data = {
    datasets: [
      {
        label: a,
        data: normA,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.15)",
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: b,
        data: normB,
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56,189,248,0.15)",
        pointRadius: 0,
        tension: 0.2,
      },
    ],
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-slate-50">
          {a} vs {b}
        </div>
        <div className="text-xs text-slate-400">Overlay price view</div>
      </div>
      <Line
        data={data}
        options={{
          parsing: false,
          animation: false,
          scales: {
            x: { type: "time", time: { unit: "minute" }, grid: { color: "#1e293b" } },
            y: {
              grid: { color: "#1e293b" },
              ticks: {
                color: "#cbd5e1",
                callback: (v: any) => `${v}%`,
              },
              title: { display: true, text: "Normalized % from start", color: "#cbd5e1" },
            },
          },
          plugins: { legend: { labels: { color: "#cbd5e1" } } },
        }}
      />
    </div>
  );
}
