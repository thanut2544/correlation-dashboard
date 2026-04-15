import { PriceService } from "./priceService";
import { StreamService } from "./streamService";
import * as net from "net";
import { config } from "../config";

/**
 * Abstraction for price data feeds.
 * Extend this to plug in real market data providers (OANDA, Twelve Data, etc.)
 */
export interface PriceFeed {
  start(priceSvc: PriceService, stream: StreamService): void;
  stop(): void;
}

/**
 * Demo feed — generates random-walk prices for configured symbols.
 */
export class DemoPriceFeed implements PriceFeed {
  private timer: ReturnType<typeof setInterval> | null = null;
  private base: Record<string, number> = {};

  constructor() {
    const defaults: Record<string, number> = {
      EURUSD: 1.1,
      GBPUSD: 1.25,
      XAUUSD: 1900,
      JPY: 150,
      USDJPY: 150,
      AUDUSD: 0.65,
      USDCHF: 0.88,
      USDCAD: 1.36,
      NZDUSD: 0.61,
    };
    for (const sym of config.symbols) {
      this.base[sym] = defaults[sym] ?? 1.0;
    }
  }

  private trendCounter = 0;
  private trendDirection = 1;

  start(priceSvc: PriceService, stream: StreamService) {
    const tick = async () => {
      // Create a macro trend cycle (swings every ~100 ticks)
      this.trendCounter++;
      if (this.trendCounter > 100) {
        this.trendDirection *= -1;
        this.trendCounter = 0;
      }

      const macroTrend = this.trendDirection * 0.001;
      const noise = () => (Math.random() - 0.5) * 0.001;
      const masterMove = macroTrend + noise();

      this.base["EURUSD"] *= (1 + masterMove);
      this.base["GBPUSD"] *= (1 + masterMove * 0.9 + noise());
      this.base["USDCHF"] *= (1 - masterMove * 0.85 + noise());

      ["XAUUSD", "JPY", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD"].forEach((sym) => {
        if (!this.base[sym]) this.base[sym] = 1.0;
        this.base[sym] *= (1 + (Math.random() - 0.5) * 0.002);
      });

      try {
        await Promise.all(
          Object.entries(this.base).map(([sym, val]) => priceSvc.ingest(sym, Number(val.toFixed(5))))
        );

        const snapshotEntries = await Promise.all(
          config.symbols.map(async (s) => {
            const latest = await priceSvc.latest(s);
            return latest ? { symbol: s, ...latest } : null;
          })
        );
        // Only broadcast symbols that have a valid price — never send NaN
        const snapshot = snapshotEntries.filter((e): e is NonNullable<typeof e> => e !== null);
        stream.sendPrices(snapshot);
      } catch (err) {
        console.error("[DemoPriceFeed] Error:", err);
      }
    };

    this.timer = setInterval(() => { tick(); }, config.priceFeedIntervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

/**
 * HTTP polling feed — periodically fetches prices from an external REST API.
 * Expected response format: { prices: [{ symbol: string, price: number }] }
 * Configure via PRICE_FEED_URL env var.
 */
export class HttpPriceFeed implements PriceFeed {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(priceSvc: PriceService, stream: StreamService) {
    if (!config.priceFeedUrl) {
      console.warn("[HttpPriceFeed] No PRICE_FEED_URL configured, falling back to demo");
      return new DemoPriceFeed().start(priceSvc, stream);
    }

    const poll = async () => {
      try {
        const res = await fetch(config.priceFeedUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        const prices: { symbol: string; price: number }[] = body.prices || [];

        for (const p of prices) {
          if (config.symbols.includes(p.symbol)) {
            await priceSvc.ingest(p.symbol, p.price);
          }
        }

        const snapshotEntries = await Promise.all(
          config.symbols.map(async (s) => {
            const latest = await priceSvc.latest(s);
            return latest ? { symbol: s, ...latest } : null;
          })
        );
        const snapshot = snapshotEntries.filter((e): e is NonNullable<typeof e> => e !== null);
        stream.sendPrices(snapshot);
      } catch (err) {
        console.error("[HttpPriceFeed] Poll error:", err);
      }
    };

    poll(); // initial fetch
    this.timer = setInterval(poll, config.priceFeedIntervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

export class WebhookPriceFeed implements PriceFeed {
  start(priceSvc: PriceService, stream: StreamService) {
    console.log("[WebhookPriceFeed] Listening for incoming MT4/MT5 webhooks...");
  }
  stop() { }
}

export class NamedPipePriceFeed implements PriceFeed {
  private server: net.Server | null = null;
  private readonly pipeName = "\\\\.\\pipe\\mql5_dashboard_feed";

  start(priceSvc: PriceService, stream: StreamService) {
    this.server = net.createServer((socket) => {
      // console.log("[NamedPipe] Feed client connected!");
      let buffer = "";
      socket.on("data", (data) => {
        // console.log(`[NamedPipe] Received data chunk (${data.length} bytes)`);
        buffer += data.toString();
      });
      socket.on("end", async () => {
        try {
          if (!buffer.trim()) {
            // console.log("[NamedPipe] Client disconnected without data.");
            return;
          }
          // console.log("[NamedPipe] Full payload received.");
          // console.log("[NamedPipe] Payload Content:", buffer);

          const body = JSON.parse(buffer);

          if (body.prices && Array.isArray(body.prices)) {
            await Promise.all(
              body.prices.map((p: any) => priceSvc.ingest(p.symbol, Number(p.price)))
            );
          } else {
            const { symbol, price } = body;
            if (symbol && price !== undefined) {
              await priceSvc.ingest(symbol, Number(price));
            }
          }

          const snapshotEntries = await Promise.all(
            config.symbols.map(async (s) => {
              const latest = await priceSvc.latest(s);
              return latest ? { symbol: s, ...latest } : null;
            })
          );
          const snapshot = snapshotEntries.filter((e): e is NonNullable<typeof e> => e !== null);
          stream.sendPrices(snapshot);
        } catch (err) {
          console.error("[NamedPipePriceFeed] Payload parse error:", err instanceof Error ? err.message : err);
        }
      });
      socket.on("error", (err) => console.log("[NamedPipe] Socket error:", err.message));
    });

    this.server.on("error", (err) => {
      console.error("[NamedPipePriceFeed] Server error:", err.message);
    });

    this.server.listen(this.pipeName, () => {
      console.log(`[NamedPipePriceFeed] Listening on ${this.pipeName}`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

/**
 * Factory: picks feed based on PRICE_FEED env var.
 */
export function createPriceFeed(): PriceFeed {
  switch (config.priceFeed) {
    case "http":
      return new HttpPriceFeed();
    case "webhook":
      return new WebhookPriceFeed();
    case "namedpipe":
      return new NamedPipePriceFeed();
    case "demo":
    default:
      return new DemoPriceFeed();
  }
}
