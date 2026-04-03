import { XMLParser } from "fast-xml-parser";
import { buildDemoHeadlines } from "../data/demo";
import type { HeadlineBias, MarketHeadline } from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const SOURCES = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
];

const KEYWORDS = ["bitcoin", "btc", "ethereum", "eth", "crypto", "etf", "macro"];

function scoreTitle(title: string): { bias: HeadlineBias; reasoning: string } {
  const positiveWords = ["inflow", "approval", "rally", "demand", "record", "accumulate", "expand", "rebound"];
  const negativeWords = ["hack", "outflow", "selloff", "liquidation", "crackdown", "drop", "risk", "warn"];
  const lowerTitle = title.toLowerCase();
  const positiveHits = positiveWords.filter((word) => lowerTitle.includes(word)).length;
  const negativeHits = negativeWords.filter((word) => lowerTitle.includes(word)).length;
  if (positiveHits > negativeHits) {
    return { bias: "positive", reasoning: "Headline language leans toward demand, adoption, or positive capital flow." };
  }
  if (negativeHits > positiveHits) {
    return { bias: "negative", reasoning: "Headline language highlights risk, drawdown, or adverse market catalysts." };
  }
  return { bias: "neutral", reasoning: "Headline is informative but not decisively directional on its own." };
}

function normalizeItems(sourceName: string, items: unknown): MarketHeadline[] {
  const itemList = Array.isArray(items) ? items : items ? [items] : [];
  return itemList
    .map((item) => {
      const entry = item as { title?: string; link?: string; pubDate?: string };
      const title = entry.title?.trim();
      if (!title) return null;
      if (!KEYWORDS.some((keyword) => title.toLowerCase().includes(keyword))) return null;
      const scored = scoreTitle(title);
      return {
        title,
        source: sourceName,
        url: entry.link ?? "#",
        publishedAt: entry.pubDate ? new Date(entry.pubDate).toISOString() : new Date().toISOString(),
        bias: scored.bias,
        reasoning: scored.reasoning,
      } satisfies MarketHeadline;
    })
    .filter((headline): headline is MarketHeadline => Boolean(headline))
    .slice(0, 4);
}

export async function fetchCuratedHeadlines() {
  const collected: MarketHeadline[] = [];
  for (const source of SOURCES) {
    try {
      const response = await fetch(source.url);
      if (!response.ok) continue;
      const xml = await response.text();
      const parsed = parser.parse(xml) as {
        rss?: { channel?: { item?: unknown } };
      };
      const items = parsed.rss?.channel?.item;
      collected.push(...normalizeItems(source.name, items));
    } catch {
      // Ignore and continue with remaining sources.
    }
  }

  return collected.length > 0 ? collected.slice(0, 6) : buildDemoHeadlines();
}
