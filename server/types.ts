export type Signal = "buy" | "hold" | "sell";
export type HeadlineBias = "positive" | "neutral" | "negative";
export type SessionName = "Asia" | "Europe" | "US" | "Off Hours";

export interface TradeRecord {
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

export interface BehaviorThresholds {
  overtradingTradeCount: number;
  minTradeSpacingMinutes: number;
  maxRiskPercent: number;
  lossStreakLimit: number;
}

export interface BehaviorInsight {
  key: string;
  title: string;
  severity: "good" | "warn" | "bad";
  score: number;
  summary: string;
  evidence: string[];
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

export interface MarketHeadline {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  bias: HeadlineBias;
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

export interface DeltaFill {
  id: string;
  product_symbol?: string;
  symbol?: string;
  product?: {
    symbol?: string;
    contract_type?: string;
    contract_value?: string;
    contract_unit_currency?: string;
    underlying_asset?: {
      symbol?: string;
    };
    quoting_asset?: {
      symbol?: string;
    };
    settling_asset?: {
      symbol?: string;
    };
  };
  created_at?: string;
  timestamp?: string;
  side?: string;
  size?: string | number;
  price?: string | number;
  commission?: string | number;
  realized_pnl?: string | number;
  meta_data?: {
    holding_minutes?: number | null;
    new_position?: {
      size?: string | number;
      entry_price?: string | number | null;
      realized_pnl?: string | number | null;
      total_commission_paid?: string | number | null;
    };
  };
}
