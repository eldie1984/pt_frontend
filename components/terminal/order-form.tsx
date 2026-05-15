"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

interface OrderFormProps {
  symbol: string
  currentPrice: number
}

interface PortfolioFromAPI {
  id: string | number
  cash_balance?: number | string
  cashBalance?: number | string
  commission_rate?: number | string
  default_commission?: number | string
}

type OrderType = "MARKET" | "LIMIT"
type Side = "buy" | "sell"
type SubmitState = "idle" | "submitting" | "success" | "error"

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const n = typeof v === "string" ? parseFloat(v) : (v as number)
  return Number.isFinite(n) ? n : fallback
}

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function OrderForm({ symbol: externalSymbol, currentPrice }: OrderFormProps) {
  const { token } = useAuth()

  const [side, setSide] = useState<Side>("buy")
  const [symbol, setSymbol] = useState(externalSymbol)
  const [quantity, setQuantity] = useState("10")
  const [orderType, setOrderType] = useState<OrderType>("MARKET")

  const [portfolioId, setPortfolioId] = useState<string | number | null>(null)
  const [cash, setCash] = useState<number>(0)
  const [commissionRate, setCommissionRate] = useState<number>(0.0025) // 0.25% fallback
  const [cashLoading, setCashLoading] = useState(true)
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  )

  // Sync the symbol input when the parent switches symbols (e.g. via Watchlist)
  useEffect(() => {
    setSymbol(externalSymbol)
  }, [externalSymbol])

  // Fetch cash balance + portfolio id once we have a token
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) {
        setCashLoading(false)
        return
      }
      setCashLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/portfolio/list`, { headers: authHeaders() })
        if (!res.ok) throw new Error("Failed to load portfolios")
        const portfolios: PortfolioFromAPI[] = await res.json()
        if (cancelled) return
        if (portfolios && portfolios.length > 0) {
          const p = portfolios[0]
          setPortfolioId(p.id)
          setCash(num(p.cash_balance ?? p.cashBalance, 0))
          setCommissionRate(num(p.commission_rate ?? p.default_commission, 0.0025))
        }
      } catch (err: unknown) {
        if (!cancelled) console.error("Failed to fetch portfolio for order form:", err)
      } finally {
        if (!cancelled) setCashLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token, authHeaders])

  // ─── Derived order cost preview (real numbers) ────────────────────────────
  const qtyNum = num(quantity, 0)
  const subtotal = qtyNum * currentPrice
  const commission = subtotal * commissionRate
  const slippage = orderType === "MARKET" ? subtotal * 0.0003 : 0 // 3 bps for market orders
  const netCost = side === "buy" ? subtotal + commission + slippage : subtotal - commission - slippage

  // ─── Place order ───────────────────────────────────────────────────────────
  const submitOrder = async () => {
    if (!token || submitState === "submitting") return
    if (!portfolioId) {
      setErrorMsg("No portfolio available")
      setSubmitState("error")
      return
    }
    if (qtyNum <= 0) {
      setErrorMsg("Quantity must be > 0")
      setSubmitState("error")
      return
    }

    setSubmitState("submitting")
    setErrorMsg(null)

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          portfolio_id: portfolioId,
          symbol: symbol.toUpperCase(),
          side,
          quantity: qtyNum,
          order_type: orderType,
          price: currentPrice,
        }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(txt || `Order failed (${res.status})`)
      }
      setSubmitState("success")

      // Refresh cash after a successful order
      try {
        const refresh = await fetch(`${API_BASE}/api/portfolio/${portfolioId}`, {
          headers: authHeaders(),
        })
        if (refresh.ok) {
          const p: PortfolioFromAPI = await refresh.json()
          setCash(num(p.cash_balance ?? p.cashBalance, cash))
        }
      } catch {
        /* non-fatal */
      }

      setTimeout(() => setSubmitState("idle"), 2000)
    } catch (err: unknown) {
      console.error("Order failed:", err)
      setErrorMsg(err instanceof Error ? err.message : "Order failed")
      setSubmitState("error")
    }
  }

  return (
    <div className="p-3.5 border-b border-[var(--border-1)]">
      <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)] mb-1">
        Available Cash
      </div>
      <div className="font-heading text-lg font-bold text-[var(--text-1)] mb-3.5">
        {cashLoading ? "—" : money(cash)}
      </div>

      <div className="flex gap-px rounded-[var(--radius)] overflow-hidden mb-3.5">
        <button
          onClick={() => setSide("buy")}
          className={`flex-1 py-[9px] text-center font-heading text-sm font-bold tracking-[0.06em] border-none cursor-pointer transition-all duration-[var(--trans)] ${
            side === "buy"
              ? "bg-[var(--green)] text-white"
              : "bg-[var(--bg-muted)] text-[var(--text-3)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-2)]"
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`flex-1 py-[9px] text-center font-heading text-sm font-bold tracking-[0.06em] border-none cursor-pointer transition-all duration-[var(--trans)] ${
            side === "sell"
              ? "bg-[var(--red)] text-white"
              : "bg-[var(--bg-muted)] text-[var(--text-3)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-2)]"
          }`}
        >
          SELL
        </button>
      </div>

      <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-[5px]">
        Symbol
      </div>
      <input
        type="text"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-[9px] px-[11px] text-[var(--text-1)] font-mono text-xs outline-none transition-all duration-[var(--trans)] mb-2.5 focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-glow2)]"
      />

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-[5px]">
            Quantity
          </div>
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-[9px] px-[11px] text-[var(--text-1)] font-mono text-xs outline-none transition-all duration-[var(--trans)] mb-2.5 focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-glow2)]"
          />
        </div>
        <div>
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-[5px]">
            Type
          </div>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as OrderType)}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-[9px] px-[11px] pr-7 text-[var(--text-1)] font-mono text-[11px] outline-none cursor-pointer appearance-none mb-2.5 transition-[border-color] duration-[var(--trans)] focus:border-[var(--accent)] bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%279%27%20height%3D%275%27%3E%3Cpath%20d%3D%27M0%200l4.5%205L9%200z%27%20fill%3D%27%236fa8cc%27%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_9px_center]"
          >
            <option value="MARKET">MARKET</option>
            <option value="LIMIT">LIMIT</option>
          </select>
        </div>
      </div>

      <div className="bg-[var(--bg-muted)] border border-[var(--border-1)] rounded-[var(--radius)] p-[10px_12px] mb-3">
        <div className="font-mono text-[8px] tracking-[0.14em] uppercase text-[var(--text-3)] mb-[7px]">
          ORDER COST PREVIEW
        </div>
        <div className="flex justify-between font-mono text-[10px] mb-1">
          <span className="text-[var(--text-3)]">Subtotal</span>
          <span className="text-[var(--text-2)]">{money(subtotal)}</span>
        </div>
        <div className="flex justify-between font-mono text-[10px] mb-1">
          <span className="text-[var(--text-3)]">Commission</span>
          <span className="text-[var(--text-2)]">{money(commission)}</span>
        </div>
        <div className="flex justify-between font-mono text-[10px] mb-1">
          <span className="text-[var(--text-3)]">Slippage est.</span>
          <span className="text-[var(--text-2)]">{money(slippage)}</span>
        </div>
        <div className="flex justify-between font-mono text-xs">
          <span className="text-[var(--text-1)]">Net {side === "buy" ? "Cost" : "Proceeds"}</span>
          <span className="text-[var(--text-1)]">{money(netCost)}</span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-2 px-2 py-1.5 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 font-mono text-[10px] text-[var(--red)]">
          {errorMsg}
        </div>
      )}
      {submitState === "success" && (
        <div className="mb-2 px-2 py-1.5 rounded-[var(--radius)] bg-[var(--green)]/10 border border-[var(--green)]/30 font-mono text-[10px] text-[var(--green)]">
          ✓ Order placed
        </div>
      )}

      <button
        onClick={submitOrder}
        disabled={submitState === "submitting" || cashLoading || currentPrice <= 0}
        className={`w-full py-[13px] border-none rounded-[var(--radius)] font-heading text-[15px] font-bold tracking-[0.08em] uppercase cursor-pointer transition-all duration-[var(--trans)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none ${
          side === "buy"
            ? "bg-[var(--green)] text-white hover:shadow-[0_4px_16px_var(--green-bg)] hover:-translate-y-px"
            : "bg-[var(--red)] text-white hover:shadow-[0_4px_16px_var(--red-bg)] hover:-translate-y-px"
        }`}
      >
        {submitState === "submitting" ? "PLACING…" : `PLACE ${side.toUpperCase()} ORDER`}
      </button>
    </div>
  )
}
