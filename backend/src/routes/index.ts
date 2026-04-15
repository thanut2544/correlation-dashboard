import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { makePriceController } from "../controllers/priceController";
import { makeCorrelationController } from "../controllers/correlationController";
import { makeStrategyController } from "../controllers/strategyController";
import { makeTradeController } from "../controllers/tradeController";
import { PriceService } from "../services/priceService";
import { CorrelationService } from "../services/correlationService";
import { StrategyService } from "../services/strategyService";
import { TradeService } from "../services/tradeService";
import { StreamService } from "../services/streamService";
import { config } from "../config";

function verifyWebhookSecret(req: { headers: Record<string, any>; body: any }): boolean {
  if (!config.webhookSecret) return true; // secret not configured — skip check in dev
  const provided = String(req.headers["x-webhook-secret"] ?? "");
  if (!provided) return false;
  // Constant-time comparison to prevent timing attacks
  try {
    const expected = createHmac("sha256", config.webhookSecret).update(JSON.stringify(req.body)).digest("hex");
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const makeRouter = (
  priceSvc: PriceService,
  corrSvc: CorrelationService,
  stratSvc: StrategyService,
  tradeSvc: TradeService,
  stream: StreamService
) => {
  const r = Router();
  const price = makePriceController(priceSvc);
  const corr = makeCorrelationController(corrSvc);
  const strat = makeStrategyController(stratSvc);
  const trade = makeTradeController(tradeSvc, priceSvc);

  r.get("/symbols", price.listSymbols);
  r.get("/price/:symbol/latest", price.latest);
  r.get("/price/:symbol/history", price.history);
  r.get("/correlation", corr.all);
  r.get("/strategy", strat.evaluate);
  r.post("/trade/open", trade.open);
  r.post("/trade/close", trade.close);
  r.get("/trade", trade.list);

  // MT4/MT5 Webhook — validate secret + sanitize inputs
  r.post("/webhooks/mt-feed", async (req, res) => {
    if (!verifyWebhookSecret(req as any)) {
      return res.status(401).json({ error: "Invalid webhook secret" });
    }

    try {
      const ingestOne = async (symbol: unknown, rawPrice: unknown) => {
        if (typeof symbol !== "string" || !config.symbols.includes(symbol)) return; // whitelist
        const price = Number(rawPrice);
        if (!isFinite(price) || price <= 0) return; // reject NaN / Infinity / negative
        await priceSvc.ingest(symbol, price);
      };

      if (req.body.prices && Array.isArray(req.body.prices)) {
        await Promise.all(req.body.prices.map((p: any) => ingestOne(p.symbol, p.price)));
      } else {
        await ingestOne(req.body.symbol, req.body.price);
      }

      // Broadcast snapshot — only symbols with a valid price
      const snapshotEntries = await Promise.all(
        config.symbols.map(async (s) => {
          const latest = await priceSvc.latest(s);
          return latest ? { symbol: s, ...latest } : null;
        })
      );
      const snapshot = snapshotEntries.filter((e): e is NonNullable<typeof e> => e !== null);
      stream.sendPrices(snapshot);

      res.status(200).json({ status: "ok" });
    } catch (err) {
      console.error("[MT Feed Webhook] Error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  return r;
};
