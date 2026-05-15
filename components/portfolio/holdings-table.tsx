"use client"

export interface Holding {
  id: string
  symbol: string
  shares: number
  avgCost: number
  marketValue: number
  pnl: number
  pnlPercent: number
}

interface HoldingsTableProps {
  holdings: Holding[]
  isLoading?: boolean
}

function fmtMoney(n: number, opts: { signed?: boolean } = {}): string {
  const sign = opts.signed && n > 0 ? "+" : ""
  return `${sign}$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function HoldingsTable({ holdings, isLoading = false }: HoldingsTableProps) {
  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)] mb-4">
      <div className="flex justify-between items-center py-3 px-[18px] border-b border-[var(--border-1)]">
        <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--text-2)] flex items-center gap-[7px]">
          <span className="text-[var(--accent)]">◆</span> HOLDINGS
        </span>
        <span className="font-mono text-[9px] text-[var(--text-3)] bg-[var(--bg-muted)] border border-[var(--border-1)] py-0.5 px-2 rounded-[20px]">
          {isLoading ? "loading…" : `${holdings.length} positions`}
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="py-[9px] px-[18px] text-left font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--text-3)] border-b border-[var(--border-1)] font-normal">
              SYMBOL
            </th>
            <th className="py-[9px] px-[18px] text-right font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--text-3)] border-b border-[var(--border-1)] font-normal">
              SHARES
            </th>
            <th className="py-[9px] px-[18px] text-right font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--text-3)] border-b border-[var(--border-1)] font-normal">
              AVG COST
            </th>
            <th className="py-[9px] px-[18px] text-right font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--text-3)] border-b border-[var(--border-1)] font-normal">
              MKT VALUE
            </th>
            <th className="py-[9px] px-[18px] text-right font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--text-3)] border-b border-[var(--border-1)] font-normal">
              P&L
            </th>
            <th className="py-[9px] px-[18px] text-right font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--text-3)] border-b border-[var(--border-1)] font-normal">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={6} className="text-center py-6 font-mono text-[11px] text-[var(--text-3)]">
                Loading holdings…
              </td>
            </tr>
          ) : holdings.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-6 font-mono text-[11px] text-[var(--text-3)]">
                No open positions.{" "}
                <span className="text-[var(--accent)] cursor-pointer hover:underline">
                  Open terminal →
                </span>
              </td>
            </tr>
          ) : (
            holdings.map((h) => {
              const up = h.pnl >= 0
              return (
                <tr
                  key={h.id}
                  className="transition-[background] duration-[var(--trans)] hover:bg-[var(--bg-hover)]"
                >
                  <td className="py-[10px] px-[18px] font-mono text-xs font-bold text-[var(--accent)] border-b border-[var(--border-1)]">
                    {h.symbol}
                  </td>
                  <td className="py-[10px] px-[18px] text-right font-mono text-xs text-[var(--text-1)] border-b border-[var(--border-1)]">
                    {h.shares.toLocaleString()}
                  </td>
                  <td className="py-[10px] px-[18px] text-right font-mono text-xs text-[var(--text-2)] border-b border-[var(--border-1)]">
                    {fmtMoney(h.avgCost)}
                  </td>
                  <td className="py-[10px] px-[18px] text-right font-mono text-xs text-[var(--text-1)] border-b border-[var(--border-1)]">
                    {fmtMoney(h.marketValue)}
                  </td>
                  <td
                    className={`py-[10px] px-[18px] text-right font-mono text-xs border-b border-[var(--border-1)] ${
                      up ? "text-[var(--green)]" : "text-[var(--red)]"
                    }`}
                  >
                    {fmtMoney(h.pnl, { signed: true })}
                  </td>
                  <td
                    className={`py-[10px] px-[18px] text-right font-mono text-xs border-b border-[var(--border-1)] ${
                      up ? "text-[var(--green)]" : "text-[var(--red)]"
                    }`}
                  >
                    {up ? "+" : ""}
                    {h.pnlPercent.toFixed(2)}%
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
