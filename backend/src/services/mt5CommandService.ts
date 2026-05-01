import * as net from "net";
import { TradeService } from "./tradeService";

/**
 * MT5CommandService — Named Pipe bridge ไปยัง MT5 EA
 *
 * Command pipe (WRITE): ส่งคำสั่ง buy/sell/close พร้อม tradeId + volume
 * Confirm pipe (READ):  รับ confirmation กลับจาก EA หลัง execute
 */
export class MT5CommandService {
  private server: net.Server | null = null;
  private confirmServer: net.Server | null = null;
  private clients = new Set<net.Socket>();
  private readonly pipeName = "\\\\.\\pipe\\mql5_dashboard_trades";
  private readonly confirmPipeName = "\\\\.\\pipe\\mql5_dashboard_confirm";
  private tradeSvc: TradeService | undefined;

  /** Wire TradeService หลังจาก construct เสร็จ เพื่อหลีกเลี่ยง circular dependency */
  setTradeService(svc: TradeService) {
    this.tradeSvc = svc;
  }

  start() {
    this.startCommandPipe();
    this.startConfirmPipe();
  }

  private startCommandPipe() {
    this.server = net.createServer((socket) => {
      console.log("[MT5CommandService] EA connected to command pipe.");
      this.clients.add(socket);
      socket.on("end", () => {
        console.log("[MT5CommandService] EA disconnected from command pipe.");
        this.clients.delete(socket);
      });
      socket.on("error", (err) => {
        console.log("[MT5CommandService] Command socket error:", err.message);
        this.clients.delete(socket);
      });
    });
    this.server.on("error", (err) => console.error("[MT5CommandService] Command pipe error:", err.message));
    this.server.listen(this.pipeName, () =>
      console.log(`[MT5CommandService] Command pipe listening on ${this.pipeName}`)
    );
  }

  private startConfirmPipe() {
    let buffer = "";
    this.confirmServer = net.createServer((socket) => {
      console.log("[MT5CommandService] EA connected to confirm pipe.");
      socket.on("data", (data) => {
        buffer += data.toString();
        // Parse newline-delimited JSON confirmations
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // last fragment (may be incomplete)
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as { id: string; retcode: number; comment: string };
            console.log(`[MT5CommandService] Confirmation received: id=${msg.id} retcode=${msg.retcode} ${msg.comment}`);
            this.tradeSvc?.confirmMT5(msg.id, msg.retcode, msg.comment);
          } catch {
            console.warn("[MT5CommandService] Failed to parse confirmation:", line);
          }
        }
      });
      socket.on("end", () => { buffer = ""; });
      socket.on("error", (err) => console.log("[MT5CommandService] Confirm socket error:", err.message));
    });
    this.confirmServer.on("error", (err) =>
      console.error("[MT5CommandService] Confirm pipe error:", err.message)
    );
    this.confirmServer.listen(this.confirmPipeName, () =>
      console.log(`[MT5CommandService] Confirm pipe listening on ${this.confirmPipeName}`)
    );
  }

  executeTrade(cmd: "buy" | "sell" | "close", symbol: string, volume?: number, tradeId?: string) {
    const payload = JSON.stringify({ cmd, symbol, volume: volume ?? 0, id: tradeId ?? "" }) + "\n";
    console.log(`[MT5CommandService] Transmitting: ${payload.trim()}`);
    for (const client of this.clients) {
      client.write(payload);
    }
  }

  stop() {
    if (this.server) { this.server.close(); this.server = null; }
    if (this.confirmServer) { this.confirmServer.close(); this.confirmServer = null; }
    this.clients.clear();
  }
}
