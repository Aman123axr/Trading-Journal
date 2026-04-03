import { useEffect, useMemo, useState } from "react";
import type { BehaviorInsight, CalendarResponse, DashboardSummary, MarketPulse, Signal, SyncResponse, Trade, TradesResponse } from "./types";

type TabId = "calendar" | "trades" | "analysis" | "market";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "calendar", label: "Calendar" },
  { id: "trades", label: "Trades" },
  { id: "analysis", label: "Analysis" },
  { id: "market", label: "Market Intel" },
];

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error((await response.text()) || `Request failed: ${response.status}`);
  return (await response.json()) as T;
}

const money = (value: number) => `${value > 0 ? "+" : ""}$${value.toFixed(2)}`;
const tone = (value: number) => (value >= 0 ? "positive" : "negative");
const signalTone = (value: Signal) => (value === "buy" ? "signal-buy" : value === "sell" ? "signal-sell" : "signal-hold");
const insightTone = (value: BehaviorInsight["severity"]) => (value === "good" ? "badge-buy" : value === "bad" ? "badge-sell" : "badge-hold");
const sessionTone = (value: string) => (value === "Asia" ? "badge-purple" : value === "Europe" ? "badge-blue" : value === "US" ? "badge-gold" : "badge-muted");

function computeMetrics(trades: Trade[]) {
  const wins = trades.filter((trade) => trade.realizedPnl > 0);
  const losses = trades.filter((trade) => trade.realizedPnl <= 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.realizedPnl, 0));
  const sessionMap = new Map<string, { pnl: number; count: number; wins: number }>();
  const assetMap = new Map<string, { pnl: number; count: number }>();

  for (const trade of trades) {
    const session = sessionMap.get(trade.session) ?? { pnl: 0, count: 0, wins: 0 };
    session.pnl += trade.realizedPnl;
    session.count += 1;
    if (trade.realizedPnl > 0) session.wins += 1;
    sessionMap.set(trade.session, session);

    const asset = assetMap.get(trade.asset) ?? { pnl: 0, count: 0 };
    asset.pnl += trade.realizedPnl;
    asset.count += 1;
    assetMap.set(trade.asset, asset);
  }

  return {
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? Math.abs(losses.reduce((sum, trade) => sum + trade.realizedPnl, 0) / losses.length) : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
    overtradeFlags: trades.filter((trade) => trade.flags.includes("overtrading")).length,
    riskFlags: trades.filter((trade) => trade.flags.includes("risk")).length,
    sessions: [...sessionMap.entries()].map(([name, data]) => ({ name, ...data, wr: data.count ? (data.wins / data.count) * 100 : 0 })),
    assets: [...assetMap.entries()].map(([name, data]) => ({ name, ...data })).sort((a, b) => b.pnl - a.pnl),
  };
}

