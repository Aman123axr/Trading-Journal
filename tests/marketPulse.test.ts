import { describe, expect, it } from "vitest";
import { buildDemoHeadlines } from "../server/data/demo";
import type { MarketHeadline } from "../server/types";

function localScore(headlines: MarketHeadline[]) {
  return headlines.reduce((sum, headline) => {
    if (headline.bias === "positive") return sum + 20;
    if (headline.bias === "negative") return sum - 20;
    return sum;
  }, 50);
}

describe("market pulse scoring", () => {
  it("leans bullish when positive headlines dominate", () => {
    const headlines = buildDemoHeadlines();
    expect(localScore(headlines)).toBeGreaterThan(50);
  });

  it("leans bearish when negative headlines dominate", () => {
    const headlines: MarketHeadline[] = [
      {
        title: "Large exchange exploit rattles traders",
        source: "Test",
        url: "https://example.com",
        publishedAt: "2026-03-31T00:00:00.000Z",
        bias: "negative",
        reasoning: "Security shock increases sell pressure.",
      },
      {
        title: "Macro selloff hits crypto derivatives",
        source: "Test",
        url: "https://example.com",
        publishedAt: "2026-03-31T00:00:00.000Z",
        bias: "negative",
        reasoning: "Broader risk-off sentiment weighs on digital assets.",
      },
    ];
    expect(localScore(headlines)).toBeLessThan(50);
  });
});
