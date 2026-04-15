"use client";
import React from "react";
import { TradeIntent } from "../hooks/useTrades";
import classNames from "classnames";

export default function HistoryTable({ trades }: { trades: TradeIntent[] }) {
  const closedTrades = trades
    .filter(t => t.status === "closed")
    .sort((a, b) => b.ts - a.ts);

  if (closedTrades.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8 text-center text-slate-400">
        No completed trades yet.
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/20">
        <h2 className="text-lg font-bold text-slate-50">Trade History</h2>
        <p className="text-xs text-slate-400">Past executions and finalized results</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/40 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-2 text-left">Time</th>
              <th className="px-4 py-2 text-left">Pair</th>
              <th className="px-4 py-2 text-left">Dir</th>
              <th className="px-4 py-2 text-right">Entry / Exit</th>
              <th className="px-4 py-2 text-right">Final PnL (Pips)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {closedTrades.map(t => {
              const date = new Date(t.ts).toLocaleTimeString();
              const pnl = t.finalPnL || 0;
              return (
                <tr key={t.id} className="text-slate-300 hover:bg-slate-800/30 transition">
                  <td className="px-4 py-2 text-xs text-slate-500">{date}</td>
                  <td className="px-4 py-2 font-semibold text-slate-100">{t.pair[0]} / {t.pair[1]}</td>
                  <td className="px-4 py-2">
                    <span className={classNames(
                      "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                      t.direction === "long-spread" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                    )}>
                      {t.direction}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-slate-400">
                    {t.entryPrices?.[0].toFixed(5)} / {t.exitPrices?.[0].toFixed(5)}
                  </td>
                  <td className={classNames(
                    "px-4 py-2 text-right font-bold",
                    pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    <div className="flex flex-col items-end">
                      <span>{pnl >= 0 ? "+" : ""}{pnl.toFixed(1)} Pips</span>
                      <span className="text-[10px] opacity-60">
                        ≈ {pnl >= 0 ? "+" : ""}${(pnl * 0.1).toFixed(2)}
                      </span>
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
