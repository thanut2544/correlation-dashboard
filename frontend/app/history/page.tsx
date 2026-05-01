"use client";
import { useTrades } from "../hooks/useTrades";
import { TradeIntent } from "../hooks/useTrades";
import classNames from "classnames";

export default function HistoryPage() {
  const { trades } = useTrades();

  const closed = trades
    .filter(t => t.action === "open" && t.status === "closed")
    .sort((a, b) => b.ts - a.ts);

  const totalPnL = closed.reduce((s, t) => s + (t.finalPnL ?? 0), 0);
  const winners = closed.filter(t => (t.finalPnL ?? 0) > 0).length;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Trade History</h1>
          <p className="text-sm text-slate-500 mt-0.5">Closed positions from this session</p>
        </div>
        {closed.length > 0 && (
          <div className="text-right">
            <div className={classNames(
              "text-xl font-bold font-mono",
              totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(1)} pips
            </div>
            <div className="text-xs text-slate-600">
              {closed.length} trades · {closed.length > 0 ? Math.round(winners / closed.length * 100) : 0}% win rate
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {closed.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🗂️</div>
            <div className="text-slate-400">No closed trades yet</div>
            <div className="text-slate-600 text-sm mt-1">Trades appear here after they are closed</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-600 uppercase border-b border-slate-800">
                <th className="px-5 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Pair</th>
                <th className="px-4 py-3 text-left">Direction</th>
                <th className="px-4 py-3 text-right">Lot</th>
                <th className="px-4 py-3 text-right">Entry A</th>
                <th className="px-4 py-3 text-right">Exit A</th>
                <th className="px-4 py-3 text-right">P&L</th>
                <th className="px-4 py-3 text-center">MT5</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {closed.map(t => {
                const pnl = t.finalPnL ?? 0;
                return (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition group">
                    <td className="px-5 py-3 text-xs text-slate-600 font-mono">
                      {new Date(t.ts).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      {t.pair[0]}<span className="text-slate-600">/</span>{t.pair[1]}
                    </td>
                    <td className="px-4 py-3">
                      <span className={classNames(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                        t.direction === "long-spread"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-rose-500/20 text-rose-300"
                      )}>
                        {t.direction === "long-spread" ? "▲ Long" : "▼ Short"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-amber-300">
                      {(t.volume ?? 0.01).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                      {t.entryPrices?.[0]?.toFixed(5) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                      {t.exitPrices?.[0]?.toFixed(5) ?? "—"}
                    </td>
                    <td className={classNames(
                      "px-4 py-3 text-right font-bold font-mono",
                      pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                      <div>{pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}</div>
                      <div className="text-[10px] opacity-50 font-normal">
                        ${((t.volume ?? 0.01) * pnl * 10).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={classNames(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                        t.mt5Status === "confirmed" ? "text-emerald-400 border-emerald-700 bg-emerald-950/40" :
                        t.mt5Status === "failed" ? "text-rose-400 border-rose-700 bg-rose-950/40" :
                        "text-slate-600 border-slate-800"
                      )}>
                        {t.mt5Status ?? "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
