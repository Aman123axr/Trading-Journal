import express from "express";
import cors from "cors";
import { z } from "zod";
import { buildDemoTrades } from "./data/demo";
import { buildCalendar, buildDashboardSummary, buildInsights, defaultThresholds } from "./services/analytics";
import { syncTradesFromDelta } from "./services/delta";
import { generateMarketPulse } from "./services/marketPulse";
import { getConnectionStatus } from "./services/stream";
import {
  getLatestMarketPulse,
  getLatestSync,
  getTrades,
  saveMarketPulse,
  seedSettingsIfEmpty,
  upsertTrades,
} from "./services/storage";

const filterSchema = z.object({
  month: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  asset: z.string().optional(),
  session: z.string().optional(),
  flag: z.string().optional(),
});

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/dashboard/summary", async (_request, response, next) => {
  try {
    await ensureDataAvailable();
    const trades = await getTrades();
    const latestSync = await getLatestSync();
    response.json(buildDashboardSummary(trades, latestSync, getConnectionStatus()));
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar", async (request, response, next) => {
  try {
    await ensureDataAvailable();
    const parsed = filterSchema.parse(request.query);
    const month = parsed.month ?? new Date().toISOString().slice(0, 7);
    const trades = await getTrades();
    response.json(buildCalendar(month, trades));
  } catch (error) {
    next(error);
  }
});

app.get("/api/trades", async (request, response, next) => {
  try {
    await ensureDataAvailable();
    const parsed = filterSchema.parse(request.query);
    const trades = await getTrades({
      from: parsed.from ?? null,
      to: parsed.to ?? null,
      asset: parsed.asset ?? null,
      session: parsed.session ?? null,
      flag: parsed.flag ?? null,
    });
    response.json({
      items: trades,
      filters: {
        from: parsed.from ?? null,
        to: parsed.to ?? null,
        asset: parsed.asset ?? null,
        session: parsed.session ?? null,
        flag: parsed.flag ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/insights", async (_request, response, next) => {
  try {
    await ensureDataAvailable();
    const trades = await getTrades();
    const summary = buildDashboardSummary(trades, await getLatestSync(), getConnectionStatus());
    response.json({
      items: buildInsights(trades, summary.equityEstimate, defaultThresholds),
      thresholds: defaultThresholds,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/market-pulse", async (_request, response, next) => {
  try {
    let pulse = await getLatestMarketPulse();
    if (!pulse) {
      pulse = await generateMarketPulse();
      await saveMarketPulse(pulse);
    }
    response.json(pulse);
  } catch (error) {
    next(error);
  }
});

app.post("/api/sync/delta", async (_request, response, next) => {
  try {
    const result = await syncTradesFromDelta();
    const pulse = await generateMarketPulse();
    await saveMarketPulse(pulse);
    response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  response.status(500).send(message);
});

async function ensureDataAvailable() {
  await seedSettingsIfEmpty({
    overtradingTradeCount: String(defaultThresholds.overtradingTradeCount),
    minTradeSpacingMinutes: String(defaultThresholds.minTradeSpacingMinutes),
    maxRiskPercent: String(defaultThresholds.maxRiskPercent),
    lossStreakLimit: String(defaultThresholds.lossStreakLimit),
  });
  const trades = await getTrades();
  if (trades.length === 0) {
    await upsertTrades(buildDemoTrades());
  }
}
