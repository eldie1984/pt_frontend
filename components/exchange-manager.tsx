"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { createExchange, getExchanges, type Exchange } from "@/lib/api/instruments"

interface ExchangeManagerProps {
  onExchangeAdded?: (exchange: Exchange) => void
}

export function ExchangeManager({ onExchangeAdded }: ExchangeManagerProps) {
  const { token } = useAuth()
  const [showAddModal, setShowAddModal] = useState(false)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "stock" as 'stock' | 'crypto' | 'bond' | 'commodity' | 'forex',
    country: "",
    is_active: true,
  })

  const loadExchanges = async () => {
    if (!token) return
    try {
      const exchangesData = await getExchanges(token)
      setExchanges(exchangesData)
    } catch (err) {
      console.error('Failed to load exchanges:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const newExchange = await createExchange(formData, token)
      setExchanges([newExchange, ...exchanges])
      onExchangeAdded?.(newExchange)
      
      // Reset form
      setFormData({
        name: "",
        code: "",
        type: "stock",
        country: "",
        is_active: true,
      })
      setShowAddModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create exchange")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-2)] rounded-[var(--radius-lg)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg font-bold text-[var(--text-1)]">Exchange Management</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[var(--accent)] text-white px-3 py-1 rounded-[var(--radius)] font-heading text-sm font-bold tracking-wide cursor-pointer transition-all duration-[var(--trans)] hover:shadow-[0_4px_16px_var(--accent-bg)] hover:-translate-y-px"
        >
          + Add Exchange
        </button>
      </div>

      {/* Exchange List */}
      <div className="space-y-2">
        {exchanges.map((exchange) => (
          <div key={exchange.id} className="flex items-center justify-between p-2 bg-[var(--bg-muted)] rounded-[var(--radius)]">
            <div>
              <div className="font-mono text-sm font-bold text-[var(--text-1)]">{exchange.name}</div>
              <div className="font-mono text-xs text-[var(--text-3)]">
                {exchange.type} • {exchange.country || 'Global'} • {exchange.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>
        ))}
        {exchanges.length === 0 && (
          <div className="text-center py-4 font-mono text-sm text-[var(--text-3)]">
            No exchanges configured
          </div>
        )}
      </div>

      {/* Add Exchange Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-2)] rounded-[var(--radius-lg)] w-full max-w-md p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading text-xl font-bold text-[var(--text-1)]">Add New Exchange</h3>
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
                  Exchange Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                  placeholder="e.g. New York Stock Exchange"
                />
              </div>

              <div className="mb-4">
                <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                  Exchange Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                  placeholder="e.g. NYSE"
                />
              </div>

              <div className="mb-4">
                <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                  Exchange Type *
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)] cursor-pointer"
                >
                  <option value="stock">Stock Exchange</option>
                  <option value="crypto">Cryptocurrency Exchange</option>
                  <option value="bond">Bond Market</option>
                  <option value="commodity">Commodity Exchange</option>
                  <option value="forex">Forex Market</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                  placeholder="e.g. United States"
                />
              </div>

              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[var(--accent)] text-white border-none rounded-[var(--radius)] font-heading text-base font-bold tracking-[0.08em] uppercase cursor-pointer transition-all duration-[var(--trans)] hover:shadow-[0_4px_16px_var(--accent-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "ADDING..." : "ADD EXCHANGE"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
