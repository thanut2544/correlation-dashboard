import { Server as HttpServer } from "http";
import WebSocket from "ws";
import { StreamService } from "../services/streamService";

const HEARTBEAT_INTERVAL_MS = 30_000;

export function initWebSocket(server: HttpServer, stream: StreamService, path: string): WebSocket.Server {
  const wss = new WebSocket.Server({ server, path });

  wss.on("connection", (ws) => {
    console.log("[WebSocket] New client connected");
    (ws as any).isAlive = true;

    ws.on("pong", () => { (ws as any).isAlive = true; });
    ws.on("error", (err) => { console.error("[WebSocket] Client error:", err); });

    stream.addClient(ws);
  });

  wss.on("error", (err) => {
    console.error("[WebSocket] Server error:", err);
  });

  // Ping every client; terminate those that didn't respond since last ping
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) {
        console.warn("[WebSocket] Terminating stale connection");
        return ws.terminate();
      }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}
