import crypto from "crypto";
import { config } from "../config";
import { buildDemoTrades } from "../data/demo";
import { classifySession, defaultThresholds, deriveTradeFlags } from "./analytics";
import { deleteTradesBySource, getSyncCursor, setSyncCursor, upsertTrades } from "./storage";
import type { DeltaFill, TradeRecord } from "../types";

function hasDeltaCredentials() {
  return Boolean(config.deltaApiKey && config.deltaApiSecret);
}

function createSignature(method: string, timestamp: string, path: string, body = "") {
  return crypto.createHmac("sha256", config.deltaApiSecret).update(`${method}${timestamp}${path}${body}`).digest("hex");
}

async function deltaRequest<T>(path: string, options: RequestInit = {}) {
  const method = options.method ?? "GET";
  const body = typeof options.body === "string" ? options.body : "";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createSignature(method, timestamp, path, body);
  const response = await fetch(`${config.deltaBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": config.deltaApiKey,
      signature,
      timestamp,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Delta request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
}

function inferAsset(symbol: string) {
  if (symbol.startsWith("BTC")) return "BTC";
  if (symbol.startsWith("ETH")) return "ETH";
  if (symbol.startsWith("SOL")) return "SOL";
  return symbol.split(/[-_/]/)[0] ?? symbol;
}

function mapFillToTrade(fill: DeltaFill): TradeRecord {
  const productSymbol = fill.product_symbol ?? fill.symbol ?? "UNKNOWN";
  const timestamp = fill.created_at ?? fill.timestamp ?? new Date().toISOString();
  const underlyingSymbol = fill.product?.underlying_asset?.symbol;
  return {
    id: fill.id,
    timestamp,
    productSymbol,
    asset: underlyingSymbol ?? inferAsset(productSymbol),
    side: fill.side ?? "unknown",
    size: Number(fill.size ?? 0),
    price: Number(fill.price ?? 0),
    fees: Number(fill.commission ?? 0),
    realizedPnl: Number(fill.realized_pnl ?? 0),
    lotSize: Number(fill.size ?? 0),
    holdingMinutes: fill.meta_data?.holding_minutes ?? null,
    session: classifySession(timestamp),
    flags: [],
    source: "delta",
  };
}

function deriveRealizedPnlFromDelta(fills: DeltaFill[]) {
  const ordered = [...fills].sort((left, right) => {
    const leftTime = new Date(left.created_at ?? left.timestamp ?? 0).getTime();
    const rightTime = new Date(right.created_at ?? right.timestamp ?? 0).getTime();
    return leftTime - rightTime;
  });

  const cumulativeBySymbol = new Map<string, number>();
  const normalized: TradeRecord[] = [];

  for (const fill of ordered) {
    const trade = mapFillToTrade(fill);
    const symbolKey = trade.productSymbol;
    const previousCumulative = cumulativeBySymbol.get(symbolKey) ?? 0;
    const rawCumulative = fill.meta_data?.new_position?.realized_pnl;
    const nextPositionSize = Number(fill.meta_data?.new_position?.size ?? 0);
    const currentCumulative = rawCumulative === null || rawCumulative === undefined ? previousCumulative : Number(rawCumulative);
    const deltaRealized =
      rawCumulative === null || rawCumulative === undefined ? Number(fill.realized_pnl ?? 0) : currentCumulative - previousCumulative;

    normalized.push({
      ...trade,
      realizedPnl: Number(deltaRealized.toFixed(2)),
    });

    cumulativeBySymbol.set(symbolKey, nextPositionSize === 0 ? 0 : currentCumulative);
  }

  return normalized;
}

export async function syncTradesFromDelta() {
  if (!hasDeltaCredentials()) {
    const demoTrades = buildDemoTrades();
    await upsertTrades(demoTrades);
    await setSyncCursor(demoTrades[0]?.timestamp ?? null);
    return {
      source: "demo" as const,
      imported: demoTrades.length,
      message:
        "Delta credentials are not configured. Demo trades were loaded so you can explore the journal while wiring DELTA_API_KEY and DELTA_API_SECRET.",
    };
  }

  const fills = await fetchAllFillsFromDelta();
  const normalizedTrades = deriveTradeFlags(deriveRealizedPnlFromDelta(fills), 10000, defaultThresholds);

  if (normalizedTrades.length > 0) {
    await deleteTradesBySource("demo");
    await deleteTradesBySource("delta");
  }
  await upsertTrades(normalizedTrades);
  await setSyncCursor(null);

  return {
    source: "delta" as const,
    imported: normalizedTrades.length,
    message: `Imported ${normalizedTrades.length} trades from Delta Exchange.`,
  };
}

async function fetchAllFillsFromDelta(maxPages = 100) {
  const allFills: DeltaFill[] = [];
  const seenCursors = new Set<string>();
  let afterCursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const query = new URLSearchParams();
    query.set("page_size", "50");
    if (afterCursor) {
      query.set("after", afterCursor);
    }

    const path = `/v2/fills?${query.toString()}`;
    const payload = await deltaRequest<{ result?: DeltaFill[]; meta?: { after?: string | null } }>(path);
    const pageFills = payload.result ?? [];
    allFills.push(...pageFills);

    const nextCursor = payload.meta?.after ?? null;
    if (!nextCursor || pageFills.length === 0 || seenCursors.has(nextCursor)) {
      break;
    }

    seenCursors.add(nextCursor);
    afterCursor = nextCursor;
  }

  return allFills;
}
