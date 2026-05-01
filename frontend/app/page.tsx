"use client";
import { useStrategy } from "./hooks/useStrategy";
import { useTrades } from "./hooks/useTrades";
import { useRiskManager } from "./hooks/useRiskManager";
import { useLivePrices } from "./hooks/useLivePrices";
import DailyRiskPanel from "./dashboard/DailyRiskPanel";
import classNames from "classnames";

// ── Signal badge ──────────────────────────────────────────────────────────────
function SignalBadge({ dir, qualified }: { dir: string; qualified: boolean }) {
  if (!qualified || dir === "none") {
    return <span className="text-xs text-slate-600">—</span>;
  }
  return (
    <span className={classNames(
      "px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide",
      dir === "long-spread"
        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
    )}>
      {dir === "long-spread" ? "▲ Long" : "▼ Short"}
    </span>
  );
}

// ── Correlation badge ─────────────────────────────────────────────────────────
function CorrBadge({ r }: { r: number }) {
  const color =
    r >= 0.85 ? "text-emerald-400" :
    r >= 0.7  ? "text-amber-400" :
    "text-slate-500";
  return <span className={`font-mono text-sm font-semibold ${color}`}>{r.toFixed(2)}</span>;
}

// ── Z-Score bar ───────────────────────────────────────────────────────────────
function ZBar({ z }: { z: number }) {
  const abs = Math.min(Math.abs(z), 4);
  const pct = (abs / 4) * 100;
  const color = abs >= 2.5 ? (z > 0 ? "bg-rose-500" : "bg-emerald-500") : "bg-slate-600";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={classNames("font-mono text-xs", abs >= 2.5 ? "text-slate-200" : "text-slate-500")}>
        {z >= 0 ? "+" : ""}{z.toFixed(2)}
      </span>
    </div>
  );
}

