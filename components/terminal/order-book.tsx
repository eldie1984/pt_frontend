"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

interface OrderBookProps {
  symbol: string
}

interface BookLevelFromAPI {
  price?: number | string
  size?: number | string
  quantity?: number | string
  total?: number | string
}

interface BookFromAPI {
  symbol?: string
  asks?: BookLevelFromAPI[]
  bids?: BookLevelFromAPI[]
  spread?: number | string
  last_price?: number | string
  lastPrice?: number | string
  tick_direction?: "up" | "down" | "flat"
  tickDirection?: "up" | "down" | "flat"
}

interface BookLevel {
  price: number
  size: number
  total: number
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const n = typeof v === "string" ? parseFloat(v) : (v as number)
  return Number.isFinite(n) ? n : fallback
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtSize(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function fmtTotal(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function normalizeLevels(raw: BookLevelFromAPI[] | undefined): BookLevel[] {
  if (!raw) return []
  // Build cumulative totals if not provided
  let cum = 0
  return raw.map((r) => {
    const size = num(r.size ?? r.quantity)
    cum += size
    return {
      price: num(r.price),
      size,
      total: num(r.total, cum),
    }
  })
}

export function OrderBook({ symbol }: OrderBookProps) {
  const { token } = useAuth()
  const [asks, setAsks] = useState<BookLevel[]>([])
  const [bids, setBids] = useState<BookLevel[]>([])
  const [spread, setSpread] = useState<number>(0)
  const [lastPrice, setLastPrice] = useState<number>(0)
  const [tickDirection, setTickDirection] = useState<"up" | "down" | "flat">("flat")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${API_BASE}/api/transactions/orderbook/${encodeURIComponent(symbol)}`,
          { headers: authHeaders() },
        )
        if (!res.ok) throw new Error(`OrderBook ${res.status}`)
        const raw: BookFromAPI = await res.json()
        if (cancelled) return

        const askLevels = normalizeLevels(raw.asks).sort((a, b) => b.price - a.price) // highest first
        const bidLevels = normalizeLevels(raw.bids).sort((a, b) => b.price - a.price) // highest first

        const computedSpread =
          askLevels.length > 0 && bidLevels.length > 0
            ? askLevels[askLevels.length - 1].price - bidLevels[0].price
            : 0

        setAsks(askLevels)
        setBids(bidLevels)
        setSpread(num(raw.spread, computedSpread))
        setLastPrice(num(raw.last_price ?? raw.lastPrice))
        setTickDirection(raw.tick_direction ?? raw.tickDirection ?? "flat")
      } catch (err: unknown) {
        if (cancelled) return
        console.error("Failed to fetch order book:", err)
        setError(err instanceof Error ? err.message : "Failed to load order book")
        setAsks([])
        setBids([])
        setSpread(0)
        setLastPrice(0)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    // Light polling — 5s refresh while mounted
    const interval = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [symbol, authHeaders])

  // Imbalance: bid volume vs ask volume
  const bidVol = bids.reduce((s, b) => s + b.size, 0)
  const askVol = asks.reduce((s, a) => s + a.size, 0)
  const totalVol = bidVol + askVol
  const bidPct = totalVol > 0 ? (bidVol / totalVol) * 100 : 50
  const askPct = 100 - bidPct

  // For the depth bars, scale relative to the largest level in each side
  const maxAskSize = Math.max(1, ...asks.map((a) => a.size))
  const maxBidSize = Math.max(1, ...bids.map((b) => b.size))

  const tickArrow = tickDirection === "up" ? "▲" : tickDirection === "down" ? "▼" : "▶"
  const tickColor =
    tickDirection === "up"
      ? "text-[var(--green)]"
      : tickDirection === "down"
      ? "text-[var(--red)]"
      : "text-[var(--text-2)]"
  const tickLabel =
    tickDirection === "up" ? "UPTICK" : tickDirection === "down" ? "DOWNTICK" : "FLAT"

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex justify-between items-center py-2.5 px-3.5 border-b border-[var(--border-1)] font-mono text-[9px] tracking-[0.14em]">
        <span className="text-[var(--text-3)] uppercase">□ ORDER BOOK</span>
        <span className="text-[var(--accent)]">{symbol}</span>
      </div>

      <div className="py-1 px-3.5 font-mono text-[10px] text-[var(--text-2)] flex justify-between">
        <span>
          SPREAD <span className="text-[var(--text-1)]">${spread.toFixed(3)}</span>
        </span>
        <span className="text-[var(--accent)]">{fmtMoney(lastPrice)}</span>
      </div>

      <div className="grid grid-cols-3 py-[5px] px-3.5 font-mono text-[9px] text-[var(--text-3)] tracking-[0.08em]">
        <span>PRICE</span>
        <span className="text-right">SIZE</span>
        <span className="text-right">TOTAL</span>
      </div>

      {isLoading && asks.length === 0 && bids.length === 0 && (
        <div className="py-6 text-center font-mono text-[10px] text-[var(--text-3)]">
          Loading order book…
        </div>
      )}

      {error && !isLoading && (
        <div className="m-3 p-2 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 font-mono text-[10px] text-[var(--red)]">
          {error}
        </div>
      )}

      {/* Asks (highest price at top) */}
      {asks.map((r, i) => (
        <div
          key={`ask-${i}-${r.price}`}
          className="grid grid-cols-3 py-[3px] px-3.5 font-mono text-[10px] relative cursor-pointer transition-[background] duration-[var(--trans)] hover:bg-[var(--bg-hover)]"
        >
          <div
            className="absolute top-0 bottom-0 right-0 bg-[var(--red)] opacity-10 pointer-events-none"
            style={{ width: `${Math.min(100, (r.size / maxAskSize) * 100)}%` }}
          />
          <span className="relative z-[1] text-[var(--red)]">{fmtMoney(r.price)}</span>
          <span className="relative z-[1] text-right text-[var(--text-2)]">{fmtSize(r.size)}</span>
          <span className="relative z-[1] text-right text-[var(--text-2)]">{fmtTotal(r.total)}</span>
        </div>
      ))}

      {/* Spread bar */}
      <div className="flex items-center justify-center gap-2.5 py-1.5 px-3.5 bg-[var(--bg-muted)] border-y border-[var(--border-1)] font-mono text-[10px]">
        <span className="text-[var(--text-3)] text-[9px] tracking-[0.1em] uppercase">SPREAD</span>
        <span className="text-[var(--text-1)]">${spread.toFixed(3)}</span>
        <span className={`text-[13px] font-bold ${tickColor}`}>
          {tickArrow} {fmtMoney(lastPrice)}
        </span>
        <span className="font-mono text-[8px] text-[var(--text-3)]">{tickLabel}</span>
      </div>

      {/* Bids (highest price at top) */}
      {bids.map((r, i) => (
        <div
          key={`bid-${i}-${r.price}`}
          className="grid grid-cols-3 py-[3px] px-3.5 font-mono text-[10px] relative cursor-pointer transition-[background] duration-[var(--trans)] hover:bg-[var(--bg-hover)]"
        >
          <div
            className="absolute top-0 bottom-0 right-0 bg-[var(--green)] opacity-10 pointer-events-none"
            style={{ width: `${Math.min(100, (r.size / maxBidSize) * 100)}%` }}
          />
          <span className="relative z-[1] text-[var(--green)]">{fmtMoney(r.price)}</span>
          <span className="relative z-[1] text-right text-[var(--text-2)]">{fmtSize(r.size)}</span>
          <span className="relative z-[1] text-right text-[var(--text-2)]">{fmtTotal(r.total)}</span>
        </div>
      ))}

      {/* Imbalance */}
      <div className="flex items-center gap-2 py-1.5 px-3.5">
        <span className="font-mono text-[9px] text-[var(--green)]">{bidPct.toFixed(0)}% BID</span>
        <div className="flex-1 h-[3px] bg-[var(--bg-muted)] rounded-[3px] overflow-hidden flex">
          <div className="bg-[var(--green)]" style={{ width: `${bidPct}%` }} />
          <div className="bg-[var(--red)]" style={{ width: `${askPct}%` }} />
        </div>
        <span className="font-mono text-[9px] text-[var(--red)]">{askPct.toFixed(0)}% ASK</span>
      </div>
    </div>
  )
}
