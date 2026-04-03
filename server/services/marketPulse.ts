import OpenAI from "openai";
import { config } from "../config";
import { buildDemoHeadlines } from "../data/demo";
import { fetchCuratedHeadlines } from "./news";
import type { MarketHeadline, MarketPulse, Signal } from "../types";

function inferSignal(score: number): Signal {
  if (score >= 65) return "buy";
  if (score <= 40) return "sell";
  return "hold";
}

function scoreHeadlines(headlines: MarketHeadline[]) {
  if (headlines.length === 0) return 50;
  const total = headlines.reduce((sum, headline) => {
    if (headline.bias === "positive") return sum + 20;
    if (headline.bias === "negative") return sum - 20;
    return sum;
  }, 50);
  return Math.max(0, Math.min(100, total));
}

async function summarizeWithOpenAi(headlines: MarketHeadline[]) {
  const client = new OpenAI({ apiKey: config.openAiApiKey });
  const prompt = [
    "You are generating a short crypto market pulse for a trading journal.",
    "Focus only on BTC, ETH, and macro crypto risk appetite.",
    "Given these headlines, produce strict JSON with keys summary, score, signal.",
    "score must be an integer 0-100 and signal one of buy, hold, sell.",
    JSON.stringify(headlines),
  ].join("\n");

  const response = await client.responses.create({
    model: config.openAiModel,
    input: prompt,
  });

  const text = response.output_text.trim();
  const parsed = JSON.parse(text) as { summary: string; score: number; signal: Signal };
  return {
    summary: parsed.summary,
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    signal: parsed.signal,
  };
}

function buildFallbackSummary(headlines: MarketHeadline[], score: number, signal: Signal) {
  const positive = headlines.filter((headline) => headline.bias === "positive").length;
  const negative = headlines.filter((headline) => headline.bias === "negative").length;
  if (signal === "buy") {
    return `BTC/ETH sentiment leans constructive with ${positive} supportive headlines outweighing ${negative} risk-off headlines. Bias is to accumulate selectively while respecting macro event risk.`;
  }
  if (signal === "sell") {
    return `Crypto tape is under pressure, with ${negative} cautionary headlines dominating. Bias is defensive until headline pressure and leverage cool.`;
  }
  return `Market pulse is balanced. ${positive} supportive headlines are being offset by ${negative} cautionary signals, so patience and selective execution remain the better posture.`;
}

export async function generateMarketPulse(): Promise<MarketPulse> {
  const headlines = (await fetchCuratedHeadlines()).slice(0, 6);
  const safeHeadlines = headlines.length > 0 ? headlines : buildDemoHeadlines();

  try {
    if (config.openAiApiKey) {
      const ai = await summarizeWithOpenAi(safeHeadlines);
      return {
        score: ai.score,
        signal: ai.signal,
        summary: ai.summary,
        source: "openai+curated-news",
        generatedAt: new Date().toISOString(),
        headlines: safeHeadlines,
      };
    }
  } catch {
    // Fall back to deterministic scoring if AI or parsing fails.
  }

  const score = scoreHeadlines(safeHeadlines);
  const signal = inferSignal(score);
  return {
    score,
    signal,
    summary: buildFallbackSummary(safeHeadlines, score, signal),
    source: "rule-based+curated-news",
    generatedAt: new Date().toISOString(),
    headlines: safeHeadlines,
  };
}
