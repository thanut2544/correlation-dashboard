import http from "http";
import { createApp } from "./app";
import { config } from "./config";
import { initWebSocket } from "./websocket";
import { StreamService } from "./services/streamService";
import { startCorrelationJob } from "./jobs/correlationJob";
import { startStrategyJob } from "./jobs/strategyJob";
import { createPriceFeed } from "./services/priceFeedService";
import { closeRedisClient } from "./repositories/redisClient";

async function main() {
  const stream = new StreamService();
  const { app, priceSvc, corrSvc, stratSvc, tradeSvc, mt5Cmds, dailyRisk } = createApp(stream);

  await tradeSvc.initialize();

  const server = http.createServer(app);
  const wss = initWebSocket(server, stream, config.wsPath);

  const corrTimer = startCorrelationJob(corrSvc, stream);

  mt5Cmds.start();

  const feed = createPriceFeed();
  feed.start(priceSvc, stream);

  // หน่วง 8 วินาทีเพื่อรอ EA ส่ง historical bars เข้า pipe ก่อน
  // แล้วค่อย evaluate ครั้งแรก (ป้องกัน race condition)
  const stratTimer = startStrategyJob(stratSvc, stream, tradeSvc, dailyRisk, 8_000);

  server.listen(config.port, () =>
    console.log(
      `[server] API :${config.port} | WS ${config.wsPath} | Feed: ${config.priceFeed} | ` +
      `Pocket Mode: ${config.isPocketMode} | Balance: $${config.accountBalance} | ` +
      `Strategy interval: ${config.strategy.intervalMs / 60_000} min`
    )
  );

  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received — shutting down...`);
    clearInterval(corrTimer);
    clearInterval(stratTimer);
    feed.stop();
    mt5Cmds.stop();
    wss.close();
    await closeRedisClient();
    server.close(() => {
      console.log("[server] HTTP server closed.");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[server] Fatal startup error:", err);
  process.exit(1);
});
