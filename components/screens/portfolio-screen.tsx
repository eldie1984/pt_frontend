"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Watchlist } from "@/components/watchlist"
import { PortfolioHero } from "@/components/portfolio/portfolio-hero"
import { StatsGrid } from "@/components/portfolio/stats-grid"
import { HoldingsTable, type Holding } from "@/components/portfolio/holdings-table"
import { ActivityLog, type ActivityEntry } from "@/components/portfolio/activity-log"
import { SignalsPanel, type Signal } from "@/components/portfolio/signals-panel"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

// ──────────────────────────────────────────────────────────────────────────────
// API shapes — defensive; we read only what we need.
// ──────────────────────────────────────────────────────────────────────────────

interface HoldingFromAPI {
  id: string | number
  portfolio_id?: string | number
  instrument_id?: string | number
  quantity: number
  average_cost: number
  market_value: number
  unrealized_pnl?: number
  symbol: string
  instrument_name?: string
  instrument_type?: string
  exchange?: string
  currency?: string
}

interface PortfolioFromAPI {
  id: string | number
  user_id?: string | number
  name?: string
  description?: string | null
  cash_balance?: number
  currency?: string
  total_value?: number
  day_change?: number
  day_change_percent?: number
  holdings?: HoldingFromAPI[]
}

interface TransactionFromAPI {
  id: string | number
  type: "buy" | "sell"
  symbol?: string
  quantity?: number
  price?: number
  transaction_date: string
  total_amount?: number
}

interface SignalFromAPI {
  id: string | number
  symbol?: string
  signal?: string
  action?: "buy" | "sell" | "hold"
  confidence?: number
  created_at?: string
  message?: string
}

// ──────────────────────────────────────────────────────────────────────────────
// Derived view-model used by children
// ──────────────────────────────────────────────────────────────────────────────

interface HeroData {
  totalValue: number
  dayChange: number
  dayChangePercent: number
  cashPercent: number
}

