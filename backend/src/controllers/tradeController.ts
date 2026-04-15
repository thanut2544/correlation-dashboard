import { Request, Response } from "express";
import { TradeService } from "../services/tradeService";
import { PriceService } from "../services/priceService";
import { config } from "../config";

export const makeTradeController = (svc: TradeService, priceSvc: PriceService) => ({
  open: async (req: Request, res: Response) => {
    try {
      const { pair, direction } = req.body;
      if (!pair || !Array.isArray(pair) || pair.length !== 2) {
        return res.status(400).json({ error: "pair must be [string, string]" });
      }
      if (
        typeof pair[0] !== "string" || !config.symbols.includes(pair[0]) ||
        typeof pair[1] !== "string" || !config.symbols.includes(pair[1])
      ) {
        return res.status(400).json({ error: "pair symbols must be in the configured symbols list" });
      }
      if (!direction || !["long-spread", "short-spread"].includes(direction)) {
        return res.status(400).json({ error: "direction must be 'long-spread' or 'short-spread'" });
      }

      const pA = await priceSvc.latest(pair[0]);
      const pB = await priceSvc.latest(pair[1]);
      if (!pA || !pB) {
        return res.status(400).json({ error: "No price data available for one or both symbols" });
      }

      const trade = await svc.open(pair as [string, string], direction, [pA.price, pB.price]);
      res.json({ trade });
    } catch (err) {
      console.error("[tradeController] open error:", err);
      res.status(500).json({ error: "Failed to open trade" });
    }
  },

  close: async (req: Request, res: Response) => {
    try {
      const { pair } = req.body;
      if (!pair || !Array.isArray(pair) || pair.length !== 2) {
        return res.status(400).json({ error: "pair must be [string, string]" });
      }

      const pA = await priceSvc.latest(pair[0]);
      const pB = await priceSvc.latest(pair[1]);
      if (!pA || !pB) {
        return res.status(400).json({ error: "No price data available for one or both symbols" });
      }

      const trade = await svc.close(pair as [string, string], [pA.price, pB.price]);
      res.json({ trade });
    } catch (err: any) {
      if (err?.message?.includes("already in progress")) {
        return res.status(409).json({ error: err.message });
      }
      console.error("[tradeController] close error:", err);
      res.status(500).json({ error: "Failed to close trade" });
    }
  },

  list: async (_: Request, res: Response) => {
    try {
      res.json({ trades: svc.list() });
    } catch (err) {
      console.error("[tradeController] list error:", err);
      res.status(500).json({ error: "Failed to list trades" });
    }
  },
});
