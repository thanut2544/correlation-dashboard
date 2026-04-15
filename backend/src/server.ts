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
  const { app, priceSvc, corrSvc, stratSvc, tradeSvc, mt5Cmds } = createApp(stream);

  // Load persisted trades from Redis before serving any requests
  await tradeSvc.initialize();

  const server = http.createServer(app);
  const wss = initWebSocket(server, stream, config.wsPath);

  const corrTimer: ReturnType<typeof setInterval> = startCorrelationJob(corrSvc, stream);
  const stratTimer: ReturnType<typeof setInterval> = startStrategyJob(stratSvc, stream, tradeSvc);

  mt5Cmds.start();

  const feed = createPriceFeed();
  feed.start(priceSvc, stream);

  server.listen(config.port, () =>
    console.log(`API on :${config.port}, WS ${config.wsPath}, Feed: ${config.priceFeed}`)
  );

  // Graceful shutdown: flush state, close connections cleanly
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
    // Force exit if graceful close takes too long
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[server] Fatal startup error:", err);
  process.exit(1);
});
