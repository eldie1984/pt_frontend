"use client"

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

interface StatsGridProps {
  stats: StatsData
  isLoading?: boolean
}

interface StatCardProps {
  label: string
  value: string
  sub: string
  color?: "default" | "green" | "red" | "accent"
  subColor?: "default" | "green" | "red"
}

function StatCard({ label, value, sub, color = "default", subColor = "default" }: StatCardProps) {
  const valueColors = {
    default: "text-[var(--text-1)]",
    green: "text-[var(--green)]",
    red: "text-[var(--red)]",
    accent: "text-[var(--accent)]",
  }

  const subColors = {
    default: "text-[var(--text-3)]",
    green: "text-[var(--green-dim)]",
    red: "text-[var(--red)]",
  }

  return (
    <div className="bg-[var(--bg-panel)] p-4 transition-[background] duration-[var(--trans)] cursor-default hover:bg-[var(--bg-hover)]">
      <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)] mb-1.5">
        {label}
      </div>
      <div className={`font-heading text-xl font-bold ${valueColors[color]}`}>
        {value}
      </div>
      <div className={`font-mono text-[9px] mt-[3px] ${subColors[subColor]}`}>
        {sub}
      </div>
    </div>
  )
}

function compactDollars(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`
  return `${n < 0 ? "-" : ""}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function signedDollars(n: number): string {
  return `${n >= 0 ? "+" : ""}${compactDollars(n)}`
}

function signedPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`
}

export function StatsGrid({ stats, isLoading = false }: StatsGridProps) {
  const pnlUp = stats.totalPnL >= 0

  return (
    <div className="grid grid-cols-3 gap-px bg-[var(--border-1)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden mb-4 shadow-[var(--shadow-sm)]">
      <StatCard
        label="Cash"
        value={isLoading ? "—" : compactDollars(stats.cash)}
        sub="Available"
      />
      <StatCard
        label="Total P&L"
        value={isLoading ? "—" : signedDollars(stats.totalPnL)}
        sub={isLoading ? "—" : signedPct(stats.totalPnLPercent)}
        color={pnlUp ? "green" : "red"}
        subColor={pnlUp ? "green" : "red"}
      />
      <StatCard
        label="Positions"
        value={isLoading ? "—" : String(stats.positions)}
        sub={`${stats.orders} orders`}
      />
      <StatCard
        label="Win Rate"
        value={stats.winRate == null ? "—" : `${stats.winRate.toFixed(1)}%`}
        sub="Est."
      />
      <StatCard
        label="Signals"
        value={isLoading ? "—" : String(stats.signals)}
        sub="Agent runs"
        color="accent"
      />
      <StatCard
        label="MKT Value"
        value={isLoading ? "—" : compactDollars(stats.marketValue)}
        sub="Holdings"
      />
    </div>
  )
}
