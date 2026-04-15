import { StrategyService } from "../services/strategyService";
import { StreamService } from "../services/streamService";
import { TradeService, TradeIntent } from "../services/tradeService";
import { config } from "../config";

export function startStrategyJob(strategy: StrategyService, stream: StreamService, tradeSvc: TradeService) {
  const run = async () => {
    try {
      const signals = await strategy.evaluate();
      stream.sendStrategy(signals);

      // Auto-trade: open new positions for qualified signals
      const openTrades = tradeSvc.list().filter((t: TradeIntent) => t.action === "open");
      for (const signal of signals) {
        if (signal.qualified && signal.direction !== "none") {
          const isOpen = openTrades.some(
            (t: TradeIntent) => t.pair[0] === signal.pair[0] && t.pair[1] === signal.pair[1]
          );
          if (!isOpen) {
            console.log(`[strategyJob] Auto-open: ${signal.pair.join("/")} -> ${signal.direction}`);
            await tradeSvc.open(signal.pair, signal.direction, [signal.metrics.priceA, signal.metrics.priceB]);
            stream.broadcast("trades:update", tradeSvc.list());
          }
        }
      }

      // Auto-close: check stop-loss first, then take-profit
      const activeTrades = tradeSvc.list().filter(
        (t: TradeIntent) => t.action === "open" && t.status === "pending"
      );
      for (const trade of activeTrades) {
        const signal = signals.find(
          (s) => s.pair[0] === trade.pair[0] && s.pair[1] === trade.pair[1]
        );
        if (!signal) continue;

        const z = Math.abs(signal.metrics.z);

        // Stop-loss check FIRST — spread is diverging further
        if (z >= config.strategy.zStopLoss) {
          console.log(`[strategyJob] STOP LOSS: ${trade.pair.join("/")} (|Z|=${z.toFixed(2)} >= SL=${config.strategy.zStopLoss})`);
          try {
            await tradeSvc.close(trade.pair, [signal.metrics.priceA, signal.metrics.priceB]);
            stream.broadcast("trades:update", tradeSvc.list());
          } catch (err) {
            console.warn(`[strategyJob] Close skipped (in-flight): ${err}`);
          }
        }
        // Take-profit — spread has reverted to neutral
        else if (z <= config.strategy.zTakeProfit) {
          console.log(`[strategyJob] TAKE PROFIT: ${trade.pair.join("/")} (|Z|=${z.toFixed(2)} <= TP=${config.strategy.zTakeProfit})`);
          try {
            await tradeSvc.close(trade.pair, [signal.metrics.priceA, signal.metrics.priceB]);
            stream.broadcast("trades:update", tradeSvc.list());
          } catch (err) {
            console.warn(`[strategyJob] Close skipped (in-flight): ${err}`);
          }
        }
      }
    } catch (err) {
      console.error("[strategyJob] Error:", err);
    }
  };

  run();
  return setInterval(run, config.correlationIntervalMs);
}