function Stat({ label, value, sub, className = "" }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="stat-box">
      <div className={`stat-value ${className}`}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

export default function App() {
  const today = new Date();
  const [tab, setTab] = useState<TabId>("calendar");
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [insights, setInsights] = useState<BehaviorInsight[]>([]);
  const [marketPulse, setMarketPulse] = useState<MarketPulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState("all");

  useEffect(() => {
    void loadDashboard();
  }, [month]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, calendarData, tradesData, insightsData, marketData] = await Promise.all([
        fetchJson<DashboardSummary>("/api/dashboard/summary"),
        fetchJson<CalendarResponse>(`/api/calendar?month=${month}`),
        fetchJson<TradesResponse>("/api/trades"),
        fetchJson<{ items: BehaviorInsight[] }>("/api/insights"),
        fetchJson<MarketPulse>("/api/market-pulse"),
      ]);
      setSummary(summaryData);
      setCalendar(calendarData);
      setTrades(tradesData.items);
      setInsights(insightsData.items);
      setMarketPulse(marketData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function runSync() {
    setSyncing(true);
    try {
      const response = await fetchJson<SyncResponse>("/api/sync/delta", { method: "POST" });
      await loadDashboard();
      if (response.source === "demo") setError(response.message);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Unable to sync Delta data");
    } finally {
      setSyncing(false);
    }
  }

  const availableAssets = useMemo(() => ["all", ...new Set(trades.map((trade) => trade.asset))], [trades]);
  const filteredTrades = useMemo(() => (assetFilter === "all" ? trades : trades.filter((trade) => trade.asset === assetFilter)), [assetFilter, trades]);
  const metrics = useMemo(() => computeMetrics(trades), [trades]);
  const greenDays = calendar ? calendar.weeks.flatMap((week) => week.days).filter((day) => day && day.pnl > 0).length : 0;
  const activeDays = calendar ? calendar.weeks.flatMap((week) => week.days).filter((day) => day && day.trades > 0).length : 0;

  const moveMonth = (direction: -1 | 1) => {
    const [year, monthPart] = month.split("-").map(Number);
    const next = new Date(year, monthPart - 1 + direction, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className={`terminal-shell ${loading ? "loading" : ""}`}>
      <header className="terminal-header">
        <div className="header-inner">
          <div className="brand-block">
            <div className="brand-icon">CJ</div>
            <div>
              <div className="brand-title">CryptoJournal</div>
              <div className="brand-subtitle">Delta Exchange Connected</div>
            </div>
          </div>
          <div className="header-stats">
            <Stat label="Total P&L" value={summary ? money(summary.netPnl) : "$0.00"} className={summary ? tone(summary.netPnl) : ""} />
            <Stat label="Win Rate" value={summary ? `${summary.winRate.toFixed(1)}%` : "0.0%"} />
            <Stat label="Trades" value={summary ? String(summary.totalTrades) : "0"} />
          </div>
          <div className="header-actions">
            <button className="terminal-btn ghost" onClick={() => void loadDashboard()}>Refresh</button>
            <button className="terminal-btn primary" onClick={() => void runSync()} disabled={syncing}>{syncing ? "Syncing..." : "Sync Delta"}</button>
          </div>
        </div>
        <div className="tab-row">
          {tabs.map((item) => <button key={item.id} className={`tab-btn ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>)}
        </div>
      </header>

      <main className="terminal-content">
        {error ? <div className="status-card"><div><div className="section-label">Status</div><strong>{error}</strong></div><button className="terminal-btn ghost" onClick={() => void loadDashboard()}>Retry</button></div> : null}

        {tab === "calendar" ? (
          <section className="view-stack">
            <div className="terminal-card month-header">
              <div className="month-nav">
                <button className="nav-btn" onClick={() => moveMonth(-1)}>‹</button>
                <div className="month-title">{monthFormatter.format(new Date(`${month}-01T00:00:00`))}</div>
                <button className="nav-btn" onClick={() => moveMonth(1)}>›</button>
              </div>
              <div className="month-stats">
                <Stat label="Month P&L" value={summary ? money(summary.netPnl) : "$0.00"} className={summary ? tone(summary.netPnl) : ""} />
                <Stat label="Active Days" value={String(activeDays)} />
                <Stat label="Green Days" value={`${greenDays}/${activeDays || 0}`} className="positive" />
              </div>
            </div>
            <div className="terminal-card">
              <div className="calendar-head terminal-grid"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div className="week-head">Week</div></div>
              {calendar ? calendar.weeks.map((week) => (
                <div className="calendar-row terminal-grid" key={week.summary.label}>
                  {week.days.map((day, index) => day ? (
                    <div key={day.date} className={`calendar-cell ${day.tone}`}>
                      <div className="calendar-top"><span className="calendar-day">{day.dayOfMonth}</span>{day.trades > 0 ? <span className="calendar-trade-count">{day.trades}t</span> : null}</div>
                      <div className={`calendar-pnl ${tone(day.pnl)}`}>{money(day.pnl)}</div>
                    </div>
                  ) : <div key={`${week.summary.label}-${index}`} className="calendar-cell empty" />)}
                  <div className="week-total"><span className="week-label">{week.summary.label}</span><strong className={tone(week.summary.pnl)}>{money(week.summary.pnl)}</strong><span>{week.summary.trades} trades</span></div>
                </div>
              )) : <div className="empty-panel">No calendar data yet.</div>}
            </div>
          </section>
        ) : null}

        {tab === "trades" ? (
          <section className="view-stack">
            <div className="toolbar-row">
              <div className="chip-row">{availableAssets.map((asset) => <button key={asset} className={`filter-chip ${assetFilter === asset ? "active" : ""}`} onClick={() => setAssetFilter(asset)}>{asset === "all" ? "All" : asset}</button>)}</div>
              <div className="toolbar-note">Latest sync: {summary?.latestSync ? timeFormatter.format(new Date(summary.latestSync)) : "Never"}</div>
            </div>
            <div className="terminal-card trade-table-wrap">
              <table className="terminal-table">
                <thead><tr><th>Date</th><th>Asset</th><th>Side</th><th>Price</th><th>Qty</th><th>Session</th><th>P&L</th><th>Flags</th></tr></thead>
                <tbody>
                  {filteredTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td>{timeFormatter.format(new Date(trade.timestamp))}</td>
                      <td><strong>{trade.asset}</strong><div className="cell-sub">{trade.productSymbol}</div></td>
                      <td><span className={`inline-badge ${trade.side === "buy" ? "badge-buy" : "badge-sell"}`}>{trade.side}</span></td>
                      <td className="mono-cell">${trade.price.toFixed(2)}</td>
                      <td className="mono-cell">{trade.lotSize}</td>
                      <td><span className={`inline-badge ${sessionTone(trade.session)}`}>{trade.session}</span></td>
                      <td className={`mono-cell ${tone(trade.realizedPnl)}`}>{money(trade.realizedPnl)}</td>
                      <td><div className="flag-row">{trade.flags.length ? trade.flags.map((flag) => <span key={`${trade.id}-${flag}`} className={`inline-badge ${flag.includes("risk") || flag.includes("loss") ? "badge-sell" : flag.includes("good") ? "badge-buy" : "badge-hold"}`}>{flag}</span>) : <span className="cell-sub">Clean</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "analysis" ? (
          <section className="view-stack">
            <div className="analysis-grid-top">
              <div className="terminal-card"><div className="section-label">Win Rate</div><div className={`big-metric ${summary && summary.winRate >= 50 ? "positive" : "negative"}`}>{summary ? `${summary.winRate.toFixed(1)}%` : "0.0%"}</div><div className="card-subtext">{summary?.totalTrades ?? 0} trades tracked</div></div>
              <div className="terminal-card"><div className="section-label">Profit Factor</div><div className="big-metric">{metrics.profitFactor.toFixed(2)}</div><div className="card-subtext">Gross winners vs losers</div></div>
              <div className="terminal-card"><div className="section-label">Average Win</div><div className="big-metric positive">{money(metrics.avgWin)}</div><div className="card-subtext">Mean positive realized P&L</div></div>
              <div className="terminal-card"><div className="section-label">Average Loss</div><div className="big-metric negative">{money(-metrics.avgLoss)}</div><div className="card-subtext">Mean negative realized P&L</div></div>
            </div>
            <div className="analysis-panels">
              <div className="terminal-card"><div className="card-title">Session Edge</div><div className="stack-list">{metrics.sessions.map((session) => <div key={session.name} className="list-row"><div><div className="list-title">{session.name}</div><div className="cell-sub">{session.count} trades</div></div><div className="list-stats"><span className={`mono-cell ${tone(session.pnl)}`}>{money(session.pnl)}</span><span className="cell-sub">{session.wr.toFixed(0)}% WR</span></div></div>)}</div></div>
              <div className="terminal-card"><div className="card-title">Asset Leaderboard</div><div className="stack-list">{metrics.assets.slice(0, 8).map((asset, index) => { const max = Math.max(...metrics.assets.map((row) => Math.abs(row.pnl)), 1); return <div key={asset.name} className="asset-row"><div className="asset-row-top"><span>{index + 1}. {asset.name}</span><span className={`mono-cell ${tone(asset.pnl)}`}>{money(asset.pnl)}</span></div><div className="bar-track"><div className={`bar-fill ${asset.pnl >= 0 ? "bar-positive" : "bar-negative"}`} style={{ width: `${Math.max(10, Math.abs(asset.pnl) / max * 100)}%` }} /></div></div>; })}</div></div>
            </div>
            <div className="analysis-panels">
              <div className="terminal-card"><div className="card-title">Discipline Diagnostics</div><div className="stack-list">{insights.map((insight) => <div key={insight.key} className="insight-terminal"><div className="insight-head"><div><div className="list-title">{insight.title}</div><div className="cell-sub">{insight.summary}</div></div><span className={`inline-badge ${insightTone(insight.severity)}`}>{insight.score}/100</span></div>{insight.evidence.map((item) => <div key={item} className="cell-sub">- {item}</div>)}</div>)}</div></div>
              <div className="terminal-card"><div className="card-title">Risk Snapshot</div><div className="stack-list"><div className="list-row"><span className="list-title">Overtrading Flags</span><span className="mono-cell negative">{metrics.overtradeFlags}</span></div><div className="list-row"><span className="list-title">Risk Flags</span><span className="mono-cell negative">{metrics.riskFlags}</span></div><div className="list-row"><span className="list-title">Most Traded Asset</span><span className="mono-cell">{summary?.topAsset ?? "-"}</span></div><div className="list-row"><span className="list-title">Most Active Session</span><span className="mono-cell">{summary?.topSession ?? "-"}</span></div></div></div>
            </div>
          </section>
        ) : null}

        {tab === "market" ? (
          <section className="view-stack">
            <div className="market-hero-card">
              <div className="section-label">Market Signal</div>
              <div className={`signal-display ${signalTone(marketPulse?.signal ?? "hold")}`}>{marketPulse ? marketPulse.signal.toUpperCase() : "HOLD"}</div>
              <div className="signal-chip-row"><span className="inline-badge badge-blue">Sentiment {marketPulse?.score ?? 0}</span><span className="inline-badge badge-muted">{marketPulse?.source ?? "No source"}</span><span className="inline-badge badge-gold">{marketPulse?.generatedAt ? timeFormatter.format(new Date(marketPulse.generatedAt)) : "No timestamp"}</span></div>
              <p className="market-summary-copy">{marketPulse?.summary ?? "Market pulse not available yet."}</p>
            </div>
            <div className="analysis-panels">
              <div className="terminal-card"><div className="card-title">Key Reasons</div><div className="stack-list">{marketPulse?.headlines.slice(0, 4).map((headline, index) => <div key={`${headline.source}-${headline.title}`} className="reason-row"><span className="reason-index">{index + 1}.</span><div><div className="list-title">{headline.title}</div><div className="cell-sub">{headline.reasoning}</div></div></div>) ?? <div className="cell-sub">No headlines available.</div>}</div></div>
              <div className="terminal-card"><div className="card-title">Watchlist</div><div className="stack-list">{marketPulse?.headlines.slice(0, 6).map((headline) => <div key={headline.title} className="list-row"><div><div className="list-title">{headline.source}</div><div className="cell-sub">{dateFormatter.format(new Date(headline.publishedAt))}</div></div><span className={`inline-badge ${headline.bias === "positive" ? "badge-buy" : headline.bias === "negative" ? "badge-sell" : "badge-hold"}`}>{headline.bias}</span></div>) ?? <div className="cell-sub">No watchlist items available.</div>}</div></div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
