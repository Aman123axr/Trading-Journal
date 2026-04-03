import type {
  BehaviorInsight,
  BehaviorThresholds,
  CalendarDay,
  CalendarWeek,
  DashboardSummary,
  SessionName,
  TradeRecord,
} from "../types";

export const defaultThresholds: BehaviorThresholds = {
  overtradingTradeCount: 4,
  minTradeSpacingMinutes: 12,
  maxRiskPercent: 4,
  lossStreakLimit: 3,
};

function tradeNetPnl(trade: TradeRecord) {
  return trade.realizedPnl - trade.fees;
}

export function classifySession(timestamp: string): SessionName {
  const hour = new Date(timestamp).getUTCHours();
  if (hour >= 0 && hour < 8) return "Asia";
  if (hour >= 8 && hour < 13) return "Europe";
  if (hour >= 13 && hour < 21) return "US";
  return "Off Hours";
}

export function deriveTradeFlags(
  trades: TradeRecord[],
  equityEstimate: number,
  thresholds: BehaviorThresholds = defaultThresholds,
): TradeRecord[] {
  const ordered = [...trades].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  let currentLossStreak = 0;

  return ordered.map((trade, index) => {
    const flags: string[] = [];
    const previousTrade = ordered[index - 1];
    const netPnl = tradeNetPnl(trade);
    const riskPercent = equityEstimate > 0 ? (Math.abs(netPnl) / equityEstimate) * 100 : 0;

    if (previousTrade) {
      const spacingMinutes =
        (new Date(trade.timestamp).getTime() - new Date(previousTrade.timestamp).getTime()) / (1000 * 60);
      if (spacingMinutes < thresholds.minTradeSpacingMinutes) {
        flags.push("overtrading");
      }
    }

    if (netPnl < 0) {
      currentLossStreak += 1;
    } else {
      currentLossStreak = 0;
    }

    if (currentLossStreak >= thresholds.lossStreakLimit) {
      flags.push("loss-streak");
    }

    if (riskPercent > thresholds.maxRiskPercent) {
      flags.push("risk");
    }

    if (index > 0) {
      const previousSize = ordered[index - 1].lotSize || 1;
      if (trade.lotSize > previousSize * 1.4) {
        flags.push("size-spike");
      }
    }

    if (netPnl > 0 && trade.holdingMinutes !== null && trade.holdingMinutes >= 60) {
      flags.push("good-hold");
    }

    return { ...trade, flags };
  });
}

export function buildDashboardSummary(
  trades: TradeRecord[],
  latestSync: string | null,
  liveConnectionStatus: DashboardSummary["liveConnectionStatus"],
): DashboardSummary {
  const totalTrades = trades.length;
  const grossPnl = trades.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const totalFees = trades.reduce((sum, trade) => sum + trade.fees, 0);
  const netPnl = trades.reduce((sum, trade) => sum + tradeNetPnl(trade), 0);
  const winningTrades = trades.filter((trade) => tradeNetPnl(trade) > 0).length;
  const avgLotSize = totalTrades ? trades.reduce((sum, trade) => sum + trade.lotSize, 0) / totalTrades : 0;
  const topAsset = topBucket(trades, (trade) => trade.asset);
  const topSession = topBucket(trades, (trade) => trade.session);
  const equityEstimate = Math.max(1000, 10000 + netPnl);

  return {
    grossPnl,
    netPnl,
    totalFees,
    winRate: totalTrades ? (winningTrades / totalTrades) * 100 : 0,
    totalTrades,
    avgLotSize,
    topAsset,
    topSession,
    equityEstimate,
    latestSync,
    liveConnectionStatus,
  };
}

function topBucket(trades: TradeRecord[], selector: (trade: TradeRecord) => string) {
  const scores = new Map<string, number>();
  for (const trade of trades) {
    scores.set(selector(trade), (scores.get(selector(trade)) ?? 0) + 1);
  }
  const topEntry = [...scores.entries()].sort((left, right) => right[1] - left[1])[0];
  return topEntry?.[0] ?? "-";
}

