import { describe, expect, it } from "vitest";
import { buildDemoTrades } from "../server/data/demo";
import { buildCalendar, buildDashboardSummary, buildInsights, classifySession, deriveTradeFlags } from "../server/services/analytics";

describe("analytics services", () => {
  it("classifies the expected trading sessions", () => {
    expect(classifySession("2026-03-04T02:00:00.000Z")).toBe("Asia");
    expect(classifySession("2026-03-04T09:00:00.000Z")).toBe("Europe");
    expect(classifySession("2026-03-04T15:00:00.000Z")).toBe("US");
    expect(classifySession("2026-03-04T22:00:00.000Z")).toBe("Off Hours");
  });

  it("derives trade flags from behavior thresholds", () => {
    const trades = deriveTradeFlags(
      [
        {
          id: "a",
          timestamp: "2026-03-01T10:00:00.000Z",
          productSymbol: "BTCUSDT",
          asset: "BTC",
          side: "buy",
          size: 1,
          price: 60000,
          fees: 2,
          realizedPnl: -500,
          lotSize: 1,
          holdingMinutes: 5,
          session: "Europe",
          flags: [],
          source: "test",
        },
        {
          id: "b",
          timestamp: "2026-03-01T10:05:00.000Z",
          productSymbol: "BTCUSDT",
          asset: "BTC",
          side: "sell",
          size: 2,
          price: 59900,
          fees: 2,
          realizedPnl: -600,
          lotSize: 2,
          holdingMinutes: 3,
          session: "Europe",
          flags: [],
          source: "test",
        },
        {
          id: "c",
          timestamp: "2026-03-01T10:08:00.000Z",
          productSymbol: "BTCUSDT",
          asset: "BTC",
          side: "sell",
          size: 3.2,
          price: 59850,
          fees: 3,
          realizedPnl: -700,
          lotSize: 3.2,
          holdingMinutes: 2,
          session: "Europe",
          flags: [],
          source: "test",
        },
      ],
      10000,
    );

    expect(trades[1].flags).toContain("overtrading");
    expect(trades[1].flags).toContain("risk");
    expect(trades[1].flags).toContain("size-spike");
    expect(trades[2].flags).toContain("loss-streak");
  });

  it("builds summary, calendar, and insights from trade history", () => {
    const trades = buildDemoTrades();
    const summary = buildDashboardSummary(trades, "2026-03-31T00:00:00.000Z", "connected");
    const calendar = buildCalendar("2026-03", trades);
    const insights = buildInsights(trades, summary.equityEstimate);

    expect(summary.totalTrades).toBeGreaterThan(10);
    expect(calendar.weeks.length).toBeGreaterThan(3);
    expect(insights).toHaveLength(3);
  });
});
