"use client";
import React, { useState } from "react";
import { useRiskManager } from "../hooks/useRiskManager";
import { useTrades } from "../hooks/useTrades";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: "emerald" | "rose";
}) {
  const pct = Math.min(100, Math.max(0, Math.abs(value) / Math.max(max, 0.001) * 100));
  return (
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color === "emerald" ? "bg-emerald-500" : "bg-rose-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function DailyRiskPanel() {
  const { stats } = useRiskManager();
  const { trades } = useTrades();
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const openCount = trades.filter(t => t.action === "open" && t.status === "pending").length;

  const handleCloseAll = async () => {
    if (!confirm(`ปิด ${openCount} position ทั้งหมด?`)) return;
    setClosing(true);
    try {
      const res = await fetch(`${API}/trade/close-all`, { method: "POST" });
      const data = await res.json();
      setToast(`ปิดสำเร็จ ${data.closed} position`);
    } catch {
      setToast("เกิดข้อผิดพลาด");
    } finally {
      setClosing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (!stats) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
        <div className="h-3 bg-slate-800 rounded w-1/2" />
      </div>
    );
  }

  const pnlPct = Math.min(100, Math.abs(stats.dailyPnL) / stats.dailyTarget * 100);
  const ddPct  = Math.min(100, Math.abs(Math.min(0, stats.dailyPnL)) / stats.dailyDrawdown * 100);
  const isProfit = stats.dailyPnL >= 0;

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 shadow p-4 space-y-4">
      {/* Toast */}
      {toast && (
        <div className="text-xs text-center py-1.5 px-3 rounded bg-slate-800 text-slate-300 border border-slate-700">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Risk Monitor</div>
          <div className="text-lg font-semibold text-slate-50">Daily Risk Status</div>
        </div>
        <div className="flex items-center gap-2">
          {openCount > 0 && (
            <button
              onClick={handleCloseAll}
              disabled={closing}
              className="px-3 py-1 rounded text-xs font-bold bg-rose-800/60 hover:bg-rose-700 text-rose-200 border border-rose-700/50 transition disabled:opacity-50"
            >
              {closing ? "กำลังปิด..." : `✕ Close All (${openCount})`}
            </button>
          )}
          {stats.isPocketMode && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              💰 Pocket Mode
            </span>
          )}
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${stats.canTrade
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
          }`}>
            {stats.canTrade ? "🟢 TRADING ACTIVE" : "🔴 BLOCKED"}
          </span>
        </div>
      </div>

      {/* Block reason */}
      {!stats.canTrade && stats.blockReason && (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-3 py-2">
          ⚠️ {stats.blockReason}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Daily P&L vs Target */}
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Daily P&L</span>
            <span className={isProfit ? "text-emerald-400" : "text-rose-400"}>
              {isProfit ? "+" : ""}{stats.dailyPnL.toFixed(1)} / {stats.dailyTarget} pips
            </span>
          </div>
          <ProgressBar value={Math.max(0, stats.dailyPnL)} max={stats.dailyTarget} color="emerald" />
          <div className="text-right text-[10px] text-slate-500">{pnlPct.toFixed(0)}% of target</div>
        </div>

        {/* Drawdown */}
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Drawdown Used</span>
            <span className={ddPct > 70 ? "text-rose-400" : "text-slate-300"}>
              {Math.abs(Math.min(0, stats.dailyPnL)).toFixed(1)} / {stats.dailyDrawdown} pips
            </span>
          </div>
          <ProgressBar value={Math.abs(Math.min(0, stats.dailyPnL))} max={stats.dailyDrawdown} color="rose" />
          <div className="text-right text-[10px] text-slate-500">{ddPct.toFixed(0)}% of limit</div>
        </div>
      </div>

      {/* Position & Lot info */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-800/40 rounded-lg py-2 px-3">
          <div className="text-sm font-bold text-slate-100">
            {stats.tradesCount}
          </div>
          <div className="text-[10px] text-slate-400">Trades Today</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg py-2 px-3">
          <div className="text-sm font-bold text-slate-100">
            {stats.maxConcurrent}
          </div>
          <div className="text-[10px] text-slate-400">Max Pairs</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg py-2 px-3">
          <div className="text-sm font-bold text-amber-300">
            {stats.currentLotSize.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400">Lot Size</div>
        </div>
      </div>
    </div>
  );
}
