"use client";
import { useTrades } from "../hooks/useTrades";
import { useRiskManager } from "../hooks/useRiskManager";
import { TradeIntent } from "../hooks/useTrades";
import classNames from "classnames";

// ── เอา trades ของวันนี้ (UTC) ────────────────────────────────────────────────
function getTodayTrades(trades: TradeIntent[]) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  return trades.filter(t => t.ts >= todayStart.getTime());
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={classNames("text-2xl font-bold", color || "text-slate-100")}>{value}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SummaryPage() {
  const { trades } = useTrades();
  const { stats } = useRiskManager();

  const todayAll = getTodayTrades(trades);
  const todayClosed = todayAll.filter(t => t.action === "open" && t.status === "closed");
  const todayOpen   = todayAll.filter(t => t.action === "open" && t.status === "pending");

  const totalPnL = todayClosed.reduce((s, t) => s + (t.finalPnL ?? 0), 0);
  const winners  = todayClosed.filter(t => (t.finalPnL ?? 0) > 0).length;
  const losers   = todayClosed.filter(t => (t.finalPnL ?? 0) <= 0).length;
  const winRate  = todayClosed.length > 0 ? (winners / todayClosed.length) * 100 : 0;

  const allClosed = trades.filter(t => t.action === "open" && t.status === "closed");
  const allWinRate = allClosed.length > 0
    ? (allClosed.filter(t => (t.finalPnL ?? 0) > 0).length / allClosed.length) * 100
    : 0;

  const today = new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Daily Summary</h1>
        <p className="text-sm text-slate-500 mt-0.5">{today}</p>
      </div>

      {/* ── MT5 Direct Data Notice ──────────────────────────────────────── */}
      <div className="card px-5 py-4 border-amber-800/40 bg-amber-950/20">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">ℹ️</span>
          <div>
            <div className="text-sm font-semibold text-amber-300 mb-1">ข้อมูลจาก Backend — ไม่ใช่ MT5 โดยตรง</div>
            <div className="text-xs text-slate-400 space-y-1">
              <p>MT5 ไม่มี REST API ดึงข้อมูลโดยตรงได้ ข้อมูลที่แสดงมาจาก TradeService ของ backend ซึ่งบันทึกทุก trade ที่ผ่านระบบนี้</p>
              <p className="text-slate-500">แนวทางเพิ่มเติมถ้าต้องการข้อมูล MT5 จริง:</p>
              <ul className="text-slate-600 pl-3 space-y-0.5">
                <li>• EA ส่ง trade history ผ่าน Named Pipe ตอน OnDeinit หรือ OnTradeTransaction</li>
                <li>• เพิ่ม <code className="bg-slate-800 px-1 rounded text-[10px]">POST /api/mt5/history</code> endpoint รับ JSON จาก EA</li>
                <li>• Export report จาก MT5 แล้ว import เข้าระบบ (manual)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── Today Stats ─────────────────────────────────────────────────── */}
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">วันนี้</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total P&L (Pips)"
            value={`${totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(1)}`}
            sub={stats ? `Target: ${stats.dailyTarget} pips` : undefined}
            color={totalPnL > 0 ? "text-emerald-400" : totalPnL < 0 ? "text-rose-400" : "text-slate-400"}
          />
          <StatCard
            label="Closed Trades"
            value={`${todayClosed.length}`}
            sub={`${winners}W / ${losers}L`}
          />
          <StatCard
            label="Win Rate"
            value={`${winRate.toFixed(0)}%`}
            sub={todayClosed.length === 0 ? "No trades yet" : undefined}
            color={winRate >= 60 ? "text-emerald-400" : winRate >= 40 ? "text-amber-400" : "text-rose-400"}
          />
          <StatCard
            label="Open Positions"
            value={`${todayOpen.length}`}
            sub={stats ? `Max: ${stats.maxConcurrent}` : undefined}
            color={todayOpen.length > 0 ? "text-amber-300" : undefined}
          />
        </div>
      </div>

      {/* ── Daily Risk Progress ─────────────────────────────────────────── */}
      {stats && (
        <div className="card p-5 space-y-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Risk Gates</div>
          <div className="space-y-3">
            {/* Target */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Daily Target Progress</span>
                <span className="text-emerald-400 font-mono">
                  {Math.max(0, stats.dailyPnL).toFixed(1)} / {stats.dailyTarget} pips
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, stats.dailyPnL) / stats.dailyTarget * 100)}%` }}
                />
              </div>
            </div>
            {/* Drawdown */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Drawdown Used</span>
                <span className="text-rose-400 font-mono">
                  {Math.abs(Math.min(0, stats.dailyPnL)).toFixed(1)} / {stats.dailyDrawdown} pips
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.abs(Math.min(0, stats.dailyPnL)) / stats.dailyDrawdown * 100)}%` }}
                />
              </div>
            </div>
          </div>
          <div className={classNames(
            "text-center py-2 rounded-lg text-sm font-semibold",
            stats.canTrade ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
          )}>
            {stats.canTrade ? "🟢 Trading Active" : `🔴 Blocked — ${stats.blockReason}`}
          </div>
        </div>
      )}

      {/* ── Today trade breakdown ────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <span className="text-sm font-semibold text-slate-300">วันนี้ — รายละเอียด Trade</span>
        </div>
        {todayClosed.length === 0 ? (
          <div className="p-8 text-center text-slate-600">ยังไม่มี trade ที่ปิดวันนี้</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-600 uppercase border-b border-slate-800">
                <th className="px-5 py-2.5 text-left">เวลา</th>
                <th className="px-4 py-2.5 text-left">Pair</th>
                <th className="px-4 py-2.5 text-left">Dir</th>
                <th className="px-4 py-2.5 text-right">Entry</th>
                <th className="px-4 py-2.5 text-right">Exit</th>
                <th className="px-4 py-2.5 text-right">P&L</th>
                <th className="px-4 py-2.5 text-center">MT5</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {todayClosed.sort((a, b) => b.ts - a.ts).map(t => {
                const pnl = t.finalPnL ?? 0;
                return (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3 text-xs text-slate-600 font-mono">
                      {new Date(t.ts).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      {t.pair[0]}/{t.pair[1]}
                    </td>
                    <td className="px-4 py-3">
                      <span className={classNames(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        t.direction === "long-spread"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-rose-500/20 text-rose-300"
                      )}>
                        {t.direction === "long-spread" ? "▲ Long" : "▼ Short"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-slate-500">
                      {t.entryPrices?.[0].toFixed(5)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-slate-500">
                      {t.exitPrices?.[0].toFixed(5) ?? "—"}
                    </td>
                    <td className={classNames(
                      "px-4 py-3 text-right font-bold font-mono",
                      pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}
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
        {/* Footer: total */}
        {todayClosed.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-600">Total ({todayClosed.length} trades)</span>
            <span className={classNames(
              "font-bold font-mono",
              totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(1)} pips
              <span className="text-slate-600 font-normal text-xs ml-2">
                ≈ ${((todayClosed[0]?.volume ?? 0.01) * totalPnL * 10).toFixed(2)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── All-time stats ───────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">ภาพรวมทั้งหมด (All-time)</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xl font-bold text-slate-100">{allClosed.length}</div>
            <div className="text-xs text-slate-600">Total Trades</div>
          </div>
          <div>
            <div className={classNames(
              "text-xl font-bold",
              allClosed.reduce((s, t) => s + (t.finalPnL ?? 0), 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {allClosed.reduce((s, t) => s + (t.finalPnL ?? 0), 0) >= 0 ? "+" : ""}
              {allClosed.reduce((s, t) => s + (t.finalPnL ?? 0), 0).toFixed(1)}
            </div>
            <div className="text-xs text-slate-600">Total Pips</div>
          </div>
          <div>
            <div className={classNames(
              "text-xl font-bold",
              allWinRate >= 55 ? "text-emerald-400" : allWinRate >= 40 ? "text-amber-400" : "text-rose-400"
            )}>
              {allWinRate.toFixed(0)}%
            </div>
            <div className="text-xs text-slate-600">Win Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}
