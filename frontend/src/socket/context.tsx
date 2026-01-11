import { createContext, useContext } from "react";
import type { MessagePayload } from "./types";

interface WebSocketContextType {
  isConnected: boolean;
  /**
   * Round trip latency in milliseconds
   */
  latency: number | null;
  send: (data: MessagePayload) => void;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(
  null,
);

/**
 * Returns the current WebSocket context.
 * @returns
 */
export const useSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a WebSocketProvider");
  }
  return context;
};
