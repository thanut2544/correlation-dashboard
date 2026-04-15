"use client";

const sections = [
  {
    title: "Correlation Qualification",
    items: [
      "Pearson rolling: short vs mid horizon",
      "Stability: |r_short - r_mid| small, low r_short volatility",
      "Only trade when correlation is steady",
    ],
  },
  {
    title: "Mean Reversion",
    items: [
      "Spread + Z-Score; enter when |Z| > threshold",
      "Higher Z for counter-trend entries",
      "Revert toward spread mean as core edge",
    ],
  },
  {
    title: "Trend Alignment",
    items: [
      "EMA50/EMA200 to avoid fighting macro trend",
      "Counter-trend allowed only with stronger Z",
    ],
  },
  {
    title: "Momentum Exhaustion",
    items: [
      "RSI/Stoch overbought or oversold",
      "Divergence between assets for extra conviction",
    ],
  },
  {
    title: "Volatility & Regime",
    items: [
      "ATR/StdDev filter: skip stressed regimes",
      "Avoid trades when vol too low or too high",
    ],
  },
  {
    title: "Time & Session",
    items: [
      "Only London/NY sessions",
      "Avoid illiquid or news-driven periods",
    ],
  },
  {
    title: "Entry Timing",
    items: [
      "Qualified pair first, then trigger",
      "Trigger via candle close or momentum shift",
    ],
  },
  {
    title: "Exit & Risk",
    items: [
      "Exit when spread snaps back or correlation decays",
      "Time stop and emergency vol/news exit",
      "Basket limits: cap concurrent pairs and drawdown",
    ],
  },
];

export default function StrategyPanel() {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Strategy Layer</div>
          <div className="text-lg font-semibold text-slate-50">Decision Checklist</div>
        </div>
        <span className="text-xs text-slate-400">Entry is gated by all layers</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {sections.map(section => (
          <div key={section.title} className="bg-slate-800/60 rounded-lg border border-slate-800 p-3">
            <div className="text-sm font-semibold text-slate-100 mb-2">{section.title}</div>
            <ul className="space-y-1 text-xs text-slate-300">
              {section.items.map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
