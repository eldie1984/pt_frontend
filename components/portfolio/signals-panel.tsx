"use client"

export interface Signal {
  id: string
  symbol: string
  action: "buy" | "sell" | "hold"
  confidence: number // 0..1
  message: string
  time: string
}

interface SignalsPanelProps {
  signals: Signal[]
  isLoading?: boolean
}

function actionColor(action: Signal["action"]): string {
  switch (action) {
    case "buy":
      return "text-[var(--green)]"
    case "sell":
      return "text-[var(--red)]"
    default:
      return "text-[var(--text-3)]"
  }
}

export function SignalsPanel({ signals, isLoading = false }: SignalsPanelProps) {
  return (
    <div className="p-3.5 flex-1 flex flex-col gap-2.5">
      <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--text-3)] flex justify-between">
        <span>□ AGENT SIGNALS</span>
        <span>{isLoading ? "loading…" : `${signals.length} signals`}</span>
      </div>

      {isLoading ? (
        <div className="font-sans text-xs text-[var(--text-3)] text-center py-8">
          Loading signals…
        </div>
      ) : signals.length === 0 ? (
        <div className="font-sans text-xs text-[var(--text-3)] text-center py-8">
          Run analysis in the Terminal to see signals here.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {signals.map((s) => (
            <div
              key={s.id}
              className="bg-[var(--bg-panel)] border border-[var(--border-1)] rounded-[var(--radius)] p-2.5 transition-[background] duration-[var(--trans)] hover:bg-[var(--bg-hover)]"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-[var(--accent)]">
                  {s.symbol}
                </span>
                <span
                  className={`font-mono text-[9px] tracking-[0.12em] uppercase ${actionColor(
                    s.action,
                  )}`}
                >
                  {s.action}
                </span>
              </div>
              {s.message && (
                <div className="font-sans text-[11px] text-[var(--text-2)] leading-snug mb-1.5">
                  {s.message}
                </div>
              )}
              <div className="flex items-center justify-between font-mono text-[9px] text-[var(--text-3)]">
                <span>conf {(s.confidence * 100).toFixed(0)}%</span>
                <span>{s.time}</span>
              </div>
              <div className="h-[2px] bg-[var(--bg-muted)] rounded-[3px] overflow-hidden mt-1.5">
                <div
                  className="h-full bg-[var(--accent)]"
                  style={{ width: `${Math.max(0, Math.min(100, s.confidence * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
