"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/hooks/use-auth"
import { getBrokers, createBroker, type Broker } from "@/lib/api/instruments"

interface BrokerManagerProps {
  onBrokerAdded?: (broker: Broker) => void
}

export function BrokerManager({ onBrokerAdded }: BrokerManagerProps) {
  const { token } = useAuth()
  const [showAddModal, setShowAddModal] = useState(false)
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    type: "stock" as Broker["type"],
    commission_rate: 0.001,
    is_active: true,
  })

  useEffect(() => {
    if (!token) return
    getBrokers(token)
      .then(setBrokers)
      .catch(() => {})
  }, [token])

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!token) return

    setIsLoading(true)
    setError(null)

    try {
      const newBroker = await createBroker(formData, token)
      setBrokers([newBroker, ...brokers])
      onBrokerAdded?.(newBroker)
      setFormData({ name: "", type: "stock", commission_rate: 0.001, is_active: true })
      setShowAddModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create broker")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-2)] rounded-[var(--radius-lg)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg font-bold text-[var(--text-1)]">Broker Management</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[var(--accent)] text-white px-3 py-1 rounded-[var(--radius)] font-heading text-sm font-bold tracking-wide cursor-pointer transition-all duration-[var(--trans)] hover:shadow-[0_4px_16px_var(--accent-bg)] hover:-translate-y-px"
        >
          + Add Broker
        </button>
      </div>

      <div className="space-y-2">
        {brokers.map((broker) => (
          <div key={broker.id} className="flex items-center justify-between p-2 bg-[var(--bg-muted)] rounded-[var(--radius)]">
            <div>
              <div className="font-mono text-sm font-bold text-[var(--text-1)]">{broker.name}</div>
              <div className="font-mono text-xs text-[var(--text-3)]">
                {broker.type} • {(broker.commission_rate * 100).toFixed(2)}% fee • {broker.is_active ? "Active" : "Inactive"}
              </div>
            </div>
          </div>
        ))}
        {brokers.length === 0 && (
          <div className="text-center py-4 font-mono text-sm text-[var(--text-3)]">
            No brokers configured
          </div>
        )}
      </div>

      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-2)] rounded-[var(--radius-lg)] w-full max-w-md p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading text-xl font-bold text-[var(--text-1)]">Add New Broker</h3>
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
                  Broker Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                  placeholder="e.g. Interactive Brokers"
                />
              </div>

              <div className="mb-4">
                <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                  Broker Type *
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Broker["type"] })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)] cursor-pointer"
                >
                  <option value="stock">Stock Broker</option>
                  <option value="crypto">Crypto Broker</option>
                  <option value="forex">Forex Broker</option>
                  <option value="commodity">Commodity Broker</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                  Commission Rate *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min={0}
                    max={1}
                    step={0.0001}
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 pr-10 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                    placeholder="0.001"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--text-3)]">
                    {(formData.commission_rate * 100).toFixed(2)}%
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[var(--accent)] text-white border-none rounded-[var(--radius)] font-heading text-base font-bold tracking-[0.08em] uppercase cursor-pointer transition-all duration-[var(--trans)] hover:shadow-[0_4px_16px_var(--accent-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "ADDING..." : "ADD BROKER"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
