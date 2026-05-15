"use client"

import { useState, useEffect, useCallback } from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/hooks/use-auth"
import { ExchangeManager } from "@/components/exchange-manager"
import { PortfolioManager } from "@/components/portfolio-manager"
import { BrokerManager } from "@/components/broker-manager"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

// ──────────────────────────────────────────────────────────────────────────────
// Preferences shape
// ──────────────────────────────────────────────────────────────────────────────

type RiskTolerance = "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE"
type OrderType = "MARKET" | "LIMIT"
type ThemeMode = "dark" | "light"
type SessionTimeout = "1 hour" | "4 hours" | "Never"
type Currency = "USD" | "EUR" | "GBP" | "ARS"

interface Preferences {
  displayName: string
  baseCurrency: Currency
  theme: ThemeMode
  riskTolerance: RiskTolerance
  defaultOrderType: OrderType
  defaultQuantity: string
  confirmBeforeSubmit: boolean
  autoAnalyzeOnSelect: boolean
  notifyAgentSignals: boolean
  notifyOrderFills: boolean
  sessionTimeout: SessionTimeout
}

const DEFAULT_PREFS: Preferences = {
  displayName: "",
  baseCurrency: "USD",
  theme: "dark",
  riskTolerance: "MODERATE",
  defaultOrderType: "MARKET",
  defaultQuantity: "10",
  confirmBeforeSubmit: true,
  autoAnalyzeOnSelect: false,
  notifyAgentSignals: true,
  notifyOrderFills: true,
  sessionTimeout: "1 hour",
}

// Map raw API payload (snake_case-tolerant) → typed Preferences
function fromApi(raw: Record<string, unknown>): Preferences {
  const pick = <T,>(...keys: string[]): T | undefined => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null) return raw[k] as T
    }
    return undefined
  }
  return {
    displayName: pick<string>("displayName", "display_name") ?? DEFAULT_PREFS.displayName,
    baseCurrency: (pick<Currency>("baseCurrency", "base_currency") ?? DEFAULT_PREFS.baseCurrency),
    theme: (pick<ThemeMode>("theme") ?? DEFAULT_PREFS.theme),
    riskTolerance:
      (pick<string>("riskTolerance", "risk_tolerance")?.toUpperCase() as RiskTolerance) ??
      DEFAULT_PREFS.riskTolerance,
    defaultOrderType:
      (pick<string>("defaultOrderType", "default_order_type")?.toUpperCase() as OrderType) ??
      DEFAULT_PREFS.defaultOrderType,
    defaultQuantity: String(
      pick<string | number>("defaultQuantity", "default_quantity") ?? DEFAULT_PREFS.defaultQuantity,
    ),
    confirmBeforeSubmit:
      pick<boolean>("confirmBeforeSubmit", "confirm_before_submit") ??
      DEFAULT_PREFS.confirmBeforeSubmit,
    autoAnalyzeOnSelect:
      pick<boolean>("autoAnalyzeOnSelect", "auto_analyze_on_select") ??
      DEFAULT_PREFS.autoAnalyzeOnSelect,
    notifyAgentSignals:
      pick<boolean>("notifyAgentSignals", "notify_agent_signals") ??
      DEFAULT_PREFS.notifyAgentSignals,
    notifyOrderFills:
      pick<boolean>("notifyOrderFills", "notify_order_fills") ?? DEFAULT_PREFS.notifyOrderFills,
    sessionTimeout:
      (pick<SessionTimeout>("sessionTimeout", "session_timeout") ?? DEFAULT_PREFS.sessionTimeout),
  }
}

