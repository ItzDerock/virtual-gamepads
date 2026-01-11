import React, { useEffect, useRef, useState, useCallback } from "react";
import { WebSocketContext } from "./context";
import type { MessagePayload } from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Gets the unique client ID from localStorage or creates a new one.
 * @returns
 */
function getClientId() {
  const KEY = "ws_client_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    // crypto uuid only available on https and localhost
    id = uuidv4();
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Provides a WebSocket connection to children components.
 */
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const lastPingTimeRef = useRef<number>(0);

  useEffect(() => {
    const clientId = getClientId();
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const port = window.location.port;

    const ws = new WebSocket(
      `${protocol}://${hostname}:${port}/ws?client_id=${clientId}`,
    );

    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WS Connected");
      setIsConnected(true);

      // Start Heartbeat (every 5 seconds)
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          lastPingTimeRef.current = Date.now();
          ws.send(JSON.stringify({ kind: "ping" }));
        }
      }, 5000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle Pong for latency calculation
        if (message.kind === "pong") {
          const currentLatency = Date.now() - lastPingTimeRef.current;
          setLatency(currentLatency);
        }
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };

    // Cleanup on unmount
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      ws.close();
    };
  }, []);

  // Exposed send function
  const send = useCallback((data: MessagePayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket not connected");
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, latency, send }}>
      {children}
    </WebSocketContext.Provider>
  );
};
