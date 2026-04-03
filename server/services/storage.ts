import { PrismaClient } from "@prisma/client";
import type { MarketPulse, TradeRecord } from "../types";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function getTrades(filters?: {
  from?: string | null;
  to?: string | null;
  asset?: string | null;
  session?: string | null;
  flag?: string | null;
}) {
  const rows = await prisma.trade.findMany({
    where: {
      ...(filters?.from || filters?.to
        ? {
            timestamp: {
              ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
              ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(filters?.asset ? { asset: filters.asset } : {}),
      ...(filters?.session ? { session: filters.session } : {}),
      ...(filters?.flag ? { flagsJson: { contains: filters.flag } } : {}),
    },
    orderBy: { timestamp: "desc" },
  });

  return rows.map(mapTradeRow);
}

export async function upsertTrades(trades: TradeRecord[]) {
  for (const trade of trades) {
    await prisma.trade.upsert({
      where: { id: trade.id },
      update: {
        timestamp: new Date(trade.timestamp),
        productSymbol: trade.productSymbol,
        asset: trade.asset,
        side: trade.side,
        size: trade.size,
        price: trade.price,
        fees: trade.fees,
        realizedPnl: trade.realizedPnl,
        lotSize: trade.lotSize,
        holdingMinutes: trade.holdingMinutes,
        session: trade.session,
        flagsJson: JSON.stringify(trade.flags),
        source: trade.source,
      },
      create: {
        id: trade.id,
        timestamp: new Date(trade.timestamp),
        productSymbol: trade.productSymbol,
        asset: trade.asset,
        side: trade.side,
        size: trade.size,
        price: trade.price,
        fees: trade.fees,
        realizedPnl: trade.realizedPnl,
        lotSize: trade.lotSize,
        holdingMinutes: trade.holdingMinutes,
        session: trade.session,
        flagsJson: JSON.stringify(trade.flags),
        source: trade.source,
      },
    });
  }
}

export async function deleteTradesBySource(source: string) {
  await prisma.trade.deleteMany({
    where: { source },
  });
}

export async function getLatestSync() {
  const syncState = await prisma.syncState.findUnique({ where: { key: "delta-sync" } });
  return syncState?.updatedAt.toISOString() ?? null;
}

export async function setSyncCursor(cursor: string | null) {
  await prisma.syncState.upsert({
    where: { key: "delta-sync" },
    update: { cursor },
    create: { key: "delta-sync", cursor },
  });
}

export async function getSyncCursor() {
  const state = await prisma.syncState.findUnique({ where: { key: "delta-sync" } });
  return state?.cursor ?? null;
}

export async function saveMarketPulse(pulse: MarketPulse) {
  await prisma.marketPulseSnapshot.create({
    data: {
      score: pulse.score,
      signal: pulse.signal,
      summary: pulse.summary,
      source: pulse.source,
      createdAt: new Date(pulse.generatedAt),
      headlinesJson: JSON.stringify(pulse.headlines),
    },
  });
}

export async function getLatestMarketPulse(): Promise<MarketPulse | null> {
  const snapshot = await prisma.marketPulseSnapshot.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!snapshot) return null;
  return {
    score: snapshot.score,
    signal: snapshot.signal as MarketPulse["signal"],
    summary: snapshot.summary,
    source: snapshot.source,
    generatedAt: snapshot.createdAt.toISOString(),
    headlines: JSON.parse(snapshot.headlinesJson),
  };
}

export async function seedSettingsIfEmpty(defaults: Record<string, string>) {
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.appSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
}

export async function disconnectDb() {
  await prisma.$disconnect();
}

function mapTradeRow(row: {
  id: string;
  timestamp: Date;
  productSymbol: string;
  asset: string;
  side: string;
  size: number;
  price: number;
  fees: number;
  realizedPnl: number;
  lotSize: number;
  holdingMinutes: number | null;
  session: string;
  flagsJson: string;
  source: string;
}) {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    productSymbol: row.productSymbol,
    asset: row.asset,
    side: row.side,
    size: row.size,
    price: row.price,
    fees: row.fees,
    realizedPnl: row.realizedPnl,
    lotSize: row.lotSize,
    holdingMinutes: row.holdingMinutes,
    session: row.session as TradeRecord["session"],
    flags: JSON.parse(row.flagsJson) as string[],
    source: row.source,
  };
}
