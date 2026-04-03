import WebSocket from "ws";
import { config } from "../config";
import type { DashboardSummary } from "../types";
import crypto from "crypto";

let connectionStatus: DashboardSummary["liveConnectionStatus"] = "offline";

function socketSignature(timestamp: string) {
  return crypto.createHmac("sha256", config.deltaApiSecret).update(`GET${timestamp}/live`).digest("hex");
}

export function getConnectionStatus() {
  return connectionStatus;
}

export function startDeltaStream() {
  if (config.isServerless) {
    connectionStatus = "offline";
    return;
  }

  if (!config.deltaApiKey || !config.deltaApiSecret) {
    connectionStatus = "offline";
    return;
  }

  connectionStatus = "connecting";
  const ws = new WebSocket(config.deltaWsUrl);

  ws.on("open", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    ws.send(
      JSON.stringify({
        type: "key-auth",
        payload: {
          api_key: config.deltaApiKey,
          signature: socketSignature(timestamp),
          timestamp,
        },
      }),
    );
  });

  ws.on("message", (message) => {
    try {
      const payload = JSON.parse(String(message)) as { type?: string; success?: boolean };
      if (payload.type === "key-auth") {
        connectionStatus = payload.success ? "connected" : "offline";
      }
    } catch {
      connectionStatus = "connecting";
    }
  });

  ws.on("error", () => {
    connectionStatus = "offline";
  });

  ws.on("close", () => {
    connectionStatus = "offline";
  });
}
