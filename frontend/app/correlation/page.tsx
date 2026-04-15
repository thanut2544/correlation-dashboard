"use client";
import NavBar from "../dashboard/NavBar";
import CorrelationChart from "../dashboard/CorrelationChart";
import CorrelationTable from "../dashboard/CorrelationTable";
import ThresholdBadge from "../dashboard/ThresholdBadge";
import { useCorrelation } from "../hooks/useCorrelation";
import { useStrategy } from "../hooks/useStrategy";
import StrategyTable from "../dashboard/StrategyTable";
import PairOverlayChart from "../dashboard/PairOverlayChart";
import { useLivePrices } from "../hooks/useLivePrices";

export default function CorrelationPage() {
  const { correlations } = useCorrelation();
  const { signals } = useStrategy();
  const { priceSeries } = useLivePrices();

  const pairCards = correlations.map(c => {
    const [a, b] = c.pair;
    return { pair: c.pair, aSeries: priceSeries[a] || [], bSeries: priceSeries[b] || [] };
  });
  return (
    <div className="p-6 space-y-6">
      <NavBar />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Correlation</h1>
          <p className="text-sm text-slate-400">Pearson r live across pairs</p>
        </div>
        <ThresholdBadge />
      </div>
      <CorrelationChart data={correlations} />
      <CorrelationTable data={correlations} />
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-200">Correlation Signals (all pairs)</div>
        <StrategyTable signals={signals} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pairCards.map(card => (
          <PairOverlayChart
            key={`${card.pair[0]}-${card.pair[1]}`}
            pair={card.pair}
            seriesA={card.aSeries || []}
            seriesB={card.bSeries || []}
          />
        ))}
      </div>
    </div>
  );
}
