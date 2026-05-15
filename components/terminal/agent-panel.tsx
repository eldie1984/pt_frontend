"use client"

import { useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

interface AgentPanelProps {
  symbol: string
}

type Action = "buy" | "sell" | "hold" | null

interface AnalysisFromAPI {
  symbol?: string
  action?: Action
  signal?: string
  confidence?: number | string
  reasoning?: string
  message?: string
  metrics?: {
    rsi?: number | string
    rsi14?: number | string
    macd?: number | string
    momentum?: number | string
  }
}

interface Analysis {
  action: Action
  confidence: number // 0..1
  reasoning: string
  metrics: { rsi: string; macd: string; momentum: string }
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === "string" ? parseFloat(v) : (v as number)
  return Number.isFinite(n) ? n : null
}

function fmtMetric(n: number | null): string {
  if (n == null) return "—"
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function fromApi(raw: AnalysisFromAPI): Analysis {
  const action = (raw.action ?? null) as Action
  const conf = num(raw.confidence)
  return {
    action,
    confidence: conf == null ? 0 : conf > 1 ? conf / 100 : conf,
    reasoning: raw.reasoning ?? raw.message ?? raw.signal ?? "No reasoning provided.",
    metrics: {
      rsi: fmtMetric(num(raw.metrics?.rsi ?? raw.metrics?.rsi14)),
      macd: fmtMetric(num(raw.metrics?.macd)),
      momentum: fmtMetric(num(raw.metrics?.momentum)),
    },
  }
}

export function AgentPanel({ symbol }: AgentPanelProps) {
  const { token } = useAuth()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderState, setOrderState] = useState<"idle" | "submitting" | "success" | "error">("idle")

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  )

  const analyze = async () => {
    if (isAnalyzing) return
    setIsAnalyzing(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/agent/analyze`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ symbol }),
      })
      if (!res.ok) throw new Error(`Analyze failed (${res.status})`)
      const raw: AnalysisFromAPI = await res.json()
      setAnalysis(fromApi(raw))
    } catch (err: unknown) {
      console.error("Agent analyze failed:", err)
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const submitAgentOrder = async (side: "buy" | "sell") => {
    if (!analysis || orderState === "submitting") return
    setOrderState("submitting")
    setError(null)
    try {
      // Fetch first portfolio id for routing
      const listRes = await fetch(`${API_BASE}/api/portfolio/list`, { headers: authHeaders() })
      if (!listRes.ok) throw new Error("No portfolio available")
      const portfolios = await listRes.json()
      const portfolioId = Array.isArray(portfolios) && portfolios.length > 0 ? portfolios[0].id : null
      if (!portfolioId) throw new Error("No portfolio available")

      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          portfolio_id: portfolioId,
          symbol,
          side,
          quantity: 1,
          order_type: "MARKET",
          source: "agent",
          agent_confidence: analysis.confidence,
        }),
      })
      if (!res.ok) throw new Error(`Order failed (${res.status})`)
      setOrderState("success")
      setTimeout(() => setOrderState("idle"), 2000)
    } catch (err: unknown) {
      console.error("Agent order failed:", err)
      setError(err instanceof Error ? err.message : "Order failed")
      setOrderState("error")
    }
  }

  const statusLabel = isAnalyzing ? "● ANALYZING" : analysis ? "● COMPLETE" : "● READY"
  const statusColor = isAnalyzing
    ? "text-[var(--accent)] bg-[var(--accent-glow)] border-[var(--border-acc)]"
    : "text-[var(--green)] bg-[var(--green-bg)] border-[var(--green-dim)]"

  const metrics = analysis?.metrics ?? { rsi: "—", macd: "—", momentum: "—" }
  const canBuy = analysis?.action === "buy"
  const canSell = analysis?.action === "sell"

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden m-3.5 shadow-[var(--shadow-sm)]">
      <div className="flex justify-between items-center py-[13px] px-4 border-b border-[var(--border-1)]">
        <div>
          <div className="font-heading text-[15px] font-semibold text-[var(--text-1)]">AI Trading Agent</div>
          <div className="font-mono text-[9px] text-[var(--text-3)] mt-0.5">Powered by Claude · Real-time</div>
        </div>
        <div className={`font-mono text-[9px] tracking-[0.1em] py-1 px-2.5 rounded-[20px] border ${statusColor}`}>
          {statusLabel}
        </div>
      </div>

      <div className="p-4">
        <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--text-3)] mb-2.5 flex items-center justify-between">
          <span>
            Signal for <span className="text-[var(--accent)]">{symbol}</span>
          </span>
          {analysis && (
            <span className="text-[var(--text-2)]">
              conf {(analysis.confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-px bg-[var(--border-1)] border border-[var(--border-1)] rounded-[var(--radius)] overflow-hidden mb-3.5">
          {[
            { label: "RSI(14)", value: metrics.rsi },
            { label: "MACD", value: metrics.macd },
            { label: "Momentum", value: metrics.momentum },
          ].map((metric) => (
            <div key={metric.label} className="bg-[var(--bg-card)] py-[9px] px-2.5 text-center">
              <div className="font-mono text-xs text-[var(--text-1)]">{metric.value}</div>
              <div className="font-mono text-[8px] text-[var(--text-3)] mt-0.5 tracking-[0.08em] uppercase">
                {metric.label}
              </div>
            </div>
          ))}
        </div>

        <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--text-3)] mb-2.5">
          Agent Reasoning
        </div>
        <div className="font-sans text-xs text-[var(--text-3)] bg-[var(--bg-input)] border border-[var(--border-1)] rounded-[var(--radius)] p-[10px_12px] mb-3.5 min-h-[52px]">
          {isAnalyzing
            ? "Analyzing market data…"
            : error
            ? <span className="text-[var(--red)]">{error}</span>
            : analysis
            ? analysis.reasoning
            : "Select a stock and click Analyze."}
        </div>

        {orderState === "success" && (
          <div className="mb-2 px-2 py-1.5 rounded-[var(--radius)] bg-[var(--green)]/10 border border-[var(--green)]/30 font-mono text-[10px] text-[var(--green)]">
            ✓ Order submitted
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={analyze}
            disabled={isAnalyzing}
            className="flex-1 py-[9px] border border-[var(--border-2)] rounded-[var(--radius)] bg-[var(--bg-input)] text-[var(--text-2)] font-mono text-[10px] tracking-[0.1em] cursor-pointer transition-all duration-[var(--trans)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-glow)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? "○ ANALYZING…" : "○ ANALYZE"}
          </button>
          <button
            onClick={() => submitAgentOrder("buy")}
            disabled={!canBuy || orderState === "submitting"}
            className={`py-[9px] px-4 border border-[var(--green-dim)] rounded-[var(--radius)] bg-[var(--green-bg)] text-[var(--green)] font-mono text-[10px] cursor-pointer transition-all duration-[var(--trans)] ${
              canBuy ? "opacity-100 hover:bg-[var(--green)] hover:text-white" : "opacity-50 cursor-not-allowed"
            }`}
          >
            ▲ BUY
          </button>
          <button
            onClick={() => submitAgentOrder("sell")}
            disabled={!canSell || orderState === "submitting"}
            className={`py-[9px] px-4 border border-[var(--red-dim)] rounded-[var(--radius)] bg-[var(--red-bg)] text-[var(--red)] font-mono text-[10px] cursor-pointer transition-all duration-[var(--trans)] ${
              canSell ? "opacity-100 hover:bg-[var(--red)] hover:text-white" : "opacity-50 cursor-not-allowed"
            }`}
          >
            ▼ SELL
          </button>
        </div>
      </div>
    </div>
  )
}
