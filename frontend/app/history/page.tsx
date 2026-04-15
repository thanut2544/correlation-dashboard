"use client";
import NavBar from "../dashboard/NavBar";
import HistoryTable from "../dashboard/HistoryTable";
import { useTrades } from "../hooks/useTrades";

export default function HistoryPage() {
  const { trades } = useTrades();

  return (
    <div className="p-6 space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Trade History</h1>
          <p className="text-sm text-slate-400">Closed positions and historical performance</p>
        </div>
      </header>

      <NavBar />

      <HistoryTable trades={trades} />
    </div>
  );
}
