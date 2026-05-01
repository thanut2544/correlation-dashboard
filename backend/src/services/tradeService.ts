import { MT5CommandService } from "./mt5CommandService";
import { getRedisClient } from "../repositories/redisClient";
import { config } from "../config";

export type TradeIntent = {
  id: string;
  pair: [string, string];
  action: "open" | "close";
  direction?: "long-spread" | "short-spread";
  volume?: number;
  entryPrices?: [number, number];
  exitPrices?: [number, number];
  finalPnL?: number;
  ts: number;
  status: "pending" | "filled" | "cancelled" | "closed";
  mt5Status?: "pending" | "confirmed" | "failed";
  mt5Retcode?: number;
  mt5Comment?: string;
};

const REDIS_KEY = "trades:data";

export class TradeService {
  private trades: TradeIntent[] = [];
  private nextId = 1;
  /** Prevents duplicate close requests for the same pair arriving concurrently */
  private closingPairs = new Set<string>();

  constructor(private mt5Cmds?: MT5CommandService) { }

  /** Load persisted trades from Redis. Call once at startup before serving requests. */
  async initialize(): Promise<void> {
    if (!config.redisUrl) return;
    try {
      const raw = await getRedisClient().get(REDIS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { trades: TradeIntent[]; nextId: number };
        this.trades = parsed.trades ?? [];
        this.nextId = parsed.nextId ?? 1;
        console.log(`[TradeService] Loaded ${this.trades.length} trades from Redis`);
      }
    } catch (err) {
      console.error("[TradeService] Failed to load trades from Redis:", err);
    }
  }

  private async persist(): Promise<void> {
    if (!config.redisUrl) return;
    try {
      await getRedisClient().set(REDIS_KEY, JSON.stringify({ trades: this.trades, nextId: this.nextId }));
    } catch (err) {
      console.error("[TradeService] Failed to persist trades to Redis:", err);
    }
  }

  private pairKey(pair: [string, string]) {
    return `${pair[0]}:${pair[1]}`;
  }

  private getPipMultiplier(symbol: string): number {
    return symbol.includes("JPY") || symbol.includes("XAU") ? 100 : 10000;
  }

  async open(
    pair: [string, string],
    direction: "long-spread" | "short-spread",
    entryPrices: [number, number],
    volume = 0.01
  ): Promise<TradeIntent> {
    const trade: TradeIntent = {
      id: `T-${this.nextId++}`,
      pair,
      action: "open",
      direction,
      volume,
      entryPrices,
      ts: Date.now(),
      status: "pending",
      mt5Status: "pending",
    };
    this.trades.push(trade);
    console.log(`[TradeService] OPEN ${trade.id}: ${pair[0]}/${pair[1]} ${direction} vol=${volume}`);

    if (this.mt5Cmds) {
      if (direction === "long-spread") {
        this.mt5Cmds.executeTrade("buy", pair[0], volume, trade.id);
        this.mt5Cmds.executeTrade("sell", pair[1], volume, trade.id);
      } else {
        this.mt5Cmds.executeTrade("sell", pair[0], volume, trade.id);
        this.mt5Cmds.executeTrade("buy", pair[1], volume, trade.id);
      }
    }

    await this.persist();
    return trade;
  }

  async close(pair: [string, string], exitPrices: [number, number]): Promise<TradeIntent> {
    const key = this.pairKey(pair);
    if (this.closingPairs.has(key)) {
      throw new Error(`Close already in progress for ${key}`);
    }
    this.closingPairs.add(key);
    try {
      const trade: TradeIntent = {
        id: `T-${this.nextId++}`,
        pair,
        action: "close",
        exitPrices,
        ts: Date.now(),
        status: "filled",
        mt5Status: "pending",
      };
      this.trades.push(trade);
      console.log(`[TradeService] CLOSE ${trade.id}: ${pair[0]}/${pair[1]}`);

      if (this.mt5Cmds) {
        this.mt5Cmds.executeTrade("close", pair[0], undefined, trade.id);
        this.mt5Cmds.executeTrade("close", pair[1], undefined, trade.id);
      }

      const openTrades = this.trades.filter(
        (t) => t.pair[0] === pair[0] && t.pair[1] === pair[1] && t.action === "open" && t.status !== "closed"
      );
      for (const ot of openTrades) {
        ot.status = "closed";
        ot.exitPrices = exitPrices;
        if (ot.entryPrices) {
          const [eA, eB] = ot.entryPrices;
          const [xA, xB] = exitPrices;
          const multA = this.getPipMultiplier(ot.pair[0]);
          const multB = this.getPipMultiplier(ot.pair[1]);
          if (ot.direction === "long-spread") {
            ot.finalPnL = (xA - eA) * multA + (eB - xB) * multB;
          } else {
            ot.finalPnL = (eA - xA) * multA + (xB - eB) * multB;
          }
          console.log(`[TradeService] Normalized PnL for ${ot.id}: ${ot.finalPnL.toFixed(2)} Pips`);
        }
      }

      await this.persist();
      return trade;
    } finally {
      this.closingPairs.delete(key);
    }
  }

  /** อัพเดต MT5 execution status จาก EA confirmation */
  confirmMT5(tradeId: string, retcode: number, comment: string): void {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade) {
      console.warn(`[TradeService] confirmMT5: trade ${tradeId} not found`);
      return;
    }
    trade.mt5Retcode = retcode;
    trade.mt5Comment = comment;
    // retcode 10009 = TRADE_RETCODE_DONE (MT5 success code)
    trade.mt5Status = retcode === 10009 ? "confirmed" : "failed";
    console.log(
      `[TradeService] MT5 Confirm ${tradeId}: ${trade.mt5Status} (retcode=${retcode}, ${comment})`
    );
    this.persist();
  }

  list(): TradeIntent[] {
    return [...this.trades];
  }

  getById(id: string): TradeIntent | undefined {
    return this.trades.find((t) => t.id === id);
  }
}
