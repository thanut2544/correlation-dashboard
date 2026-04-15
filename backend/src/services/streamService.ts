import WebSocket from "ws";
import { CorrelationResult } from "./correlationService";
import { StrategySignal } from "./strategyService";

type Client = WebSocket;

export class StreamService {
  private clients = new Set<Client>();
  addClient(ws: Client) {
    this.clients.add(ws);
    ws.on("close", () => this.clients.delete(ws));
  }
  broadcast<T>(event: string, data: T) {
    const payload = JSON.stringify({ event, data });
    for (const c of this.clients) if (c.readyState === WebSocket.OPEN) c.send(payload);
  }
  sendCorrelation(results: CorrelationResult[]) { this.broadcast("correlation:update", results); }
  sendPrices(snapshot: any) { this.broadcast("price:update", snapshot); }
  sendStrategy(signals: StrategySignal[]) { this.broadcast("strategy:update", signals); }
  sendTrades(trades: any[]) { this.broadcast("trades:update", trades); }
}
