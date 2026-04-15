import { Request, Response } from "express";
import { StrategyService } from "../services/strategyService";

export const makeStrategyController = (svc: StrategyService) => ({
  evaluate: async (_: Request, res: Response) => {
    try {
      res.json({ strategies: await svc.evaluate() });
    } catch (err) {
      console.error("[strategyController] Error:", err);
      res.status(500).json({ error: "Failed to evaluate strategy" });
    }
  },
});
