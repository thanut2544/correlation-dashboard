"use client";
import React from "react";
import { useLivePrices } from "../hooks/useLivePrices";
import { TradeIntent } from "../hooks/useTrades";
import classNames from "classnames";

export default function PositionsTable({ trades }: { trades: TradeIntent[] }) {
  const { priceSeries } = useLivePrices();

  const activePositions = trades.filter(t => t.action === "open" && t.status === "pending");

  if (activePositions.length === 0) return null;

  const getPipMultiplier = (symbol: string) => {
    return symbol.includes("JPY") || symbol.includes("XAU") ? 100 : 10000;
  };

  const calculatePnL = (trade: TradeIntent): number | null => {
    if (!trade.entryPrices) return null;
    const [entryA, entryB] = trade.entryPrices;
    const [symA, symB] = trade.pair;
    const multA = getPipMultiplier(symA);
    const multB = getPipMultiplier(symB);

    const latestA = priceSeries[symA]?.slice(-1)[0]?.price;
    const latestB = priceSeries[symB]?.slice(-1)[0]?.price;

    // Return null instead of 0 when prices haven't arrived yet
    if (latestA === undefined || latestB === undefined) return null;

    if (trade.direction === "long-spread") {
      return (latestA - entryA) * multA + (entryB - latestB) * multB;
    } else if (trade.direction === "short-spread") {
      return (entryA - latestA) * multA + (latestB - entryB) * multB;
    }
    return null;
  };

  const totalPnL = activePositions.reduce((acc, t) => {
    const p = calculatePnL(t);
    return p !== null ? acc + p : acc;
  }, 0);

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-50">Active Positions</h2>
          <p className="text-xs text-slate-400">Real-time theoretical PnL (Price Points)</p>
        </div>
        <div className={classNames(
          "px-4 py-2 rounded-lg font-bold text-lg border",
          totalPnL >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        )}>
          Total: {totalPnL.toFixed(5)}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>
              <th className="pb-2 text-left">Trade ID</th>
              <th className="pb-2 text-left">Pair</th>
              <th className="pb-2 text-left">Direction</th>
              <th className="pb-2 text-right">Entry Prices</th>
              <th className="pb-2 text-right">PnL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {activePositions.map(t => {
              const pnl = calculatePnL(t);
              return (
                <tr key={t.id} className="text-slate-300">
                  <td className="py-2 font-mono text-xs">{t.id}</td>
                  <td className="py-2 font-semibold text-slate-100">{t.pair[0]} / {t.pair[1]}</td>
                  <td className="py-2">
                    <span className={classNames(
                      "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                      t.direction === "long-spread" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                    )}>
                      {t.direction}
                    </span>
                  </td>
                  <td className="py-2 text-right text-xs">
                    {t.entryPrices?.[0].toFixed(5)} / {t.entryPrices?.[1].toFixed(5)}
                  </td>
                  <td className={classNames(
                    "px-4 py-3 text-right font-bold",
                    pnl === null ? "text-slate-500" : pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {pnl === null ? (
                      <span className="text-slate-500 text-xs">---</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span>{pnl >= 0 ? "+" : ""}{pnl.toFixed(1)} Pips</span>
                        <span className="text-[10px] opacity-60">
                          ≈ {pnl >= 0 ? "+" : ""}${(pnl * 0.1).toFixed(2)}
                        </span>
                      </div>
                    )}
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
