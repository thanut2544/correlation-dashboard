"use client";
import NavBar from "./dashboard/NavBar";
import ThresholdBadge from "./dashboard/ThresholdBadge";
import StrategyTable from "./dashboard/StrategyTable";
import PositionsTable from "./dashboard/PositionsTable";
import { useStrategy } from "./hooks/useStrategy";
import { useTrades } from "./hooks/useTrades";

export default function DashboardPage() {
  const { signals } = useStrategy();
  const { trades } = useTrades();

  return (
    <div className="p-6 space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">FX Correlation Dashboard</h1>
          <p className="text-sm text-slate-400">Live Entry Qualification & Performance</p>
        </div>
        <ThresholdBadge />
      </header>

      <NavBar />

      <PositionsTable trades={trades} />

      <StrategyTable signals={signals} />
    </div>
  );
}
