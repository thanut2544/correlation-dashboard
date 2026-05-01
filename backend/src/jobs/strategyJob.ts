import { StrategyService } from "../services/strategyService";
import { StreamService } from "../services/streamService";
import { TradeService, TradeIntent } from "../services/tradeService";
import { DailyRiskManager } from "../services/dailyRiskManager";
import { AIContextService } from "../services/aiContextService";
import { config } from "../config";

const aiCtxSvc = new AIContextService();

export function startStrategyJob(
  strategy: StrategyService,
  stream: StreamService,
  tradeSvc: TradeService,
  dailyRisk: DailyRiskManager,
  initialDelayMs = 0
) {
  const run = async () => {
    try {
      // ── Reset daily counters ถ้าวันใหม่ (Bangkok midnight) ───────────────
      dailyRisk.resetIfNewDay();

      // ── Evaluate strategy signals ────────────────────────────────────────
      const signals = await strategy.evaluate();

      const openTrades = tradeSvc.list().filter(
        (t: TradeIntent) => t.action === "open" && t.status === "pending"
      );
      const allTrades = tradeSvc.list();
      const dailyStats = dailyRisk.getDailyStats(openTrades.length);

      // ── เพิ่ม AI context เข้า signal แต่ละตัว ───────────────────────────
      for (const signal of signals) {
        signal.aiContext = aiCtxSvc.build(
          signal.pair,
          signal.direction,
          signal.qualified,
          { ...signal.metrics },
          allTrades,
          {
            dailyPnL: dailyStats.dailyPnL,
            dailyTarget: dailyStats.dailyTarget,
            currentLotSize: dailyStats.currentLotSize,
            isPocketMode: dailyStats.isPocketMode,
          }
        );
      }

      stream.sendStrategy(signals);

      // ── Broadcast daily risk stats ───────────────────────────────────────
      stream.sendDailyRisk(dailyStats);

      // ── Auto-open: qualified signals → open new positions ────────────────
      for (const signal of signals) {
        if (!signal.qualified || signal.direction === "none") continue;

        const isOpen = openTrades.some(
          (t: TradeIntent) => t.pair[0] === signal.pair[0] && t.pair[1] === signal.pair[1]
        );
        if (isOpen) continue;

        if (!dailyRisk.canTrade(openTrades.length)) {
          const reason = dailyRisk.getBlockReason(openTrades.length);
          console.log(`[strategyJob] Auto-open blocked (${reason}): ${signal.pair.join("/")}`);
          continue;
        }

        const volume = dailyRisk.calculateLotSize();
        const conf = signal.aiContext?.confidence ?? 0;
        console.log(
          `[strategyJob] Auto-open: ${signal.pair.join("/")} → ${signal.direction} ` +
          `vol=${volume} AI-confidence=${conf}/100`
        );
        await tradeSvc.open(signal.pair, signal.direction, [signal.metrics.priceA, signal.metrics.priceB], volume);
        stream.sendTrades(tradeSvc.list());
      }

      // ── Auto-close: stop-loss ก่อน, แล้ว take-profit ───────────────────
      const activeTrades = tradeSvc.list().filter(
        (t: TradeIntent) => t.action === "open" && t.status === "pending"
      );
      for (const trade of activeTrades) {
        const signal = signals.find(
          (s) => s.pair[0] === trade.pair[0] && s.pair[1] === trade.pair[1]
        );
        if (!signal) continue;

        const z = Math.abs(signal.metrics.z);

        if (z >= config.strategy.zStopLoss) {
          console.log(`[strategyJob] STOP LOSS: ${trade.pair.join("/")} (|Z|=${z.toFixed(2)} >= SL=${config.strategy.zStopLoss})`);
          try {
            await tradeSvc.close(trade.pair, [signal.metrics.priceA, signal.metrics.priceB]);
            const closedTrades = tradeSvc.list().filter(
              t => t.pair[0] === trade.pair[0] && t.pair[1] === trade.pair[1] &&
                   t.action === "open" && t.status === "closed" && t.finalPnL !== undefined
            );
            for (const ct of closedTrades) {
              if (ct.finalPnL !== undefined) dailyRisk.recordPnL(ct.finalPnL);
            }
            stream.sendTrades(tradeSvc.list());
            stream.sendDailyRisk(dailyRisk.getDailyStats(activeTrades.length - 1));
          } catch (err) {
            console.warn(`[strategyJob] Close skipped (in-flight): ${err}`);
          }
        } else if (z <= config.strategy.zTakeProfit) {
          console.log(`[strategyJob] TAKE PROFIT: ${trade.pair.join("/")} (|Z|=${z.toFixed(2)} <= TP=${config.strategy.zTakeProfit})`);
          try {
            await tradeSvc.close(trade.pair, [signal.metrics.priceA, signal.metrics.priceB]);
            const closedTrades = tradeSvc.list().filter(
              t => t.pair[0] === trade.pair[0] && t.pair[1] === trade.pair[1] &&
                   t.action === "open" && t.status === "closed" && t.finalPnL !== undefined
            );
            for (const ct of closedTrades) {
              if (ct.finalPnL !== undefined) dailyRisk.recordPnL(ct.finalPnL);
            }
            stream.sendTrades(tradeSvc.list());
            stream.sendDailyRisk(dailyRisk.getDailyStats(activeTrades.length - 1));
          } catch (err) {
            console.warn(`[strategyJob] Close skipped (in-flight): ${err}`);
          }
        }
      }
    } catch (err) {
      console.error("[strategyJob] Error:", err);
    }
  };

  setTimeout(run, initialDelayMs);
  return setInterval(run, config.strategy.intervalMs);
}
