"use client";
import classNames from "classnames";

type CorrelationRow = {
  pair: [string, string];
  value: number;
  thresholdBreached: boolean;
};

function signalLabel(value: number) {
  if (value > 0.8) return { label: "Strong+", tone: "buy" };
  if (value < -0.5) return { label: "Strong-", tone: "sell" };
  return { label: "Neutral", tone: "neutral" };
}

export default function CorrelationTable({ data }: { data: CorrelationRow[] }) {
  return (
    <div className="bg-slate-900 rounded-lg shadow border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-wide text-slate-400">Pairs View</div>
          <div className="text-lg font-semibold text-slate-50">Correlation Signals</div>
        </div>
        <div className="text-xs text-slate-400">Live from backend</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/60 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">Asset 1</th>
              <th className="px-3 py-2 text-left">Corr</th>
              <th className="px-3 py-2 text-left">Asset 2</th>
              <th className="px-3 py-2 text-left">Signal</th>
              <th className="px-3 py-2 text-left">AI</th>
              <th className="px-3 py-2 text-left">Trade Ops</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const sig = signalLabel(row.value);
              const corrPct = (row.value * 100).toFixed(1) + "%";
              return (
                <tr key={`${row.pair[0]}-${row.pair[1]}-${idx}`} className="border-b border-slate-800/70">
                  <td className="px-3 py-2 font-medium text-slate-50">{row.pair[0]}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={classNames(
                          "px-2 py-0.5 rounded text-xs font-semibold",
                          row.value > 0
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-rose-500/20 text-rose-200"
                        )}
                      >
                        {corrPct}
                      </span>
                      <div className="h-2 w-24 bg-slate-800 rounded overflow-hidden">
                        <div
                          className={classNames("h-full", row.value > 0 ? "bg-emerald-500" : "bg-rose-500")}
                          style={{ width: `${Math.min(Math.abs(row.value), 1) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-50">{row.pair[1]}</td>
                  <td className="px-3 py-2">
                    <span
                      className={classNames(
                        "px-2 py-0.5 rounded text-xs font-semibold",
                        sig.tone === "buy" && "bg-emerald-500/20 text-emerald-200",
                        sig.tone === "sell" && "bg-rose-500/20 text-rose-200",
                        sig.tone === "neutral" && "bg-slate-700 text-slate-200"
                      )}
                    >
                      {sig.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.thresholdBreached ? (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-200">
                        A
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={async () => {
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/trade/open`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ pair: row.pair, direction: row.value > 0 ? "short-spread" : "long-spread" })
                          });
                          if (res.ok) alert(`Trade opened for ${row.pair.join("/")}`);
                          else alert("Failed to open trade");
                        }}
                        className="px-2 py-1 rounded border border-slate-700 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition"
                      >
                        Open
                      </button>
                      <button 
                        onClick={async () => {
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/trade/close`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ pair: row.pair })
                          });
                          if (res.ok) alert(`Trade closed for ${row.pair.join("/")}`);
                          else alert("Failed to close trade");
                        }}
                        className="px-2 py-1 rounded border border-slate-700 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition"
                      >
                        Close
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
