"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { getInstruments } from "@/lib/api/instruments"

interface WatchItem {
  sym: string
  name: string
  price: string
  chg: string
  up: boolean
}

interface WatchlistProps {
  onSelect?: (symbol: string) => void
  showOpenTerminal?: boolean
}

// Defensive shape — we read whatever fields the API actually returns.
type ApiInstrument = {
  id?: string | number
  symbol?: string
  name?: string
  current_price?: number | string | null
  price?: number | string | null
  change_percent?: number | string | null
  change?: number | string | null
  [key: string]: unknown
}

function formatPrice(value: unknown): string {
  const n = typeof value === "string" ? parseFloat(value) : (value as number | undefined)
  if (n == null || Number.isNaN(n)) return "—"
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatChange(value: unknown): { chg: string; up: boolean } {
  const n = typeof value === "string" ? parseFloat(value) : (value as number | undefined)
  if (n == null || Number.isNaN(n)) return { chg: "—", up: true }
  const up = n >= 0
  return { chg: `${up ? "+" : ""}${n.toFixed(2)}%`, up }
}

export function Watchlist({ onSelect, showOpenTerminal = false }: WatchlistProps) {
  const { token } = useAuth()
  const [items, setItems] = useState<WatchItem[]>([])
  const [activeSymbol, setActiveSymbol] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!token) {
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const raw = (await getInstruments(token)) as unknown as ApiInstrument[]
        if (cancelled) return

        const mapped: WatchItem[] = (raw ?? [])
          .filter((r) => !!r.symbol)
          .map((r) => {
            const { chg, up } = formatChange(r.change_percent ?? r.change)
            return {
              sym: String(r.symbol),
              name: String(r.name ?? r.symbol),
              price: formatPrice(r.current_price ?? r.price),
              chg,
              up,
            }
          })

        setItems(mapped)
        if (mapped.length > 0) setActiveSymbol((prev) => prev || mapped[0].sym)
      } catch (err: unknown) {
        if (cancelled) return
        console.error("Failed to fetch watchlist instruments:", err)
        setError(err instanceof Error ? err.message : "Failed to load watchlist")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSelect = (sym: string) => {
    setActiveSymbol(sym)
    onSelect?.(sym)
  }

  return (
    <div className="w-[210px] shrink-0 bg-[var(--bg-deep)] border-r border-[var(--border-1)] flex flex-col transition-[background] duration-300">
      <div className="flex justify-between items-center py-[11px] px-3.5 border-b border-[var(--border-1)] font-mono text-[9px] tracking-[0.16em] uppercase">
        <span className="text-[var(--text-3)] flex items-center gap-1.5">
          <span className="text-[var(--accent)]">▤</span> WATCHLIST
        </span>
        <span className="text-[var(--text-3)]">
          {isLoading ? "loading…" : `${items.length} symbols`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="py-6 px-3.5 font-mono text-[10px] text-[var(--text-3)] text-center">
            Loading instruments…
          </div>
        )}

        {!isLoading && error && (
          <div className="m-3 p-2 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 font-mono text-[10px] text-[var(--red)]">
            {error}
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="py-6 px-3.5 font-mono text-[10px] text-[var(--text-3)] text-center">
            No instruments to watch
          </div>
        )}

        {!isLoading && !error && items.map((w) => (
          <div
            key={w.sym}
            onClick={() => handleSelect(w.sym)}
            className={`flex justify-between items-center py-[11px] px-3.5 border-b border-[var(--border-1)] cursor-pointer transition-[background] duration-[var(--trans)] relative ${
              activeSymbol === w.sym ? "bg-[var(--accent-glow)]" : "hover:bg-[var(--bg-hover)]"
            }`}
          >
            <div
              className={`absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--accent)] transition-opacity duration-[var(--trans)] ${
                activeSymbol === w.sym ? "opacity-100" : "opacity-0"
              }`}
            />
            <div>
              <div className="font-heading text-sm font-semibold text-[var(--text-1)]">{w.sym}</div>
              <div className="font-sans text-[10px] text-[var(--text-3)] mt-px">{w.name}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[11px] text-[var(--text-1)]">{w.price}</div>
              <div className={`font-mono text-[10px] ${w.up ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                {w.chg !== "—" ? (w.up ? '▲' : '▼') : ''}{w.chg}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showOpenTerminal && (
        <button className="m-3 py-3 px-2 bg-transparent border border-[var(--accent-dim)] rounded-[var(--radius)] text-[var(--accent)] font-mono text-[10px] tracking-[0.1em] cursor-pointer transition-all duration-[var(--trans)] flex items-center justify-center gap-1.5 hover:bg-[var(--accent-glow)] hover:shadow-[var(--shadow-glow)]">
          ○ OPEN TRADING TERMINAL →
        </button>
      )}
    </div>
  )
}
