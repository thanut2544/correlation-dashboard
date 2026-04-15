const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws";

let instance: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
/** All active subscriptions — re-attached after every reconnect */
const subscriptions = new Map<string, Set<(data: any) => void>>();

function getSocket(): WebSocket {
  if (instance && instance.readyState <= WebSocket.OPEN) return instance;

  // Clean up previous instance before creating a new one
  if (instance) {
    instance.onmessage = null;
    instance.onclose = null;
    instance.onerror = null;
    if (instance.readyState !== WebSocket.CLOSED) {
      instance.close();
    }
    instance = null;
  }

  const ws = new WebSocket(WS_URL);

  ws.onmessage = (evt: MessageEvent) => {
    try {
      const msg = JSON.parse(evt.data as string);
      const handlers = subscriptions.get(msg.event);
      if (handlers) handlers.forEach((cb) => cb(msg.data));
    } catch {
      // Ignore malformed messages
    }
  };

  ws.onclose = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => getSocket(), 2000);
  };

  ws.onerror = () => {
    // onclose fires after onerror — reconnect is handled there
  };

  instance = ws;
  return ws;
}

/**
 * Subscribe to a specific WS event. Returns an unsubscribe function.
 * Safe to call before the socket is open — handler is stored and
 * automatically re-registered across reconnects.
 */
export function subscribe(event: string, cb: (data: any) => void): () => void {
  if (!subscriptions.has(event)) subscriptions.set(event, new Set());
  subscriptions.get(event)!.add(cb);

  // Ensure socket is created (or already running)
  getSocket();

  return () => {
    subscriptions.get(event)?.delete(cb);
  };
}
