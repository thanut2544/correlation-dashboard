import express from "express";
import cors from "cors";
import { makeRouter } from "./routes";
import { InMemoryPriceRepo } from "./repositories/priceRepository";
import { RedisPriceRepo } from "./repositories/redisPriceRepository";
import { PriceService } from "./services/priceService";
import { CorrelationService } from "./services/correlationService";
import { StrategyService } from "./services/strategyService";
import { TradeService } from "./services/tradeService";
import { StreamService } from "./services/streamService";
import { MT5CommandService } from "./services/mt5CommandService";
import { config } from "./config";

export function createApp(stream: StreamService) {
  const app = express();

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. same-server calls, curl)
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }));
  app.use(express.json());

  const repo = config.redisUrl ? new RedisPriceRepo() : new InMemoryPriceRepo();
  const priceSvc = new PriceService(repo);
  const corrSvc = new CorrelationService(priceSvc);
  const stratSvc = new StrategyService(priceSvc);
  const mt5Cmds = new MT5CommandService();
  const tradeSvc = new TradeService(mt5Cmds);

  app.use("/api", makeRouter(priceSvc, corrSvc, stratSvc, tradeSvc, stream));
  return { app, priceSvc, corrSvc, stratSvc, tradeSvc, mt5Cmds };
}
