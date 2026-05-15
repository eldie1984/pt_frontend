"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

const timeframes = ["1D", "1W", "1M", "3M", "1Y"] as const
type Timeframe = (typeof timeframes)[number]

interface ChartProps {
  symbol: string
  companyName: string
  price: string
  change: string
  isUp: boolean
}

interface HistoryPoint {
  price?: number | string
  close?: number | string
  c?: number | string
}

// Fit raw numeric series to the SVG viewBox (800×150) — inverted Y, with a
// little vertical padding so peaks/valleys don't kiss the edges.
function buildPath(values: number[], W = 800, H = 150, pad = 8): { line: string; fill: string } | null {
  if (!values || values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const innerH = H - pad * 2

  const n = values.length
  const points = values.map((v, i) => {
    const x = (i / (n - 1)) * W
    const y = pad + (1 - (v - min) / range) * innerH
    return { x, y }
  })

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")
  const fill = `${line} L${W},${H} L0,${H} Z`
  return { line, fill }
}

export function Chart({ symbol, companyName, price, change, isUp }: ChartProps) {
  const { token } = useAuth()
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>("1D")
  const [series, setSeries] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)
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
          `${API_BASE}/api/quotes/${encodeURIComponent(symbol)}/history?timeframe=${activeTimeframe}`,
          { headers: authHeaders() },
        )
        if (!res.ok) throw new Error(`History ${res.status}`)
        const raw = await res.json()

        // Accept either { points: number[] }, { points: HistoryPoint[] }, or a bare array
        const rawPoints: unknown[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { points?: unknown[] }).points)
          ? (raw as { points: unknown[] }).points
          : []

        const values: number[] = rawPoints
          .map((p) => {
            if (typeof p === "number") return p
            if (typeof p === "string") return parseFloat(p)
            if (p && typeof p === "object") {
              const obj = p as HistoryPoint
              const v = obj.close ?? obj.price ?? obj.c
              return typeof v === "string" ? parseFloat(v) : (v as number | undefined) ?? NaN
            }
            return NaN
          })
          .filter((v) => Number.isFinite(v))

        if (!cancelled) setSeries(values)
      } catch (err: unknown) {
        if (cancelled) return
        console.error("Failed to fetch history:", err)
        setError(err instanceof Error ? err.message : "Failed to load history")
        setSeries([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [symbol, activeTimeframe, authHeaders])

  const paths = buildPath(series)

  return (
    <div className="bg-[var(--bg-panel)] border-b border-[var(--border-1)]">
      <div className="flex justify-between items-center py-4 px-5">
        <div>
          <div className="font-heading text-xl font-bold text-[var(--text-1)]">{symbol}</div>
          <div className="font-sans text-[11px] text-[var(--text-3)]">{companyName}</div>
        </div>
        <div className="text-right">
          <div className="font-heading text-2xl font-bold text-[var(--text-1)]">{price}</div>
          <div className={`font-mono text-[11px] ${isUp ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
            {isUp ? "▲" : "▼"} {change}
          </div>
        </div>
      </div>

      <div className="flex gap-1 px-5 pb-2.5">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setActiveTimeframe(tf)}
            className={`py-1 px-[11px] rounded font-mono text-[10px] tracking-[0.06em] border cursor-pointer transition-all duration-[var(--trans)] ${
              activeTimeframe === tf
                ? "text-[var(--accent)] border-[var(--border-acc)] bg-[var(--accent-glow)]"
                : "text-[var(--text-3)] bg-transparent border-transparent hover:text-[var(--text-2)] hover:border-[var(--border-2)]"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="relative h-[170px] px-3 pb-3">
        {paths ? (
          <svg className="w-full h-full block" viewBox="0 0 800 150" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={paths.fill} fill="url(#chartGradient)" />
            <path d={paths.line} fill="none" strokeWidth="2" strokeLinejoin="round" stroke="var(--accent)" />
          </svg>
        ) : (
          <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-[var(--text-3)]">
            {isLoading ? "Loading chart…" : error ? error : "No history available"}
          </div>
        )}
      </div>
    </div>
  )
}
