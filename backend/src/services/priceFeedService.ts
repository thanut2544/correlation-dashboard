import { PriceService } from "./priceService";
import { StreamService } from "./streamService";
import * as net from "net";
import { config } from "../config";

export interface PriceFeed {
  start(priceSvc: PriceService, stream: StreamService): void;
  stop(): void;
}

/**
 * NamedPipePriceFeed — รับราคาจาก MT5 EA ผ่าน Windows Named Pipe
 *
 * EA เขียน JSON payload: { "prices": [{ "symbol": "EURUSD", "price": 1.082 }] }
 * เข้ามาทาง \\.\pipe\mql5_dashboard_feed ทุก 15 นาที
 * รวมถึง historical bars 96 แท่งตอน startup เพื่อแก้ปัญหา warm-up
 */
export class NamedPipePriceFeed implements PriceFeed {
  private server: net.Server | null = null;
  private readonly pipeName = "\\\\.\\pipe\\mql5_dashboard_feed";

  start(priceSvc: PriceService, stream: StreamService) {
    this.server = net.createServer((socket) => {
      let buffer = "";

      socket.on("data", (data) => {
        buffer += data.toString();
      });

      socket.on("end", async () => {
        try {
          if (!buffer.trim()) return;

          const body = JSON.parse(buffer);

          if (body.prices && Array.isArray(body.prices)) {
            await Promise.all(
              body.prices.map((p: any) =>
                priceSvc.ingest(p.symbol, Number(p.price), p.ts ? Number(p.ts) : undefined)
              )
            );
          } else if (body.symbol && body.price !== undefined) {
            await priceSvc.ingest(body.symbol, Number(body.price), body.ts ? Number(body.ts) : undefined);
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

      socket.on("error", (err) => console.log("[NamedPipePriceFeed] Socket error:", err.message));
    });

    this.server.on("error", (err) => console.error("[NamedPipePriceFeed] Server error:", err.message));
    this.server.listen(this.pipeName, () =>
      console.log(`[NamedPipePriceFeed] Listening on ${this.pipeName}`)
    );
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

export function createPriceFeed(): PriceFeed {
  return new NamedPipePriceFeed();
}