export function buildCalendar(month: string, trades: TradeRecord[]): { month: string; weeks: CalendarWeek[] } {
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const year = monthStart.getUTCFullYear();
  const monthIndex = monthStart.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const byDate = new Map<string, TradeRecord[]>();

  for (const trade of trades) {
    const date = trade.timestamp.slice(0, 10);
    if (date.startsWith(month)) {
      const list = byDate.get(date) ?? [];
      list.push(trade);
      byDate.set(date, list);
    }
  }

  const cells: Array<CalendarDay | null> = Array.from({ length: daysInMonth + monthStart.getUTCDay() }, (_, index) => {
    if (index < monthStart.getUTCDay()) return null;
    const dayOfMonth = index - monthStart.getUTCDay() + 1;
    const date = `${month}-${String(dayOfMonth).padStart(2, "0")}`;
    const dayTrades = byDate.get(date) ?? [];
    const pnl = dayTrades.reduce((sum, trade) => sum + tradeNetPnl(trade), 0);
    const wins = dayTrades.filter((trade) => tradeNetPnl(trade) > 0).length;
    const tone: CalendarDay["tone"] =
      pnl > 200 ? "strong-positive" : pnl > 0 ? "positive" : pnl < 0 ? "negative" : "flat";

    return {
      date,
      dayOfMonth,
      pnl,
      trades: dayTrades.length,
      winRate: dayTrades.length ? (wins / dayTrades.length) * 100 : 0,
      tone,
    };
  });

  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: CalendarWeek[] = [];
  for (let index = 0; index < cells.length; index += 7) {
    const days = cells.slice(index, index + 7);
    const weekTrades = days.flatMap((day) => (day ? byDate.get(day.date) ?? [] : []));
    const wins = weekTrades.filter((trade) => tradeNetPnl(trade) > 0).length;
    weeks.push({
      days,
      summary: {
        label: `Week ${weeks.length + 1}`,
        pnl: weekTrades.reduce((sum, trade) => sum + tradeNetPnl(trade), 0),
        trades: weekTrades.length,
        winRate: weekTrades.length ? (wins / weekTrades.length) * 100 : 0,
      },
    });
  }

  return { month, weeks };
}

export function buildInsights(
  trades: TradeRecord[],
  equityEstimate: number,
  thresholds: BehaviorThresholds = defaultThresholds,
): BehaviorInsight[] {
  const flags = deriveTradeFlags(trades, equityEstimate, thresholds);
  const overtradingCount = flags.filter((trade) => trade.flags.includes("overtrading")).length;
  const riskCount = flags.filter((trade) => trade.flags.includes("risk")).length;
  const lossStreakCount = flags.filter((trade) => trade.flags.includes("loss-streak")).length;
  const usSessionTrades = trades.filter((trade) => trade.session === "US").length;
  const asiaSessionTrades = trades.filter((trade) => trade.session === "Asia").length;
  const bestTrade = [...trades].sort((left, right) => tradeNetPnl(right) - tradeNetPnl(left))[0];

  return [
    {
      key: "overtrading",
      title: "Overtrading monitor",
      severity: overtradingCount >= thresholds.overtradingTradeCount ? "bad" : overtradingCount > 0 ? "warn" : "good",
      score: Math.max(20, 100 - overtradingCount * 18),
      summary:
        overtradingCount >= thresholds.overtradingTradeCount
          ? "Trade spacing is compressed and likely reactive."
          : "Trade cadence is mostly under control.",
      evidence: [
        `${overtradingCount} trades triggered the overtrading rule.`,
        `Minimum spacing threshold is ${thresholds.minTradeSpacingMinutes} minutes.`,
      ],
    },
    {
      key: "risk-management",
      title: "Risk management profile",
      severity: riskCount > 0 ? "bad" : "good",
      score: Math.max(28, 100 - riskCount * 22),
      summary:
        riskCount > 0
          ? "Several losses are oversized relative to the working equity model."
          : "Trade losses are staying inside the configured risk envelope.",
      evidence: [
        `${riskCount} trades exceeded the ${thresholds.maxRiskPercent}% risk threshold.`,
        bestTrade ? `Best net winner: ${bestTrade.asset} at ${tradeNetPnl(bestTrade).toFixed(2)} USD.` : "No winners yet.",
      ],
    },
    {
      key: "loss-streaks",
      title: "Loss streak pressure",
      severity: lossStreakCount > 0 ? "warn" : "good",
      score: Math.max(30, 100 - lossStreakCount * 25),
      summary:
        lossStreakCount > 0
          ? "Multiple consecutive losers suggest emotional or late-session degradation."
          : "No major losing clusters were detected.",
      evidence: [
        `${lossStreakCount} trades were part of a loss streak of ${thresholds.lossStreakLimit}+ trades.`,
        `${usSessionTrades} US-session trades vs ${asiaSessionTrades} Asia-session trades.`,
      ],
    },
  ];
}