// Outgoing payload — snake_case for typical REST conventions
function toApi(prefs: Preferences): Record<string, unknown> {
  return {
    display_name: prefs.displayName,
    base_currency: prefs.baseCurrency,
    theme: prefs.theme,
    risk_tolerance: prefs.riskTolerance,
    default_order_type: prefs.defaultOrderType,
    default_quantity: prefs.defaultQuantity,
    confirm_before_submit: prefs.confirmBeforeSubmit,
    auto_analyze_on_select: prefs.autoAnalyzeOnSelect,
    notify_agent_signals: prefs.notifyAgentSignals,
    notify_order_fills: prefs.notifyOrderFills,
    session_timeout: prefs.sessionTimeout,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Controlled atom components
// ──────────────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-[38px] h-[21px] rounded-[20px] border cursor-pointer relative transition-all duration-[var(--trans)] ${
        on
          ? "bg-[var(--accent-glow2)] border-[var(--accent)]"
          : "bg-[var(--bg-muted)] border-[var(--border-2)]"
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-[15px] h-[15px] rounded-full transition-all duration-250 ${
          on
            ? "bg-[var(--accent)] translate-x-[17px] shadow-[0_0_6px_var(--accent)]"
            : "bg-[var(--text-3)] translate-x-0"
        }`}
      />
    </button>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`py-1.5 px-3 font-mono text-[9px] tracking-[0.08em] uppercase cursor-pointer rounded transition-all duration-[var(--trans)] ${
            value === opt
              ? "bg-[var(--accent)] text-white border-[var(--accent)] font-bold"
              : "bg-[var(--bg-muted)] border border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--border-2)]"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function ThemeSegmented({
  value,
  onChange,
}: {
  value: ThemeMode
  onChange: (v: ThemeMode) => void
}) {
  const { setTheme } = useTheme()
  const select = (v: ThemeMode) => {
    setTheme(v) // keep next-themes in sync so the page restyles immediately
    onChange(v)
  }
  return (
    <div className="flex gap-0.5">
      <button
        onClick={() => select("dark")}
        className={`py-1.5 px-3 font-mono text-[9px] tracking-[0.08em] uppercase cursor-pointer rounded transition-all duration-[var(--trans)] ${
          value === "dark"
            ? "bg-[var(--accent)] text-white border-[var(--accent)] font-bold"
            : "bg-[var(--bg-muted)] border border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--border-2)]"
        }`}
      >
        CYBER
      </button>
      <button
        onClick={() => select("light")}
        className={`py-1.5 px-3 font-mono text-[9px] tracking-[0.08em] uppercase cursor-pointer rounded transition-all duration-[var(--trans)] ${
          value === "light"
            ? "bg-[var(--accent)] text-white border-[var(--accent)] font-bold"
            : "bg-[var(--bg-muted)] border border-[var(--border-1)] text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--border-2)]"
        }`}
      >
        MINIMAL
      </button>
    </div>
  )
}

const SELECT_CLS =
  "bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-[7px] px-2.5 pr-[26px] text-[var(--text-1)] font-mono text-[10px] outline-none cursor-pointer appearance-none transition-[border-color] duration-[var(--trans)] focus:border-[var(--accent)] bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%279%27%20height%3D%275%27%3E%3Cpath%20d%3D%27M0%200l4.5%205L9%200z%27%20fill%3D%27%236fa8cc%27%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"

// ──────────────────────────────────────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error"

export function PreferencesScreen() {
  const { token } = useAuth()
  const { setTheme } = useTheme()

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS)
  const [initial, setInitial] = useState<Preferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [error, setError] = useState<string | null>(null)

  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial)

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  )

  // Fetch existing preferences on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`${API_BASE}/api/preferences`, { headers: authHeaders() })
        if (!res.ok) {
          // 404 → no prefs yet; use defaults
          if (res.status !== 404) throw new Error("Failed to load preferences")
          if (!cancelled) {
            setPrefs(DEFAULT_PREFS)
            setInitial(DEFAULT_PREFS)
          }
          return
        }
        const raw = await res.json()
        const parsed = fromApi(raw ?? {})
        if (!cancelled) {
          setPrefs(parsed)
          setInitial(parsed)
          // Reflect persisted theme immediately
          setTheme(parsed.theme)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.error(err)
          setError(err instanceof Error ? err.message : "Failed to load preferences")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token, authHeaders, setTheme])

  // Auto-clear "saved" status after 2s
  useEffect(() => {
    if (saveState !== "saved") return
    const t = setTimeout(() => setSaveState("idle"), 2000)
    return () => clearTimeout(t)
  }, [saveState])

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }))
  }

  const handleSave = async () => {
    if (!token || saveState === "saving") return
    setSaveState("saving")
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/preferences`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(toApi(prefs)),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      setInitial(prefs)
      setSaveState("saved")
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to save preferences")
      setSaveState("error")
    }
  }

  const handleReset = () => {
    setPrefs(DEFAULT_PREFS)
    setTheme(DEFAULT_PREFS.theme)
  }

  return (
    <div className="p-8 bg-[var(--bg-root)] transition-[background] duration-300">
      <div className="flex justify-between items-start mb-7">
        <div>
          <div className="font-heading text-[32px] font-bold text-[var(--text-1)] mb-1.5">
            Preferences
          </div>
          <div className="font-mono text-[9px] tracking-[0.14em] text-[var(--text-3)]">
            ○ Trader profile · risk · notifications · session
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] text-[var(--text-3)]">Signed in as</div>
          <div className="font-mono text-[11px] text-[var(--accent)]">user@example.com</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 font-mono text-xs text-[var(--red)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-[18px]">
        {/* Profile */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 py-3 px-[18px] border-b border-[var(--border-1)]">
            <span className="text-[var(--accent)] text-[13px]">▤</span>
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--text-2)]">Profile</span>
          </div>
          <div className="font-sans text-[11px] text-[var(--text-3)] py-2 px-[18px]">
            Your trader identity, shown in headers and activity logs.
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px] border-b border-[var(--border-1)]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Display name</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">How you appear in the app</div>
            </div>
            <input
              type="text"
              value={prefs.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              disabled={loading}
              className="bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-[7px] px-2.5 text-[var(--text-1)] font-mono text-[11px] w-[130px] outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-glow2)] disabled:opacity-50"
            />
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px] border-b border-[var(--border-1)]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Base currency</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">All values in this currency</div>
            </div>
            <select
              value={prefs.baseCurrency}
              onChange={(e) => update("baseCurrency", e.target.value as Currency)}
              disabled={loading}
              className={`${SELECT_CLS} disabled:opacity-50`}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="ARS">ARS</option>
            </select>
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Theme</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">Visual density of the terminal</div>
            </div>
            <ThemeSegmented value={prefs.theme} onChange={(v) => update("theme", v)} />
          </div>
        </div>

        {/* Trading */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 py-3 px-[18px] border-b border-[var(--border-1)]">
            <span className="text-[var(--accent)] text-[13px]">○</span>
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--text-2)]">Trading</span>
          </div>
          <div className="font-sans text-[11px] text-[var(--text-3)] py-2 px-[18px]">
            Defaults applied to the order entry form.
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px] border-b border-[var(--border-1)]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Risk tolerance</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">Influences agent suggestions</div>
            </div>
            <Segmented
              options={["CONSERVATIVE", "MODERATE", "AGGRESSIVE"] as const}
              value={prefs.riskTolerance}
              onChange={(v) => update("riskTolerance", v)}
            />
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px] border-b border-[var(--border-1)]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Default order type</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">Pre-selected on order entry</div>
            </div>
            <select
              value={prefs.defaultOrderType}
              onChange={(e) => update("defaultOrderType", e.target.value as OrderType)}
              disabled={loading}
              className={`${SELECT_CLS} disabled:opacity-50`}
            >
              <option value="MARKET">MARKET</option>
              <option value="LIMIT">LIMIT</option>
            </select>
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px] border-b border-[var(--border-1)]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Default quantity</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">Shares pre-filled in orders</div>
            </div>
            <input
              type="text"
              value={prefs.defaultQuantity}
              onChange={(e) => update("defaultQuantity", e.target.value)}
              disabled={loading}
              className="bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-[7px] px-2.5 text-[var(--text-1)] font-mono text-[11px] w-20 outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_var(--accent-glow2)] disabled:opacity-50"
            />
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px] border-b border-[var(--border-1)]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Confirm before submit</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">Show dialog before placing</div>
            </div>
            <Toggle
              on={prefs.confirmBeforeSubmit}
              onChange={(v) => update("confirmBeforeSubmit", v)}
            />
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Auto-analyze on select</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">Run agent on symbol pick</div>
            </div>
            <Toggle
              on={prefs.autoAnalyzeOnSelect}
              onChange={(v) => update("autoAnalyzeOnSelect", v)}
            />
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 py-3 px-[18px] border-b border-[var(--border-1)]">
            <span className="text-[var(--accent)] text-[13px]">◆</span>
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--text-2)]">Notifications</span>
          </div>
          <div className="font-sans text-[11px] text-[var(--text-3)] py-2 px-[18px]">
            What you want to be told about.
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px] border-b border-[var(--border-1)]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Agent signals</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">Alert on new BUY/SELL signal</div>
            </div>
            <Toggle
              on={prefs.notifyAgentSignals}
              onChange={(v) => update("notifyAgentSignals", v)}
            />
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Order fills</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">Alert when order executes</div>
            </div>
            <Toggle
              on={prefs.notifyOrderFills}
              onChange={(v) => update("notifyOrderFills", v)}
            />
          </div>
        </div>

        {/* Portfolio Management — UNTOUCHED */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 py-3 px-[18px] border-b border-[var(--border-1)]">
            <span className="text-[var(--accent)] text-[13px]">◉</span>
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--text-2)]">Portfolio Management</span>
          </div>
          <div className="font-sans text-[11px] text-[var(--text-3)] py-2 px-[18px]">
            Create and manage portfolios with broker connections.
          </div>

          <div className="p-[18px]">
            <PortfolioManager onPortfolioAdded={(portfolio) => {
              console.log("New portfolio added:", portfolio)
            }} />
          </div>
        </div>

        {/* Exchange Management — UNTOUCHED */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 py-3 px-[18px] border-b border-[var(--border-1)]">
            <span className="text-[var(--accent)] text-[13px]">◈</span>
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--text-2)]">Exchange Management</span>
          </div>
          <div className="font-sans text-[11px] text-[var(--text-3)] py-2 px-[18px]">
            Add and manage trading exchanges for your portfolio.
          </div>

          <div className="p-[18px]">
            <ExchangeManager />
          </div>
        </div>

        {/* Broker Management — UNTOUCHED */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 py-3 px-[18px] border-b border-[var(--border-1)]">
            <span className="text-[var(--accent)] text-[13px]">◎</span>
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--text-2)]">Broker Management</span>
          </div>
          <div className="font-sans text-[11px] text-[var(--text-3)] py-2 px-[18px]">
            Add and configure brokers and their commission rates.
          </div>
          <div className="p-[18px]">
            <BrokerManager onBrokerAdded={(broker) => {
              console.log("New broker added:", broker)
            }} />
          </div>
        </div>

        {/* Session */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 py-3 px-[18px] border-b border-[var(--border-1)]">
            <span className="text-[var(--accent)] text-[13px]">□</span>
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--text-2)]">Session &amp; Security</span>
          </div>
          <div className="font-sans text-[11px] text-[var(--text-3)] py-2 px-[18px]">
            Manage your active session.
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px] border-b border-[var(--border-1)]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Session timeout</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">Auto sign-out after inactivity</div>
            </div>
            <select
              value={prefs.sessionTimeout}
              onChange={(e) => update("sessionTimeout", e.target.value as SessionTimeout)}
              disabled={loading}
              className={`${SELECT_CLS} disabled:opacity-50`}
            >
              <option value="1 hour">1 hour</option>
              <option value="4 hours">4 hours</option>
              <option value="Never">Never</option>
            </select>
          </div>

          <div className="flex justify-between items-center py-[13px] px-[18px]">
            <div>
              <div className="font-sans text-[13px] text-[var(--text-1)] font-medium mb-0.5">Sign out</div>
              <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.04em]">End session on this device</div>
            </div>
            <button className="py-[7px] px-4 bg-transparent border border-[var(--red-dim)] rounded-[var(--radius)] text-[var(--red)] font-mono text-[10px] tracking-[0.1em] cursor-pointer font-bold transition-all duration-[var(--trans)] hover:bg-[var(--red-bg)]">
              SIGN OUT
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 justify-end pt-5">
        {saveState === "saved" && (
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--green)]">
            ✓ Saved
          </span>
        )}
        {saveState === "saving" && (
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--text-3)]">
            Saving…
          </span>
        )}
        {saveState === "error" && (
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--red)]">
            Save failed
          </span>
        )}
        {dirty && saveState === "idle" && (
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--text-3)]">
            Unsaved changes
          </span>
        )}
        <button
          onClick={handleReset}
          disabled={loading || saveState === "saving"}
          className="py-[11px] px-[22px] bg-transparent border border-[var(--border-2)] rounded-[var(--radius)] text-[var(--text-2)] font-heading text-sm font-semibold tracking-[0.06em] cursor-pointer transition-all duration-[var(--trans)] hover:border-[var(--border-3)] hover:text-[var(--text-1)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          RESET DEFAULTS
        </button>
        <button
          onClick={handleSave}
          disabled={loading || saveState === "saving" || !dirty}
          className="py-[11px] px-[26px] bg-[var(--accent)] border-none rounded-[var(--radius)] text-white font-heading text-sm font-bold tracking-[0.06em] cursor-pointer transition-all duration-[var(--trans)] hover:shadow-[var(--shadow-glow)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {saveState === "saving" ? "SAVING…" : "SAVE CHANGES"}
        </button>
      </div>
    </div>
  )
}
