"use client";
import React, { useState } from "react";
import { AIContext } from "../hooks/useStrategy";
import classNames from "classnames";

// ── Confidence ring ───────────────────────────────────────────────────────────
function ConfidenceRing({ score }: { score: number }) {
  const color =
    score >= 70 ? "text-emerald-400 stroke-emerald-400" :
    score >= 45 ? "text-amber-400 stroke-amber-400" :
    "text-rose-400 stroke-rose-400";

  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" className="stroke-slate-800" />
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={classNames("transition-all duration-700", color.split(" ")[1])}
        />
      </svg>
      <div className={classNames("relative text-base font-bold", color.split(" ")[0])}>
        {score}
      </div>
    </div>
  );
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
function Tag({ label, variant }: { label: string; variant: "green" | "amber" | "red" | "slate" }) {
  const cls = {
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    red:   "bg-rose-500/15 text-rose-300 border-rose-500/25",
    slate: "bg-slate-700/50 text-slate-400 border-slate-700",
  }[variant];
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cls}`}>
      {label}
    </span>
  );
}

// ── Result dots ───────────────────────────────────────────────────────────────
function ResultDots({ results }: { results: ("W" | "L")[] }) {
  if (results.length === 0) return <span className="text-slate-600 text-xs">ยังไม่มีประวัติ</span>;
  return (
    <div className="flex gap-1 items-center">
      {results.map((r, i) => (
        <span
          key={i}
          className={classNames(
            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
            r === "W" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AIBriefingPanel({ ctx }: { ctx: AIContext }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(ctx.promptPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const corrColor =
    ctx.snapshot.correlationStrength === "strong" ? "green" :
    ctx.snapshot.correlationStrength === "moderate" ? "amber" : "red";

  const spreadColor =
    ctx.snapshot.spreadCondition === "overbought" ? "red" :
    ctx.snapshot.spreadCondition === "oversold" ? "green" : "slate";

  return (
    <div className="card p-4 space-y-4 border border-violet-800/30 bg-violet-950/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-sm font-semibold text-slate-200">AI Briefing</span>
          <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">
            ข้อมูลพร้อมส่ง AI
          </span>
        </div>
        <div className="flex items-center gap-2">
          {ctx.readyForAI ? (
            <Tag label="Ready" variant="green" />
          ) : (
            <Tag label="ประวัติน้อย" variant="amber" />
          )}
        </div>
      </div>

      {/* Confidence + Snapshot */}
      <div className="flex items-center gap-4">
        <ConfidenceRing score={ctx.confidence} />
        <div className="flex-1 space-y-2">
          <div className="text-xs text-slate-500">Rule-based Confidence</div>
          <div className="flex flex-wrap gap-1.5">
            <Tag label={ctx.snapshot.correlationStrength} variant={corrColor} />
            <Tag
              label={ctx.snapshot.correlationStable ? "Stable" : "Unstable"}
              variant={ctx.snapshot.correlationStable ? "green" : "red"}
            />
            <Tag label={ctx.snapshot.spreadCondition} variant={spreadColor} />
            <Tag
              label={ctx.snapshot.momentumExhausted ? "Exhausted" : "No exhaustion"}
              variant={ctx.snapshot.momentumExhausted ? "green" : "slate"}
            />
            <Tag
              label={ctx.snapshot.trendAlignment}
              variant={ctx.snapshot.trendAlignment === "with-trend" ? "green" : "amber"}
            />
          </div>
          <div className="text-[10px] text-slate-600">
            Session: <span className="text-slate-400">{ctx.snapshot.session}</span>
          </div>
        </div>
      </div>

      {/* Trade History */}
      <div className="bg-slate-800/40 rounded-lg p-3 space-y-2">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">ประวัติคู่นี้</div>
        {ctx.history.totalTrades === 0 ? (
          <div className="text-xs text-slate-600">ยังไม่มีประวัติการเทรดของคู่นี้</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-slate-400">
                {ctx.history.wins}W / {ctx.history.losses}L
                <span className={classNames(
                  "ml-2 font-bold",
                  ctx.history.winRate >= 60 ? "text-emerald-400" :
                  ctx.history.winRate >= 40 ? "text-amber-400" : "text-rose-400"
                )}>
                  {ctx.history.winRate.toFixed(0)}%
                </span>
              </div>
              <div className="text-[10px] text-slate-600 mt-1">
                Avg W: <span className="text-emerald-400">+{ctx.history.avgWinPips.toFixed(1)}</span> pips ·
                Avg L: <span className="text-rose-400">{ctx.history.avgLossPips.toFixed(1)}</span> pips
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 mb-1">5 trades ล่าสุด</div>
              <ResultDots results={ctx.history.recentResults} />
            </div>
          </div>
        )}
      </div>

      {/* Risk snapshot */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-800/40 rounded-lg py-2 px-2">
          <div className={classNames(
            "text-sm font-bold",
            ctx.risk.dailyPnLPips >= 0 ? "text-emerald-400" : "text-rose-400"
          )}>
            {ctx.risk.dailyPnLPips >= 0 ? "+" : ""}{ctx.risk.dailyPnLPips.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-500">P&L วันนี้</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg py-2 px-2">
          <div className="text-sm font-bold text-slate-200">{ctx.risk.remainingPips.toFixed(0)}</div>
          <div className="text-[10px] text-slate-500">pips เหลือ</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg py-2 px-2">
          <div className="text-sm font-bold text-amber-300">{ctx.risk.lotSize.toFixed(2)}</div>
          <div className="text-[10px] text-slate-500">lot size</div>
        </div>
      </div>

      {/* Prompt preview toggle */}
      <div>
        <button
          onClick={() => setShowPrompt(v => !v)}
          className="w-full text-xs text-slate-500 hover:text-violet-400 transition flex items-center justify-between py-1 border-t border-slate-800"
        >
          <span>Prompt ที่จะส่ง AI</span>
          <span className="text-slate-700">{showPrompt ? "▲ ซ่อน" : "▼ ดู"}</span>
        </button>

        {showPrompt && (
          <div className="mt-2 relative">
            <pre className="text-[10px] text-slate-500 bg-slate-900 rounded-lg p-3 overflow-auto max-h-48 leading-relaxed whitespace-pre-wrap font-mono border border-slate-800">
              {ctx.promptPreview}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded bg-slate-700 hover:bg-violet-700 text-slate-300 transition"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
