import express from "express";
import cors from "cors";
import path from "path";
import { makeRouter } from "./routes";
import { InMemoryPriceRepo } from "./repositories/priceRepository";
import { RedisPriceRepo } from "./repositories/redisPriceRepository";
import { PriceService } from "./services/priceService";
import { CandleService } from "./services/candleService";
import { CorrelationService } from "./services/correlationService";
import { StrategyService } from "./services/strategyService";
import { TradeService } from "./services/tradeService";
import { StreamService } from "./services/streamService";
import { MT5CommandService } from "./services/mt5CommandService";
import { DailyRiskManager } from "./services/dailyRiskManager";
import { config } from "./config";

export function createApp(stream: StreamService) {
  const app = express();

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }));
  app.use(express.json());

  const repo = config.redisUrl ? new RedisPriceRepo() : new InMemoryPriceRepo();
  const priceSvc = new PriceService(repo);

  // CandleService: แปลง raw ticks → M15 candle closes
  // StrategyService และ CorrelationService ใช้ candle data
  const candleSvc = new CandleService(priceSvc);
  const corrSvc = new CorrelationService(candleSvc);
  const stratSvc = new StrategyService(candleSvc);
  const dailyRisk = new DailyRiskManager();

  // MT5CommandService ต้องการ TradeService สำหรับ confirmation callback
  const mt5Cmds = new MT5CommandService();
  const tradeSvc = new TradeService(mt5Cmds);
  mt5Cmds.setTradeService(tradeSvc);

  app.use("/api", makeRouter(priceSvc, corrSvc, stratSvc, tradeSvc, stream));

  // ── Serve frontend static files ──────────────────────────────────────────
  // เมื่อ compile เป็น .exe ด้วย pkg → โฟลเดอร์ frontend/ อยู่ข้างๆ .exe
  // เมื่อรันด้วย Node.js ปกติ → ใช้ path สัมพัทธ์
  const isPkg = typeof (process as any).pkg !== "undefined";
  const frontendDir = isPkg
    ? path.join(path.dirname(process.execPath), "frontend")
    : path.join(__dirname, "../../frontend/out");

  app.use(express.static(frontendDir));

  // Fallback: ส่ง index.html สำหรับทุก route ที่ไม่ใช่ /api
  // (รองรับ Next.js static export + client-side routing)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDir, "index.html"));
  });

  return { app, priceSvc, candleSvc, corrSvc, stratSvc, tradeSvc, mt5Cmds, dailyRisk };
}
