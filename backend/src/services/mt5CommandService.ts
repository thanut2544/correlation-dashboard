import * as net from "net";

export class MT5CommandService {
  private server: net.Server | null = null;
  private clients = new Set<net.Socket>();
  private readonly pipeName = "\\\\.\\pipe\\mql5_dashboard_trades";

  start() {
    this.server = net.createServer((socket) => {
      console.log("[MT5CommandService] MT5 EA connected to command pipe.");
      this.clients.add(socket);

      socket.on("end", () => {
        console.log("[MT5CommandService] MT5 EA disconnected from command pipe.");
        this.clients.delete(socket);
      });

      socket.on("error", (err) => {
        console.log("[MT5CommandService] Socket error:", err.message);
        this.clients.delete(socket);
      });
    });

    this.server.on("error", (err) => {
      console.error("[MT5CommandService] Server error:", err.message);
    });

    this.server.listen(this.pipeName, () => {
      console.log(`[MT5CommandService] Command pipe listening on ${this.pipeName}`);
    });
  }

  executeTrade(cmd: "buy" | "sell" | "close", symbol: string, volume?: number) {
    const payload = JSON.stringify({ cmd, symbol, volume: volume ?? 0 }) + "\n";
    console.log(`[MT5CommandService] Transmitting command: ${payload.trim()}`);
    
    for (const client of this.clients) {
      client.write(payload);
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.clients.clear();
  }
}
