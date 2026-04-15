"use client";
import NavBar from "../dashboard/NavBar";
import StrategyPanel from "../dashboard/StrategyPanel";
import StrategyTable from "../dashboard/StrategyTable";
import { useStrategy } from "../hooks/useStrategy";

export default function StrategyPage() {
  const { signals } = useStrategy();
  return (
    <div className="p-6 space-y-6">
      <NavBar />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Strategy</h1>
          <p className="text-sm text-slate-400">Qualification layers & live signals</p>
        </div>
      </div>
      <StrategyPanel />
      <StrategyTable signals={signals} />
    </div>
  );
}
