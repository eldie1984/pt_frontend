"use client"

export interface ActivityEntry {
  id: string
  time: string
  msg: string
  kind?: "SYSTEM" | "BUY" | "SELL" | "SIGNAL"
}

interface ActivityLogProps {
  entries: ActivityEntry[]
  isLoading?: boolean
}

function kindStyles(kind: ActivityEntry["kind"]) {
  switch (kind) {
    case "BUY":
      return { label: "BUY", color: "text-[var(--green)]" }
    case "SELL":
      return { label: "SELL", color: "text-[var(--red)]" }
    case "SIGNAL":
      return { label: "SIGNAL", color: "text-[var(--accent)]" }
    default:
      return { label: "SYSTEM", color: "text-[var(--accent)]" }
  }
}

export function ActivityLog({ entries, isLoading = false }: ActivityLogProps) {
  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="flex justify-between items-center py-[11px] px-[18px] border-b border-[var(--border-1)] font-mono text-[9px] tracking-[0.14em] uppercase">
        <span className="text-[var(--text-2)] flex items-center gap-[7px]">
          <span className="text-[var(--accent)]">◆</span> ACTIVITY LOG
        </span>
        <span className="text-[var(--text-3)]">
          {isLoading ? "loading…" : `${entries.length} events`}
        </span>
      </div>

      <div>
        {isLoading ? (
          <div className="py-6 text-center font-mono text-[11px] text-[var(--text-3)]">
            Loading activity…
          </div>
        ) : entries.length === 0 ? (
          <div className="py-6 text-center font-mono text-[11px] text-[var(--text-3)]">
            No activity yet.
          </div>
        ) : (
          entries.map((log) => {
            const { label, color } = kindStyles(log.kind)
            return (
              <div
                key={log.id}
                className="flex items-start gap-[11px] py-[11px] px-[18px] border-b border-[var(--border-1)] last:border-b-0 transition-[background] duration-[var(--trans)] hover:bg-[var(--bg-hover)]"
              >
                <div className={`w-[26px] h-[26px] rounded-full shrink-0 bg-[var(--bg-muted)] border border-[var(--border-2)] flex items-center justify-center font-mono text-[9px] ${color}`}>
                  {label === "BUY" ? "B" : label === "SELL" ? "S" : label === "SIGNAL" ? "◆" : "AI"}
                </div>
                <div className="flex-1">
                  <div className={`font-mono text-[9px] font-bold ${color}`}>{label}</div>
                  <div className="font-sans text-xs text-[var(--text-2)] mt-px">{log.msg}</div>
                </div>
                <div className="font-mono text-[9px] text-[var(--text-3)] shrink-0 ml-auto">
                  {log.time}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
