"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useLivePrices } from "../hooks/useLivePrices";
import { useStrategy } from "../hooks/useStrategy";
import { useTrades } from "../hooks/useTrades";
import { useRiskManager } from "../hooks/useRiskManager";
import { useMemo, useState, Suspense } from "react";
import classNames from "classnames";
import PairOverlayChart from "../dashboard/PairOverlayChart";
import AIBriefingPanel from "../dashboard/AIBriefingPanel";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// แยก component ที่ใช้ useSearchParams ออกมา (Next.js static export requirement)
function TradeContent() {
  const router = useRouter();
  const params = useSearchParams();
  const symA = params.get("a") ?? "";
  const symB = params.get("b") ?? "";

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const { priceSeries } = useLivePrices();
  const { signals } = useStrategy();
  const { trades } = useTrades();
  const { stats } = useRiskManager();

  const priceA = priceSeries[symA]?.slice(-1)[0]?.price;
  const priceB = priceSeries[symB]?.slice(-1)[0]?.price;
  const arrA = priceSeries[symA] || [];
  const arrB = priceSeries[symB] || [];

  const signal = useMemo(
    () => signals.find(s => s.pair[0] === symA && s.pair[1] === symB),
    [signals, symA, symB]
  );

  const openTrade = trades.find(
    t => t.action === "open" && t.status === "pending" && t.pair[0] === symA && t.pair[1] === symB
  );

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleOpen = async (dir: "long-spread" | "short-spread") => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/trade/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair: [symA, symB], direction: dir }),
      });
      const data = await res.json();
      if (res.ok) showToast(`Trade opened: ${dir}`, true);
      else showToast(`${data.error || "Failed to open trade"}`, false);
    } catch {
      showToast("Network error", false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/trade/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair: [symA, symB] }),
      });
      const data = await res.json();
      if (res.ok) showToast("Positions closed", true);
      else showToast(`${data.error || "Failed to close"}`, false);
    } catch {
      showToast("Network error", false);
    } finally {
      setLoading(false);
    }
  };

  if (!symA || !symB) {
    return (
      <div className="text-slate-400 p-8 text-center">
        <div className="text-2xl mb-2">⚠️</div>
        <div>ไม่พบคู่เงิน — กลับหน้าหลักแล้วคลิกคู่ที่ต้องการ</div>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-4 py-2 bg-slate-700 rounded-lg text-sm hover:bg-slate-600 transition"
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  const blocked = stats && !stats.canTrade;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Toast */}
      {toast && (
        <div className={classNames(
          "fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold border",
          toast.ok
            ? "bg-emerald-900/90 border-emerald-600 text-emerald-200"
            : "bg-rose-900/90 border-rose-600 text-rose-200"
        )}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/")}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 transition text-slate-400 hover:text-white"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-50">
            {symA} <span className="text-slate-600">/</span> {symB}
          </h1>
          <p className="text-xs text-slate-500">Pair Trade · 15M · Correlation Strategy</p>
        </div>
        {openTrade && (
          <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Position Open
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Chart + AI + Metrics */}
        <div className="lg:col-span-2 space-y-4">
          {/* Chart */}
          <div className="card p-4">
            <PairOverlayChart pair={[symA, symB]} seriesA={arrA} seriesB={arrB} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[{ sym: symA, price: priceA }, { sym: symB, price: priceB }].map(({ sym, price }) => (
                <div key={sym} className="bg-slate-800/60 rounded-lg px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold">{sym}</span>
                  <span className="font-mono text-slate-100 text-sm font-bold">
                    {price ? price.toFixed(5) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Briefing */}
          {signal?.aiContext && <AIBriefingPanel ctx={signal.aiContext} />}

          {/* Signal Metrics */}
          {signal && (
            <div className="card p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Signal Metrics</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Corr Short", value: signal.metrics.rShort.toFixed(3) },
                  { label: "Corr Mid",   value: signal.metrics.rMid.toFixed(3) },
                  { label: "Z-Score",    value: signal.metrics.z.toFixed(3), highlight: Math.abs(signal.metrics.z) >= 2.5 },
                  { label: "RSI A",      value: signal.metrics.rsiA.toFixed(1) },
                  { label: "RSI B",      value: signal.metrics.rsiB.toFixed(1) },
                  { label: "ATR Spread", value: signal.metrics.atrSpread.toFixed(5) },
                  { label: "EMA Fast A", value: signal.metrics.emaFastA.toFixed(5) },
                  { label: "EMA Slow A", value: signal.metrics.emaSlowA.toFixed(5) },
                ].map(m => (
                  <div key={m.label} className="bg-slate-800/40 rounded-lg px-3 py-2.5 text-center">
                    <div className="text-[10px] text-slate-600 mb-1">{m.label}</div>
                    <div className={classNames(
                      "font-mono text-sm font-semibold",
                      (m as any).highlight ? "text-amber-300" : "text-slate-200"
                    )}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
              {!signal.qualified && (
                <div className="mt-3 text-xs space-y-1">
                  {signal.reasons.map(r => (
                    <div key={r} className="flex items-start gap-2 text-slate-500">
                      <span className="text-amber-600 mt-0.5">•</span> {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Trade Panel */}
        <div className="space-y-4">
          {/* Algorithm Signal */}
          <div className="card p-5 text-center space-y-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Algorithm Signal</div>
            {signal?.qualified && signal.direction !== "none" ? (
              <div className={classNames(
                "py-3 px-4 rounded-xl font-bold text-lg",
                signal.direction === "long-spread"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
              )}>
                {signal.direction === "long-spread" ? "▲ LONG SPREAD" : "▼ SHORT SPREAD"}
              </div>
            ) : (
              <div className="py-3 px-4 rounded-xl bg-slate-800/50 text-slate-500 text-sm">
                No qualified signal
              </div>
            )}
            {signal && (
              <div className="text-xs text-slate-600">
                |Z| = {Math.abs(signal.metrics.z).toFixed(2)} · threshold 2.5
              </div>
            )}
          </div>

          {/* Daily Risk */}
          {stats && (
            <div className={classNames("card p-4 text-sm space-y-2", !stats.canTrade && "border-rose-800/50")}>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">Daily Risk</span>
                <span className={classNames("text-xs font-bold", stats.canTrade ? "text-emerald-400" : "text-rose-400")}>
                  {stats.canTrade ? "🟢 Active" : "🔴 Blocked"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">P&L Today</span>
                <span className={stats.dailyPnL >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {stats.dailyPnL >= 0 ? "+" : ""}{stats.dailyPnL.toFixed(1)} / {stats.dailyTarget} pips
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Lot Size</span>
                <span className="text-amber-300 font-mono">{stats.currentLotSize.toFixed(2)}</span>
              </div>
              {!stats.canTrade && (
                <div className="text-[11px] text-rose-500 bg-rose-500/10 rounded px-2 py-1.5">
                  {stats.blockReason}
                </div>
              )}
            </div>
          )}

          {/* Trade Controls */}
          <div className="card p-4 space-y-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Manual Trade</div>
            {openTrade ? (
              <>
                <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-4 py-3 text-sm">
                  <div className="text-emerald-400 font-semibold">Position Open</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Dir: {openTrade.direction} · Vol: {(openTrade.volume ?? 0.01).toFixed(2)} lot
                  </div>
                  <div className="text-xs text-slate-500">
                    MT5: <span className={classNames(
                      openTrade.mt5Status === "confirmed" ? "text-emerald-400" :
                      openTrade.mt5Status === "failed"    ? "text-rose-400" : "text-amber-400"
                    )}>{openTrade.mt5Status}</span>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-rose-800 hover:bg-rose-700 text-white border border-rose-700 transition disabled:opacity-50"
                >
                  {loading ? "Closing..." : "✕ Close Position"}
                </button>
              </>
            ) : (
              <>
                {blocked && (
                  <div className="text-[11px] text-rose-500 bg-rose-500/10 rounded px-2 py-1.5 text-center mb-2">
                    Trading blocked by risk manager
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpen("long-spread")}
                    disabled={loading || !!blocked}
                    className={classNames(
                      "py-4 rounded-xl font-bold text-sm transition border disabled:opacity-40",
                      signal?.direction === "long-spread"
                        ? "bg-emerald-700 hover:bg-emerald-600 border-emerald-500 text-white"
                        : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-300"
                    )}
                  >
                    ▲ Long
                    {signal?.direction === "long-spread" && (
                      <div className="text-[10px] opacity-70 mt-0.5">✦ Recommended</div>
                    )}
                  </button>
                  <button
                    onClick={() => handleOpen("short-spread")}
                    disabled={loading || !!blocked}
                    className={classNames(
                      "py-4 rounded-xl font-bold text-sm transition border disabled:opacity-40",
                      signal?.direction === "short-spread"
                        ? "bg-rose-700 hover:bg-rose-600 border-rose-500 text-white"
                        : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-rose-300"
                    )}
                  >
                    ▼ Short
                    {signal?.direction === "short-spread" && (
                      <div className="text-[10px] opacity-70 mt-0.5">✦ Recommended</div>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="text-slate-400 p-8 text-center">Loading...</div>}>
      <TradeContent />
    </Suspense>
  );
}