interface StatsData {
  cash: number
  totalPnL: number
  totalPnLPercent: number
  positions: number
  orders: number
  winRate: number | null
  signals: number
  marketValue: number
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

export function PortfolioScreen() {
  const { token, logout, refreshToken } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [hero, setHero] = useState<HeroData>({
    totalValue: 0,
    dayChange: 0,
    dayChangePercent: 0,
    cashPercent: 100,
  })
  const [stats, setStats] = useState<StatsData>({
    cash: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    positions: 0,
    orders: 0,
    winRate: null,
    signals: 0,
    marketValue: 0,
  })
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [signals, setSignals] = useState<Signal[]>([])

  const fetchAll = useCallback(async (signal?: AbortSignal) => {
    if (!token) return
    setIsLoading(true)
    setError(null)

    // Headers are rebuilt after a successful refresh so the retry uses the new token.
    let headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }

    // Sends the user to login (cleans up auth state first) and stops the run.
    const redirectToLogin = () => {
      logout()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
    }

    try {
      // 1) Portfolios list — also the gate where we detect a stale token.
      let listRes = await fetch(`${API_BASE}/api/portfolio/list`, { headers, signal })

      if (listRes.status === 401) {
        // Token is stale. Ask the server for a new one; if that fails, redirect.
        const newToken = await refreshToken()
        if (!newToken) {
          redirectToLogin()
          return
        }
        headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
        }
        listRes = await fetch(`${API_BASE}/api/portfolio/list`, { headers, signal })
        if (listRes.status === 401) {
          redirectToLogin()
          return
        }
      }

      if (!listRes.ok) throw new Error("Failed to fetch portfolios")
      const portfoliosList: PortfolioFromAPI[] = await listRes.json()

      if (!portfoliosList || portfoliosList.length === 0) {
        // Nothing yet — clear out view-models
        setHero({ totalValue: 0, dayChange: 0, dayChangePercent: 0, cashPercent: 100 })
        setStats({
          cash: 0,
          totalPnL: 0,
          totalPnLPercent: 0,
          positions: 0,
          orders: 0,
          winRate: null,
          signals: 0,
          marketValue: 0,
        })
        setHoldings([])
        setActivity([])
        setSignals([])
        return
      }

      const portfolioId = portfoliosList[0].id

      // 2) Run portfolio detail, transactions, and signals in parallel
      const [portfolioRes, txRes, signalsRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/portfolio/${portfolioId}`, { headers, signal }),
        fetch(`${API_BASE}/api/portfolio/${portfolioId}/transactions`, { headers, signal }),
        fetch(`${API_BASE}/api/portfolio/${portfolioId}/signals`, { headers, signal }),
      ])

      // If any of the parallel calls came back 401, the token died between the
      // list call and now — bail out to login rather than rendering partial UI.
      const any401 = [portfolioRes, txRes, signalsRes].some(
        (r) => r.status === "fulfilled" && r.value.status === 401,
      )
      if (any401) {
        redirectToLogin()
        return
      }

      // ─── Portfolio detail → hero, stats, holdings ─────────────────────────
      if (portfolioRes.status === "fulfilled" && portfolioRes.value.ok) {
        const portfolio: PortfolioFromAPI = await portfolioRes.value.json()
        const rawHoldings = portfolio.holdings ?? []

        const marketValue = rawHoldings.reduce((sum, h) => sum + (h.market_value || 0), 0)
        const totalPnL = rawHoldings.reduce((sum, h) => sum + (h.unrealized_pnl || 0), 0)
        const costBasis = rawHoldings.reduce(
          (sum, h) => sum + (h.average_cost || 0) * (h.quantity || 0),
          0,
        )
        const totalPnLPercent = costBasis > 0 ? (totalPnL / costBasis) * 100 : 0

        const cash = portfolio.cash_balance ?? 0
        const totalValue = portfolio.total_value ?? marketValue + cash
        const cashPercent = totalValue > 0 ? (cash / totalValue) * 100 : 100

        setHero({
          totalValue,
          dayChange: portfolio.day_change ?? 0,
          dayChangePercent: portfolio.day_change_percent ?? 0,
          cashPercent,
        })

        setHoldings(
          rawHoldings.map((h) => {
            const pnl =
              h.unrealized_pnl ?? h.market_value - (h.average_cost || 0) * (h.quantity || 0)
            const cost = (h.average_cost || 0) * (h.quantity || 0)
            const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0
            return {
              id: String(h.id),
              symbol: h.symbol,
              shares: h.quantity,
              avgCost: h.average_cost,
              marketValue: h.market_value,
              pnl,
              pnlPercent,
            }
          }),
        )

        // Stats are derived from holdings + portfolio; positions/orders below get updated again from tx
        setStats((prev) => ({
          ...prev,
          cash,
          totalPnL,
          totalPnLPercent,
          positions: rawHoldings.length,
          marketValue,
        }))
      }

      // ─── Transactions → activity log + order count ─────────────────────────
      if (txRes.status === "fulfilled" && txRes.value.ok) {
        const txs: TransactionFromAPI[] = await txRes.value.json()
        const entries: ActivityEntry[] = (txs ?? [])
          .slice(0, 20)
          .map((t) => ({
            id: String(t.id),
            time: formatTime(t.transaction_date),
            kind: t.type === "buy" ? "BUY" : "SELL",
            msg: `${t.type === "buy" ? "Bought" : "Sold"} ${t.quantity ?? "?"} ${
              t.symbol ?? ""
            } @ $${(t.price ?? 0).toFixed(2)}`.trim(),
          }))
        setActivity(entries)
        setStats((prev) => ({ ...prev, orders: txs?.length ?? 0 }))
      } else {
        setActivity([])
      }

      // ─── Signals → side panel + signals stat ──────────────────────────────
      if (signalsRes.status === "fulfilled" && signalsRes.value.ok) {
        const raw: SignalFromAPI[] = await signalsRes.value.json()
        const items: Signal[] = (raw ?? []).map((s) => ({
          id: String(s.id),
          symbol: s.symbol ?? "—",
          action: s.action ?? "hold",
          confidence: s.confidence ?? 0,
          message: s.message ?? s.signal ?? "",
          time: s.created_at ? formatTime(s.created_at) : "",
        }))
        setSignals(items)
        setStats((prev) => ({ ...prev, signals: items.length }))
      } else {
        setSignals([])
      }
    } catch (err: unknown) {
      // Aborted by a newer effect run — drop silently.
      if ((err as { name?: string })?.name === "AbortError") return
      console.error("Portfolio fetch failed:", err)
      setError(err instanceof Error ? err.message : "Failed to load portfolio")
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [token, logout, refreshToken])

  useEffect(() => {
    const ctrl = new AbortController()
    fetchAll(ctrl.signal)
    return () => ctrl.abort()
  }, [fetchAll])

  return (
    <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <div className="hidden md:block">
        <Watchlist showOpenTerminal />
      </div>

      {/* Main */}
      <div className="flex-1 overflow-auto bg-[var(--bg-root)] transition-[background] duration-300 p-5">
        <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--text-3)] flex items-center gap-2.5 mb-3.5">
          <span className="text-[var(--accent)]">◆</span> TOTAL PORTFOLIO VALUE
          <span className="flex-1 h-px bg-[var(--border-1)]" />
          {isLoading && <span className="text-[var(--text-3)]">syncing…</span>}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 font-mono text-xs text-[var(--red)] flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => fetchAll()}
              className="ml-4 underline cursor-pointer hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        <PortfolioHero
          totalValue={hero.totalValue}
          dayChange={hero.dayChange}
          dayChangePercent={hero.dayChangePercent}
          cashPercent={hero.cashPercent}
          isLoading={isLoading}
        />
        <StatsGrid stats={stats} isLoading={isLoading} />
        <HoldingsTable holdings={holdings} isLoading={isLoading} />
        <ActivityLog entries={activity} isLoading={isLoading} />
      </div>

      {/* Right Panel */}
      <div className="hidden lg:flex w-[270px] shrink-0 border-l border-[var(--border-1)] bg-[var(--bg-deep)] flex-col transition-[background] duration-300">
        <SignalsPanel signals={signals} isLoading={isLoading} />
      </div>
    </div>
  )
}
