"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/hooks/use-auth"
import { getPortfolios, createPortfolio, getBrokers, type Portfolio, type Broker } from "@/lib/api/instruments"

interface PortfolioManagerProps {
  onPortfolioAdded?: (portfolio: Portfolio) => void
}

export function PortfolioManager({ onPortfolioAdded }: PortfolioManagerProps) {
  const { token } = useAuth()
  const [showAddModal, setShowAddModal] = useState(false)
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    broker_id: "",
    initial_balance: 10000,
    currency: "USD",
  })

  useEffect(() => {
    if (!token) return
    getPortfolios(token).then(setPortfolios).catch(() => {})
    getBrokers(token).then(setBrokers).catch(() => {})
  }, [token])

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!token) return

    setIsLoading(true)
    setError(null)

    try {
      const newPortfolio = await createPortfolio(formData, token)
      setPortfolios([newPortfolio, ...portfolios])
      onPortfolioAdded?.(newPortfolio)
      setFormData({ name: "", description: "", broker_id: "", initial_balance: 10000, currency: "USD" })
      setShowAddModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create portfolio")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-2)] rounded-[var(--radius-lg)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg font-bold text-[var(--text-1)]">Portfolio Management</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[var(--accent)] text-white px-3 py-1 rounded-[var(--radius)] font-heading text-sm font-bold tracking-wide cursor-pointer transition-all duration-[var(--trans)] hover:shadow-[0_4px_16px_var(--accent-bg)] hover:-translate-y-px"
        >
          + Add Portfolio
        </button>
      </div>

      <div className="space-y-2">
        {portfolios.map((portfolio) => (
          <div key={portfolio.id} className="flex items-center justify-between p-2 bg-[var(--bg-muted)] rounded-[var(--radius)]">
            <div>
              <div className="font-mono text-sm font-bold text-[var(--text-1)]">{portfolio.name}</div>
              <div className="font-mono text-xs text-[var(--text-3)]">
                {portfolio.currency || "USD"} •{" "}
                {portfolio.broker_id
                  ? brokers.find((b) => b.id === portfolio.broker_id)?.name ?? "Unknown broker"
                  : "No broker"}{" "}
                {portfolio.initial_balance ? `• $${portfolio.initial_balance.toLocaleString()}` : ""}
              </div>
            </div>
          </div>
        ))}
        {portfolios.length === 0 && (
          <div className="text-center py-4 font-mono text-sm text-[var(--text-3)]">
            No portfolios configured
          </div>
        )}
      </div>

      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-2)] rounded-[var(--radius-lg)] w-full max-w-md p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading text-xl font-bold text-[var(--text-1)]">Add New Portfolio</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-[var(--bg-muted)] text-[var(--text-3)] flex items-center justify-center cursor-pointer hover:text-[var(--text-1)] transition-colors duration-[var(--trans)]"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 font-mono text-xs text-[var(--red)]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                  Portfolio Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                  placeholder="e.g. Main Trading Portfolio"
                />
              </div>

              <div className="mb-4">
                <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                  placeholder="Portfolio description..."
                  rows={2}
                />
              </div>

              <div className="mb-4">
                <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                  Broker
                </label>
                <select
                  value={formData.broker_id}
                  onChange={(e) => setFormData({ ...formData, broker_id: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)] cursor-pointer"
                >
                  <option value="">Select broker...</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name} ({broker.type}) • {(broker.commission_rate * 100).toFixed(2)}% fee
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                    Initial Balance
                  </label>
                  <input
                    type="number"
                    value={formData.initial_balance}
                    onChange={(e) => setFormData({ ...formData, initial_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                    placeholder="10000"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[var(--accent)] text-white border-none rounded-[var(--radius)] font-heading text-base font-bold tracking-[0.08em] uppercase cursor-pointer transition-all duration-[var(--trans)] hover:shadow-[0_4px_16px_var(--accent-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "CREATING..." : "CREATE PORTFOLIO"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