export default function PairsPage() {
  const { signals } = useStrategy();
  const { trades } = useTrades();
  const { stats } = useRiskManager();
  const { priceSeries } = useLivePrices();

  const openPairKeys = new Set(
    trades
      .filter(t => t.action === "open" && t.status === "pending")
      .map(t => `${t.pair[0]}:${t.pair[1]}`)
  );

  const qualifiedCount = signals.filter(s => s.qualified).length;
  const totalPairs = signals.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Currency Pairs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalPairs} pairs monitored · {qualifiedCount > 0
              ? <span className="text-emerald-400 font-medium">{qualifiedCount} qualified</span>
              : "no signal yet"
            } · 15M timeframe
          </p>
        </div>
        <div className="text-right text-xs text-slate-600 font-mono">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* ── Daily Risk Panel ─────────────────────────────────────────────── */}
      <DailyRiskPanel />

      {/* ── Pairs Table ─────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-300">All Pairs</span>
          <span className="text-xs text-slate-600">Click any row to trade</span>
        </div>

        {signals.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📡</div>
            <div className="text-slate-400 font-medium">Waiting for live data from MT5 EA...</div>
            <div className="text-slate-600 text-sm mt-1">EA must be running & connected to Named Pipe</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Pair</th>
                  <th className="px-4 py-3 text-left">Price A / B</th>
                  <th className="px-4 py-3 text-left">Corr (S/M)</th>
                  <th className="px-4 py-3 text-left">Z-Score</th>
                  <th className="px-4 py-3 text-left">RSI A/B</th>
                  <th className="px-4 py-3 text-left">Signal</th>
                  <th className="px-4 py-3 text-center">AI Conf</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {signals.map(sig => {
                  const key = `${sig.pair[0]}:${sig.pair[1]}`;
                  const isOpen = openPairKeys.has(key);
                  const priceA = priceSeries[sig.pair[0]]?.slice(-1)[0]?.price;
                  const priceB = priceSeries[sig.pair[1]]?.slice(-1)[0]?.price;

                  return (
                    <tr
                      key={key}
                      onClick={() => window.open(`/trade?a=${sig.pair[0]}&b=${sig.pair[1]}`, "_blank")}
                      className={classNames(
                        "cursor-pointer transition-all duration-150 group",
                        isOpen
                          ? "bg-emerald-950/30 hover:bg-emerald-950/50"
                          : sig.qualified
                          ? "hover:bg-slate-800/60"
                          : "opacity-70 hover:opacity-100 hover:bg-slate-800/40"
                      )}
                    >
                      {/* Pair */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {isOpen && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                          )}
                          <div>
                            <div className="font-bold text-slate-100 group-hover:text-white">
                              {sig.pair[0]} <span className="text-slate-600">/</span> {sig.pair[1]}
                            </div>
                            <div className="text-[10px] text-slate-600 mt-0.5">▶ tap to trade</div>
                          </div>
                        </div>
                      </td>

                      {/* Prices */}
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-400">
                        <div>{priceA ? priceA.toFixed(5) : <span className="text-slate-700">—</span>}</div>
                        <div>{priceB ? priceB.toFixed(5) : <span className="text-slate-700">—</span>}</div>
                      </td>

                      {/* Correlation */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <CorrBadge r={sig.metrics.rShort} />
                          <span className="text-slate-700">/</span>
                          <CorrBadge r={sig.metrics.rMid} />
                        </div>
                      </td>

                      {/* Z-Score */}
                      <td className="px-4 py-3.5">
                        <ZBar z={sig.metrics.z} />
                      </td>

                      {/* RSI */}
                      <td className="px-4 py-3.5 font-mono text-xs">
                        <span className={classNames(
                          sig.metrics.rsiA > 65 ? "text-rose-400" : sig.metrics.rsiA < 35 ? "text-emerald-400" : "text-slate-500"
                        )}>
                          {sig.metrics.rsiA.toFixed(0)}
                        </span>
                        <span className="text-slate-700 mx-1">/</span>
                        <span className={classNames(
                          sig.metrics.rsiB > 65 ? "text-rose-400" : sig.metrics.rsiB < 35 ? "text-emerald-400" : "text-slate-500"
                        )}>
                          {sig.metrics.rsiB.toFixed(0)}
                        </span>
                      </td>

                      {/* Signal */}
                      <td className="px-4 py-3.5">
                        <SignalBadge dir={sig.direction} qualified={sig.qualified} />
                      </td>

                      {/* AI Confidence */}
                      <td className="px-4 py-3.5 text-center">
                        {sig.aiContext ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className={`font-bold text-sm font-mono ${
                              sig.aiContext.confidence >= 70 ? "text-emerald-400" :
                              sig.aiContext.confidence >= 45 ? "text-amber-400" :
                              sig.aiContext.confidence > 0   ? "text-rose-400" :
                              "text-slate-600"
                            }`}>
                              {sig.aiContext.confidence > 0 ? `${sig.aiContext.confidence}` : "—"}
                            </span>
                            {sig.aiContext.confidence > 0 && (
                              <div className="w-8 h-0.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    sig.aiContext.confidence >= 70 ? "bg-emerald-500" :
                                    sig.aiContext.confidence >= 45 ? "bg-amber-500" : "bg-rose-500"
                                  }`}
                                  style={{ width: `${sig.aiContext.confidence}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-700 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {isOpen ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            ● OPEN
                          </span>
                        ) : sig.qualified ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            ✦ SIGNAL
                          </span>
                        ) : (
                          <span className="text-xs text-slate-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Reasons panel for non-qualified ─────────────────────────────── */}
      {signals.some(s => !s.qualified) && (
        <details className="card px-5 py-4">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-300 transition">
            Why some pairs are not qualified ▾
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {signals.filter(s => !s.qualified).map(s => (
              <div key={`${s.pair[0]}-${s.pair[1]}`} className="bg-slate-800/40 rounded-lg px-3 py-2">
                <div className="text-xs font-semibold text-slate-400 mb-1">{s.pair[0]} / {s.pair[1]}</div>
                {s.reasons.map(r => (
                  <div key={r} className="text-[11px] text-slate-600">• {r}</div>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
