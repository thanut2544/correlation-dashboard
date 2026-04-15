"use client";
import { Line } from "react-chartjs-2";
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip } from "chart.js";
Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip);

export default function CorrelationChart({ data }: { data: { pair: [string, string]; value: number; ts: number }[] }) {
  const labels = data.map(d => `${d.pair[0]}-${d.pair[1]}`);
  const values = data.map(d => d.value);
  return (
    <div className="bg-slate-900 p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Correlation</h2>
        <span className="text-xs text-slate-400">-1 to +1</span>
      </div>
      <Line
        data={{
          labels,
          datasets: [
            { label: "Pearson r", data: values, borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.15)", tension: 0.3 },
          ],
        }}
        options={{ scales: { y: { min: -1, max: 1 } }, plugins: { legend: { display: false } } }}
      />
    </div>
  );
}
