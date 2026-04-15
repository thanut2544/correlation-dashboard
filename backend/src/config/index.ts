import * as dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined || val === "") {
    if (isProduction) throw new Error(`Missing required env var: ${key}`);
    console.warn(`[config] ${key} not set, using fallback`);
    return fallback ?? "";
  }
  return val;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  wsPath: process.env.WS_PATH || "/ws",
  symbols: (process.env.SYMBOLS || "EURUSD,GBPUSD,XAUUSD,JPY,USDJPY,AUDUSD,USDCHF,USDCAD,NZDUSD").split(","),
  correlationWindow: Number(process.env.CORR_WINDOW || 120),
  correlationIntervalMs: Number(process.env.CORR_INTERVAL_MS || 60_000),
  thresholdLow: Number(process.env.THRESHOLD_LOW || -0.5),
  thresholdHigh: Number(process.env.THRESHOLD_HIGH || 0.8),
  redisUrl: process.env.REDIS_URL || "",
  redisNamespace: process.env.REDIS_NAMESPACE || "prices",
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(","),
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  priceFeed: "namedpipe",
  priceFeedUrl: process.env.PRICE_FEED_URL || "",
  priceFeedIntervalMs: Number(process.env.PRICE_FEED_INTERVAL_MS || 2_000),
  strategy: {
    corrShortWindow: Number(process.env.CORR_SHORT_WINDOW || 60),
    corrMidWindow: Number(process.env.CORR_MID_WINDOW || 240),
    corrStabilityMaxDiff: Number(process.env.CORR_STABILITY_MAX_DIFF || 0.15),
    corrStabilityVol: Number(process.env.CORR_STABILITY_VOL || 0.2),
    zEntry: Number(process.env.Z_ENTRY || 2.0),
    zEntryStrict: Number(process.env.Z_ENTRY_STRICT || 2.5),
    zTakeProfit: Number(process.env.Z_TP || 0.5),
    zStopLoss: Number(process.env.Z_STOP_LOSS || 3.5),
    emaFast: Number(process.env.EMA_FAST || 50),
    emaSlow: Number(process.env.EMA_SLOW || 200),
    rsiPeriod: Number(process.env.RSI_PERIOD || 14),
    atrPeriod: Number(process.env.ATR_PERIOD || 14),
    atrMin: Number(process.env.ATR_MIN || 0),
    atrMax: Number(process.env.ATR_MAX || Number.POSITIVE_INFINITY),
    allowSessions: (process.env.ALLOW_SESSIONS || "london,ny").split(",").map(s => s.trim().toLowerCase()),
  },
};
