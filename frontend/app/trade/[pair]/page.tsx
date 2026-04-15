"use client";

import { useParams, useRouter } from "next/navigation";
import NavBar from "../../dashboard/NavBar";
import PairOverlayChart from "../../dashboard/PairOverlayChart";
import { useLivePrices } from "../../hooks/useLivePrices";
import { useStrategy } from "../../hooks/useStrategy";
import { useMemo, useState } from "react";
import classNames from "classnames";

export default function TradeExecutionPage() {
  const params = useParams() as { pair: string };
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Format EURUSD-GBPUSD into ["EURUSD", "GBPUSD"]
  const pairs = params.pair ? params.pair.split("-") : [];
  const symbolA = pairs[0];
  const symbolB = pairs[1];

  const { priceSeries } = useLivePrices();
  const { signals } = useStrategy();

  const arrA = priceSeries[symbolA] || [];
  const arrB = priceSeries[symbolB] || [];

  const priceA = arrA.length ? arrA[arrA.length - 1].price : undefined;
  const priceB = arrB.length ? arrB[arrB.length - 1].price : undefined;

  const currentSignal = useMemo(() => {
    return signals.find(s => s.pair[0] === symbolA && s.pair[1] === symbolB);
  }, [signals, symbolA, symbolB]);

  const handleOpenTrade = async (manualDirection: "long-spread" | "short-spread") => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/trade/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair: [symbolA, symbolB], direction: manualDirection })
      });
      if (res.ok) {
        alert(`Order executed for ${symbolA}/${symbolB} [${manualDirection}]`);
        router.push("/");
      } else {
        alert("Failed to submit trade");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting trade");
    } finally {
      setLoading(false);
    }
  };

  if (!symbolA || !symbolB) {
    return <div className="p-6">Invalid Pair Route</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <button 
              onClick={() => router.push("/")}
              className="text-slate-500 hover:text-slate-300 transition"
            >
              ←
            </button>
            {symbolA} vs {symbolB}
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-10">Trade Execution Setup</p>
        </div>
      </header>

      <NavBar />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <PairOverlayChart pair={[symbolA, symbolB]} seriesA={arrA} seriesB={arrB} />
          
          <div className="mt-4 flex gap-4 text-sm text-slate-300">
            <div className="bg-slate-950 px-3 py-2 rounded">
              <span className="text-slate-500 mr-2">{symbolA}</span> 
              <span className="font-semibold text-slate-50">{priceA ? priceA.toFixed(5) : "---"}</span>
            </div>
            <div className="bg-slate-950 px-3 py-2 rounded">
              <span className="text-slate-500 mr-2">{symbolB}</span> 
              <span className="font-semibold text-slate-50">{priceB ? priceB.toFixed(5) : "---"}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center space-y-8">
          <div className="text-center w-full">
            <div className="text-slate-400 uppercase text-xs font-semibold tracking-wider mb-2">Algorithm Signal</div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg w-full flex flex-col items-center justify-center">
              {currentSignal && currentSignal.direction !== "none" ? (
                <>
                  <div className={classNames(
                    "text-xl font-bold px-4 py-1 rounded-full mb-3",
                    currentSignal.direction === "short-spread" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                  )}>
                    {currentSignal.direction === "short-spread" ? "SHORT SPREAD" : "LONG SPREAD"}
                  </div>
                  <div className="flex justify-between w-full text-sm text-slate-300 border-t border-slate-800 pt-3">
                    <span>Z-Score:</span>
                    <span className="font-mono text-slate-50">{currentSignal.metrics.z.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="text-slate-500 text-sm">No qualified signal</div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <div className="flex gap-3">
              <button 
                disabled={loading}
                onClick={() => handleOpenTrade("long-spread")}
                className={classNames(
                  "flex-1 py-4 text-center text-sm md:text-base font-bold rounded transition text-white shadow",
                  currentSignal?.direction === "long-spread" ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50 ring-2 ring-emerald-400" : "bg-slate-700 hover:bg-slate-600"
                )}
              >
                LONG SPREAD {currentSignal?.direction === "long-spread" && "✨"}
              </button>
              <button 
                disabled={loading}
                onClick={() => handleOpenTrade("short-spread")}
                className={classNames(
                  "flex-1 py-4 text-center text-sm md:text-base font-bold rounded transition text-white shadow",
                  currentSignal?.direction === "short-spread" ? "bg-rose-600 hover:bg-rose-500 shadow-rose-900/50 ring-2 ring-rose-400" : "bg-slate-700 hover:bg-slate-600"
                )}
              >
                SHORT SPREAD {currentSignal?.direction === "short-spread" && "✨"}
              </button>
            </div>
            
            <button 
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/trade/close`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pair: [symbolA, symbolB] })
                  });
                  if (res.ok) alert(`Positions closed for ${symbolA}/${symbolB}`);
                  else alert("Failed to close positions");
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full py-2 text-center text-sm font-semibold rounded bg-slate-800 hover:bg-slate-700 transition text-slate-300 border border-slate-700"
            >
              Close All Positions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
