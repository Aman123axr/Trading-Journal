export type Signal = "buy" | "hold" | "sell";
export type SessionName = "Asia" | "Europe" | "US" | "Off Hours";

export interface Trade {
  id: string;
  timestamp: string;
  productSymbol: string;
  asset: string;
  side: string;
  size: number;
  price: number;
  fees: number;
  realizedPnl: number;
  lotSize: number;
  holdingMinutes: number | null;
  session: SessionName;
  flags: string[];
  source: string;
}

export interface DashboardSummary {
  grossPnl: number;
  netPnl: number;
  totalFees: number;
  winRate: number;
  totalTrades: number;
  avgLotSize: number;
  topAsset: string;
  topSession: string;
  equityEstimate: number;
  latestSync: string | null;
  liveConnectionStatus: "connected" | "connecting" | "offline";
}

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  pnl: number;
  trades: number;
  winRate: number;
  tone: "strong-positive" | "positive" | "negative" | "flat";
}

export interface WeeklySummary {
  label: string;
  pnl: number;
  trades: number;
  winRate: number;
}

export interface CalendarWeek {
  days: Array<CalendarDay | null>;
  summary: WeeklySummary;
}

export interface CalendarResponse {
  month: string;
  weeks: CalendarWeek[];
}

export interface BehaviorInsight {
  key: string;
  title: string;
  severity: "good" | "warn" | "bad";
  score: number;
  summary: string;
  evidence: string[];
}

export interface InsightsResponse {
  items: BehaviorInsight[];
  thresholds: {
    overtradingTradeCount: number;
    minTradeSpacingMinutes: number;
    maxRiskPercent: number;
    lossStreakLimit: number;
  };
}

export interface MarketHeadline {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  bias: "positive" | "neutral" | "negative";
  reasoning: string;
}

export interface MarketPulse {
  score: number;
  signal: Signal;
  summary: string;
  source: string;
  generatedAt: string;
  headlines: MarketHeadline[];
}

export interface TradesResponse {
  items: Trade[];
  filters: {
    asset: string | null;
    session: string | null;
    flag: string | null;
    from: string | null;
    to: string | null;
  };
}

export interface SyncResponse {
  ok: boolean;
  source: "delta" | "demo";
  imported: number;
  message: string;
}
