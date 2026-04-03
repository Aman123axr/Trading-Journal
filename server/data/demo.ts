import type { MarketHeadline, TradeRecord } from "../types";
import { classifySession, deriveTradeFlags } from "../services/analytics";

const baseTrades = [
  ["demo-1", "2026-03-03T02:20:00.000Z", "BTCUSDT", "BTC", "buy", 0.8, 63850, 4.2, 118, 86],
  ["demo-2", "2026-03-03T03:08:00.000Z", "BTCUSDT", "BTC", "sell", 0.8, 64090, 4.2, 142, 72],
  ["demo-3", "2026-03-04T09:22:00.000Z", "ETHUSDT", "ETH", "buy", 4, 3198, 3.1, -76, 35],
  ["demo-4", "2026-03-04T09:31:00.000Z", "ETHUSDT", "ETH", "sell", 4.5, 3181, 3.3, -96, 18],
  ["demo-5", "2026-03-05T14:04:00.000Z", "BTCUSDT", "BTC", "buy", 1.4, 64680, 5.2, 216, 92],
  ["demo-6", "2026-03-06T14:12:00.000Z", "SOLUSDT", "SOL", "buy", 56, 151.4, 2.8, -42, 21],
  ["demo-7", "2026-03-06T14:19:00.000Z", "SOLUSDT", "SOL", "sell", 64, 150.9, 2.9, -58, 11],
  ["demo-8", "2026-03-07T01:20:00.000Z", "BTCUSDT", "BTC", "buy", 1.1, 65110, 4.9, 164, 120],
  ["demo-9", "2026-03-08T11:40:00.000Z", "ETHUSDT", "ETH", "sell", 6.4, 3252, 3.5, 188, 44],
  ["demo-10", "2026-03-10T16:45:00.000Z", "BTCUSDT", "BTC", "buy", 0.9, 66200, 4.5, -110, 33],
  ["demo-11", "2026-03-10T16:51:00.000Z", "BTCUSDT", "BTC", "sell", 1.1, 66050, 4.7, -138, 9],
  ["demo-12", "2026-03-10T17:03:00.000Z", "BTCUSDT", "BTC", "sell", 1.6, 65940, 5.1, -162, 7],
  ["demo-13", "2026-03-12T12:20:00.000Z", "ETHUSDT", "ETH", "buy", 5.8, 3320, 3.8, 246, 63],
  ["demo-14", "2026-03-14T06:10:00.000Z", "SOLUSDT", "SOL", "buy", 45, 159.2, 2.2, 54, 28],
  ["demo-15", "2026-03-15T18:25:00.000Z", "BTCUSDT", "BTC", "sell", 1.2, 67380, 4.9, 129, 54],
  ["demo-16", "2026-03-16T07:44:00.000Z", "ETHUSDT", "ETH", "buy", 7.1, 3362, 3.9, 206, 47],
  ["demo-17", "2026-03-18T13:10:00.000Z", "BTCUSDT", "BTC", "buy", 1.7, 68140, 6.2, 244, 88],
  ["demo-18", "2026-03-19T03:22:00.000Z", "ETHUSDT", "ETH", "sell", 8.3, 3408, 4.4, -91, 26],
  ["demo-19", "2026-03-20T15:52:00.000Z", "BTCUSDT", "BTC", "buy", 2.4, 68920, 7.4, 312, 100],
  ["demo-20", "2026-03-22T02:28:00.000Z", "SOLUSDT", "SOL", "buy", 73, 166.7, 3.8, -71, 19],
  ["demo-21", "2026-03-22T02:36:00.000Z", "SOLUSDT", "SOL", "sell", 86, 165.8, 4.0, -105, 8],
  ["demo-22", "2026-03-24T09:15:00.000Z", "ETHUSDT", "ETH", "buy", 9.4, 3470, 5.2, 214, 66],
  ["demo-23", "2026-03-25T14:05:00.000Z", "BTCUSDT", "BTC", "sell", 1.3, 69400, 5.1, 148, 39],
  ["demo-24", "2026-03-27T01:22:00.000Z", "BTCUSDT", "BTC", "buy", 1.9, 70160, 6.8, -126, 25],
  ["demo-25", "2026-03-27T01:31:00.000Z", "BTCUSDT", "BTC", "buy", 2.7, 70010, 7.1, -174, 6],
  ["demo-26", "2026-03-27T01:39:00.000Z", "BTCUSDT", "BTC", "sell", 3.1, 69870, 7.4, -208, 5],
  ["demo-27", "2026-03-28T17:50:00.000Z", "ETHUSDT", "ETH", "sell", 8.7, 3514, 4.8, 236, 52],
  ["demo-28", "2026-03-29T12:12:00.000Z", "SOLUSDT", "SOL", "buy", 68, 171.1, 3.5, 98, 22]
] as const;

export function buildDemoTrades(): TradeRecord[] {
  return deriveTradeFlags(
    baseTrades.map(([id, timestamp, productSymbol, asset, side, size, price, fees, realizedPnl, holdingMinutes]) => ({
      id,
      timestamp,
      productSymbol,
      asset,
      side,
      size,
      price,
      fees,
      realizedPnl,
      lotSize: size,
      holdingMinutes,
      session: classifySession(timestamp),
      flags: [],
      source: "demo",
    })),
    15000,
  );
}

export function buildDemoHeadlines(): MarketHeadline[] {
  return [
    {
      title: "Bitcoin ETF inflows rebound as macro risk appetite improves",
      source: "Macro Wire",
      url: "https://example.com/bitcoin-etf-inflows",
      publishedAt: "2026-03-30T09:00:00.000Z",
      bias: "positive",
      reasoning: "ETF inflows and broader risk-on sentiment support near-term buying interest for BTC.",
    },
    {
      title: "Ethereum staking participation rises while exchange reserves fall",
      source: "Chain Desk",
      url: "https://example.com/ethereum-staking",
      publishedAt: "2026-03-30T12:15:00.000Z",
      bias: "positive",
      reasoning: "Declining exchange supply and staking growth reduce liquid sell pressure for ETH.",
    },
    {
      title: "Traders trim leverage ahead of key US inflation print",
      source: "Risk Ledger",
      url: "https://example.com/crypto-leverage-cools",
      publishedAt: "2026-03-30T14:30:00.000Z",
      bias: "neutral",
      reasoning: "Positioning is cautious into macro data, which favors patience rather than aggressive directional exposure.",
    },
    {
      title: "Altcoin funding spikes trigger selective profit-taking",
      source: "Pulse Crypto",
      url: "https://example.com/altcoin-funding",
      publishedAt: "2026-03-30T16:40:00.000Z",
      bias: "negative",
      reasoning: "Elevated funding suggests short-term froth and raises the odds of cooling in higher-beta tokens.",
    },
  ];
}
