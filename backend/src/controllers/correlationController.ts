import { Request, Response } from "express";
import { CorrelationService } from "../services/correlationService";

export const makeCorrelationController = (svc: CorrelationService) => ({
  all: async (_: Request, res: Response) => {
    try {
      res.json({ correlations: await svc.compute() });
    } catch (err) {
      console.error("[correlationController] Error:", err);
      res.status(500).json({ error: "Failed to compute correlations" });
    }
  },
});
