import { Request, Response } from "express";
import { PriceService } from "../services/priceService";

export const makePriceController = (svc: PriceService) => ({
  listSymbols: (_: Request, res: Response) => {
    try {
      res.json({ symbols: svc.symbols() });
    } catch (err) {
      console.error("[priceController] listSymbols error:", err);
      res.status(500).json({ error: "Failed to list symbols" });
    }
  },
  latest: async (req: Request, res: Response) => {
    try {
      res.json({ latest: await svc.latest(req.params.symbol) });
    } catch (err) {
      console.error("[priceController] latest error:", err);
      res.status(500).json({ error: "Failed to get latest price" });
    }
  },
  history: async (req: Request, res: Response) => {
    try {
      res.json({ history: await svc.history(req.params.symbol) });
    } catch (err) {
      console.error("[priceController] history error:", err);
      res.status(500).json({ error: "Failed to get price history" });
    }
  },
});
