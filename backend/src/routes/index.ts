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
  if (!config.webhookSecret) return true;
  const provided = String(req.headers["x-webhook-secret"] ?? "");
  if (!provided) return false;
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
  r.post("/trade/close-all", trade.closeAll);
  r.get("/trade", trade.list);

  // ── Historical Backfill ──────────────────────────────────────────────────
  // ใช้เพื่อ ingest ข้อมูลย้อนหลัง (เช่น 96 แท่ง M15) จาก EA ตอน startup
  // ทำให้ signal พร้อมทำงานภายใน < 5 วินาที โดยไม่ต้องรอ 24 ชั่วโมง
  r.post("/price/backfill", async (req, res) => {
    try {
      const { symbol, prices } = req.body as {
        symbol: string;
        prices: { ts: number; price: number }[];
      };

      if (!symbol || typeof symbol !== "string" || !config.symbols.includes(symbol)) {
        return res.status(400).json({ error: "Invalid or unlisted symbol" });
      }
      if (!Array.isArray(prices) || prices.length === 0) {
        return res.status(400).json({ error: "prices must be a non-empty array" });
      }

      // Validate + ingest in chronological order (oldest → newest)
      const sorted = [...prices].sort((a, b) => a.ts - b.ts);
      let ingested = 0;
      for (const p of sorted) {
        const price = Number(p.price);
        const ts = Number(p.ts);
        if (!isFinite(price) || price <= 0) continue;
        await priceSvc.ingest(symbol, price, isFinite(ts) && ts > 0 ? ts : undefined);
        ingested++;
      }

      console.log(`[backfill] ${symbol}: ingested ${ingested} historical price points`);
      res.json({ status: "ok", symbol, ingested });
    } catch (err) {
      console.error("[backfill] Error:", err);
      res.status(500).json({ error: "Backfill failed" });
    }
  });

  // ── MT4/MT5 Webhook ───────────────────────────────────────────────────────
  r.post("/webhooks/mt-feed", async (req, res) => {
    if (!verifyWebhookSecret(req as any)) {
      return res.status(401).json({ error: "Invalid webhook secret" });
    }
    try {
      const ingestOne = async (symbol: unknown, rawPrice: unknown) => {
        if (typeof symbol !== "string" || !config.symbols.includes(symbol)) return;
        const price = Number(rawPrice);
        if (!isFinite(price) || price <= 0) return;
        await priceSvc.ingest(symbol, price);
      };

      if (req.body.prices && Array.isArray(req.body.prices)) {
        await Promise.all(req.body.prices.map((p: any) => ingestOne(p.symbol, p.price)));
      } else {
        await ingestOne(req.body.symbol, req.body.price);
      }

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
