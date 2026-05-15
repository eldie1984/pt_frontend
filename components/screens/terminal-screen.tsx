"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Watchlist } from "@/components/watchlist"
import { Chart } from "@/components/terminal/chart"
import { AgentPanel } from "@/components/terminal/agent-panel"
import { OrderForm } from "@/components/terminal/order-form"
import { OrderBook } from "@/components/terminal/order-book"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

interface Quote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

// Defensive shape — the API may return camelCase or snake_case
interface QuoteFromAPI {
  symbol?: string
  name?: string
  instrument_name?: string
  price?: number | string
  current_price?: number | string
  change?: number | string
  change_amount?: number | string
  change_percent?: number | string
  changePercent?: number | string
}

function parseNumber(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const n = typeof v === "string" ? parseFloat(v) : (v as number)
  return Number.isNaN(n) ? fallback : n
}

function quoteFromApi(raw: QuoteFromAPI, symbol: string): Quote {
  const price = parseNumber(raw.price ?? raw.current_price)
  const change = parseNumber(raw.change ?? raw.change_amount)
  const changePercent = parseNumber(raw.change_percent ?? raw.changePercent)
  return {
    symbol: raw.symbol ?? symbol,
    name: raw.name ?? raw.instrument_name ?? symbol,
    price,
    change,
    changePercent,
  }
}

function formatPrice(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatChange(percent: number): string {
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`
}

export function TerminalScreen() {
  const { token } = useAuth()
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL")
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  )

  // Fetch the live quote whenever the selected symbol changes
  useEffect(() => {
    let cancelled = false

    async function load() {
      setQuoteLoading(true)
      setQuoteError(null)
      try {
        const res = await fetch(
          `${API_BASE}/api/quotes/${encodeURIComponent(selectedSymbol)}`,
          { headers: authHeaders() },
        )
        if (!res.ok) throw new Error(`Quote ${res.status}`)
        const raw: QuoteFromAPI = await res.json()
        if (!cancelled) setQuote(quoteFromApi(raw, selectedSymbol))
      } catch (err: unknown) {
        if (cancelled) return
        console.error("Failed to fetch quote:", err)
        setQuoteError(err instanceof Error ? err.message : "Failed to load quote")
        // Fallback shell so children still render
        setQuote({
          symbol: selectedSymbol,
          name: selectedSymbol,
          price: 0,
          change: 0,
          changePercent: 0,
        })
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [selectedSymbol, authHeaders])

  const isUp = (quote?.change ?? 0) >= 0

  return (
    <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <div className="hidden md:block">
        <Watchlist onSelect={setSelectedSymbol} />
      </div>

      {/* Main: Chart + Agent */}
      <div className="flex-1 overflow-auto bg-[var(--bg-root)] transition-[background] duration-300 flex flex-col">
        {quoteError && (
          <div className="m-3.5 mb-0 px-4 py-2 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 font-mono text-[10px] text-[var(--red)]">
            {quoteError}
          </div>
        )}
        <Chart
          symbol={selectedSymbol}
          companyName={quote?.name ?? selectedSymbol}
          price={quote ? formatPrice(quote.price) : quoteLoading ? "—" : "$0.00"}
          change={quote ? formatChange(quote.changePercent) : "—"}
          isUp={isUp}
        />
        <div className="flex-1 p-3.5">
          <AgentPanel symbol={selectedSymbol} />
        </div>
      </div>

      {/* Right: Order Form + Book */}
      <div className="hidden lg:flex w-[270px] shrink-0 border-l border-[var(--border-1)] bg-[var(--bg-deep)] flex-col overflow-y-auto transition-[background] duration-300">
        <OrderForm symbol={selectedSymbol} currentPrice={quote?.price ?? 0} />
        <OrderBook symbol={selectedSymbol} />
      </div>
    </div>
  )
}
