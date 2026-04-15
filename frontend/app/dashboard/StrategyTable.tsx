"use client";
import classNames from "classnames";
import { useRouter } from "next/navigation";
import { StrategySignal } from "../hooks/useStrategy";

function DirectionTag({ dir }: { dir: StrategySignal["direction"] }) {
  const map = {
    "long-spread": { label: "Long Spread", class: "bg-emerald-500/20 text-emerald-200" },
    "short-spread": { label: "Short Spread", class: "bg-rose-500/20 text-rose-200" },
    none: { label: "None", class: "bg-slate-700 text-slate-200" },
  } as const;
  const info = map[dir];
  return <span className={classNames("px-2 py-0.5 rounded text-xs font-semibold", info.class)}>{info.label}</span>;
}

export default function StrategyTable({ signals }: { signals: StrategySignal[] }) {
  const router = useRouter();

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Strategy Signals</div>
          <div className="text-lg font-semibold text-slate-50">Entry Qualification</div>
        </div>
        <div className="text-xs text-slate-400">Live from strategy service</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/60 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">Pair</th>
              <th className="px-3 py-2 text-left">Dir</th>
              <th className="px-3 py-2 text-left">r (S/M)</th>
              <th className="px-3 py-2 text-left">Z</th>
              <th className="px-3 py-2 text-left">RSI A/B</th>
              <th className="px-3 py-2 text-left">ATR</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {signals.map(sig => (
              <tr 
                key={`${sig.pair[0]}-${sig.pair[1]}`} 
                onClick={() => {
                  window.open(`/trade/${sig.pair[0]}-${sig.pair[1]}`, "_blank");
                }}
                className={classNames(
                  "border-b border-slate-800/70 cursor-pointer hover:bg-slate-800 transition",
                  !sig.qualified && "opacity-80"
                )}
              >
                <td className="px-3 py-2 font-semibold text-slate-50 flex items-center gap-2">
                  {sig.pair[0]} / {sig.pair[1]}
                  <span className="text-[10px] text-slate-400">▶ Trade</span>
                </td>
                <td className="px-3 py-2">
                  <DirectionTag dir={sig.direction} />
                </td>
                <td className="px-3 py-2 text-slate-200">
                  {sig.metrics.rShort.toFixed(2)} / {sig.metrics.rMid.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-slate-200">{sig.metrics.z.toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-200">
                  {sig.metrics.rsiA.toFixed(1)} / {sig.metrics.rsiB.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-slate-200">{sig.metrics.atrSpread.toFixed(5)}</td>
                <td className="px-3 py-2 text-slate-200">
                  {sig.qualified ? (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-200">
                      Qualified
                    </span>
                  ) : (
                    <div className="text-xs text-amber-200 space-y-0.5">
                      {sig.reasons.slice(0, 2).map(r => (
                        <div key={r}>• {r}</div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
