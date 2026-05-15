"use client"

interface PortfolioHeroProps {
  totalValue: number
  dayChange: number
  dayChangePercent: number
  cashPercent: number
  isLoading?: boolean
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PortfolioHero({
  totalValue,
  dayChange,
  dayChangePercent,
  cashPercent,
  isLoading = false,
}: PortfolioHeroProps) {
  const isUp = dayChange >= 0
  const signed = (n: number) => `${n >= 0 ? "+" : ""}${formatCurrency(n).replace("$", "$")}`
  const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)] mb-4 relative overflow-hidden">
      {/* Glow effect for dark mode */}
      <div className="absolute -top-[60px] -right-[60px] w-[180px] h-[180px] bg-[radial-gradient(circle,rgba(0,210,255,0.07)_0%,transparent_70%)] pointer-events-none dark:block hidden" />

      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--text-3)] mb-2">
        TOTAL PORTFOLIO VALUE
      </div>
      <div className="font-heading text-[40px] font-bold text-[var(--text-1)] tracking-tight leading-none">
        {isLoading ? "—" : formatCurrency(totalValue)}
      </div>
      <div className="font-mono text-xs text-[var(--text-3)] mt-2">
        <span className={isUp ? "text-[var(--green)]" : "text-[var(--red)]"}>
          {signed(dayChange)} ({signedPct(dayChangePercent)})
        </span>{" "}
        today
      </div>

      <div className="mt-3.5">
        <div className="h-[3px] bg-[var(--bg-muted)] rounded-[3px] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-[3px] transition-[width] duration-600"
            style={{ width: `${Math.max(0, Math.min(100, cashPercent))}%` }}
          />
        </div>
        <div className="font-mono text-[9px] text-[var(--text-3)] tracking-[0.12em] mt-[5px]">
          {Math.round(cashPercent)}% CASH
        </div>
      </div>
    </div>
  )
}
