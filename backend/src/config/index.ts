import * as dotenv from 'dotenv';
dotenv.config();

const accountBalance = Number(process.env.ACCOUNT_BALANCE || 500);
const pocketModeThreshold = Number(process.env.POCKET_MODE_THRESHOLD || 2000);
const isPocketMode = accountBalance < pocketModeThreshold;

export const config = {
  port: Number(process.env.PORT || 4000),
  wsPath: process.env.WS_PATH || "/ws",

  // ── Symbols ───────────────────────────────────────────────────────────────
  // Pocket Mode (<$2,000): ตัด XAUUSD ออก เพราะ spread แพงสำหรับ micro lot
  symbols: isPocketMode
    ? (process.env.POCKET_MODE_SYMBOLS || "EURUSD,GBPUSD,USDJPY,AUDUSD,USDCHF,NZDUSD").split(",")
    : (process.env.SYMBOLS || "EURUSD,GBPUSD,XAUUSD,USDJPY,AUDUSD,USDCHF,USDCAD,NZDUSD").split(","),

  // ── Candle Aggregation ────────────────────────────────────────────────────
  // ขนาด window ของแต่ละ candle (ms)
  // 900_000 ms = 15 นาที = M15 timeframe
  candleIntervalMs: Number(process.env.CANDLE_INTERVAL_MS || 900_000),

  // ── Correlation job ───────────────────────────────────────────────────────
  // Recompute correlation matrix ทุก 15 นาที (sync กับ candle)
  correlationIntervalMs: Number(process.env.CORR_INTERVAL_MS || 900_000),

  thresholdLow: Number(process.env.THRESHOLD_LOW || -0.5),
  thresholdHigh: Number(process.env.THRESHOLD_HIGH || 0.8),

  // ── Storage ───────────────────────────────────────────────────────────────
  redisUrl: process.env.REDIS_URL || "",
  redisNamespace: process.env.REDIS_NAMESPACE || "prices",

  // ── CORS / Security ───────────────────────────────────────────────────────
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(","),
  webhookSecret: process.env.WEBHOOK_SECRET || "",

  // ── Price Feed ────────────────────────────────────────────────────────────
  priceFeed: "namedpipe" as const,

  // ── Account & Risk ────────────────────────────────────────────────────────
  accountBalance,
  pocketModeThreshold,
  isPocketMode,
  pocketModeLot: Number(process.env.POCKET_MODE_LOT || 0.01),

  // riskPercent = % ของ balance ที่ยอมเสียต่อ 1 trade
  // 0.5% ของ $500 = $2.50 → เหมาะกับ Pocket Mode
  riskPercent: Number(process.env.RISK_PERCENT || 0.5),

  // ── Farm Dollar: Daily Targets ────────────────────────────────────────────
  // เป้าหมายกำไรต่อวัน (pips) — ถึงแล้วหยุด auto-trade ทันที
  // M15 pairs trading: 20 pips/วัน สมเหตุสมผลสำหรับ micro lot
  dailyTargetPips: Number(process.env.DAILY_TARGET_PIPS || 20),

  // ขาดทุนสูงสุดต่อวัน (pips) — ถึงแล้วหยุด auto-trade ทันที
  // Rule: ห้ามขาดทุนเกิน 75% ของ daily target
  dailyDrawdownPips: Number(process.env.DAILY_DRAWDOWN_PIPS || 15),

  // จำนวน position สูงสุดที่เปิดพร้อมกัน
  // Pocket Mode: 2 pairs, Regular: 3 pairs
  maxConcurrentTrades: Number(process.env.MAX_CONCURRENT_TRADES || (isPocketMode ? 2 : 3)),

  // เวลา reset daily counter (ชั่วโมง UTC)
  // 17:00 UTC = 00:00 Bangkok (UTC+7) = เที่ยงคืนไทย
  dailyResetHourUTC: Number(process.env.DAILY_RESET_HOUR_UTC || 17),

  // ── Strategy (M15 Timeframe) ──────────────────────────────────────────────
  strategy: {
    // corrShortWindow: จำนวน M15 bars สำหรับ correlation ระยะสั้น
    // 28 bars × 15 min = 7 ชั่วโมง (ดู correlation ช่วงเช้า-บ่าย)
    corrShortWindow: Number(process.env.CORR_SHORT_WINDOW || 28),

    // corrMidWindow: จำนวน M15 bars สำหรับ correlation อ้างอิง
    // 96 bars × 15 min = 24 ชั่วโมง (ดู correlation รายวัน)
    corrMidWindow: Number(process.env.CORR_MID_WINDOW || 96),

    corrStabilityMaxDiff: Number(process.env.CORR_STABILITY_MAX_DIFF || 0.15),
    corrStabilityVol: Number(process.env.CORR_STABILITY_VOL || 0.2),

    // Z-score entry threshold
    // 2.5σ = spread เบี่ยงเบนจาก mean มากพอที่จะ revert ได้บน M15
    zEntry: Number(process.env.Z_ENTRY || 2.5),

    // Counter-trend (ทวนทิศ EMA): ต้องการ Z สูงกว่า = ปลอดภัยกว่า
    zEntryStrict: Number(process.env.Z_ENTRY_STRICT || 3.0),

    // Take profit: Z กลับมาใกล้ mean → ปิดกำไร
    zTakeProfit: Number(process.env.Z_TP || 0.5),

    // Stop loss: Z ถ่างออกอีก → ทฤษฎีผิด ตัดขาดทุน
    zStopLoss: Number(process.env.Z_STOP_LOSS || 3.5),

    // EMA บน M15 candles:
    // Fast EMA 20 bars = 5 ชั่วโมง (จับ trend ระหว่างวัน)
    // Slow EMA 50 bars = 12.5 ชั่วโมง (กรอง noise)
    emaFast: Number(process.env.EMA_FAST || 20),
    emaSlow: Number(process.env.EMA_SLOW || 50),

    // RSI 14 bars บน M15 = ดู momentum ใน 3.5 ชั่วโมงที่ผ่านมา
    rsiPeriod: Number(process.env.RSI_PERIOD || 14),

    // ATR 14 bars บน M15 spread = ดู volatility ของ spread
    atrPeriod: Number(process.env.ATR_PERIOD || 14),
    atrMin: Number(process.env.ATR_MIN || 0),
    atrMax: Number(process.env.ATR_MAX || Number.POSITIVE_INFINITY),

    // Sessions ที่อนุญาตให้เทรด (London + NY = overlap ดีที่สุด)
    allowSessions: (process.env.ALLOW_SESSIONS || "london,ny")
      .split(",")
      .map(s => s.trim().toLowerCase()),

    // Strategy job interval = 15 นาที (ทุกครั้งที่ M15 candle ปิด)
    intervalMs: Number(process.env.STRATEGY_INTERVAL_MS || 900_000),
  },
};
