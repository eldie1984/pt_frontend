"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { getInstruments, getInstrumentBySymbol, getExchanges, createInstrument, createTransaction, getTransactions, getPortfolios, getBrokers, type Exchange, type Portfolio, type Broker } from "@/lib/api/instruments"

type InstrumentType = "stocks" | "options" | "crypto" | "bonds" | "loans" | "blocks"

interface Instrument {
  id: string
  type: InstrumentType
  symbol: string
  name: string
  market: string
  quantity: number
  avgPrice: number
  currentPrice: number
  totalValue: number
}

interface Transaction {
  id: string
  instrumentId: string
  type: "buy" | "sell"
  symbol: string
  market: string
  quantity: number
  price: number
  brokerCommission: number
  marketCommission: number
  tariffs: number
  total: number
  date: string
}

interface HoldingFromAPI {
  id: string
  portfolio_id: string
  instrument_id: string
  quantity: number
  average_cost: number
  market_value: number
  unrealized_pnl: number
  symbol: string
  instrument_name: string
  instrument_type: string
  exchange: string
  currency: string
}

interface PortfolioFromAPI {
  id: string
  user_id: string
  name: string
  description: string | null
  holdings: HoldingFromAPI[]
}


const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  stocks: "Stocks",
  options: "Options",
  crypto: "Cryptocurrencies",
  bonds: "Corporate Bonds",
  loans: "Securities-Guaranteed Loans",
  blocks: "Blocks of Shares",
}

const VALID_TYPES = new Set<string>(["stocks", "options", "crypto", "bonds", "loans", "blocks"])

function toInstrumentType(raw: string): InstrumentType {
  const lower = raw.toLowerCase()
  return VALID_TYPES.has(lower) ? (lower as InstrumentType) : "stocks"
}

function holdingToInstrument(h: HoldingFromAPI): Instrument {
  const currentPrice = h.quantity > 0 ? h.market_value / h.quantity : h.average_cost
  return {
    id: String(h.id),
    type: toInstrumentType(h.instrument_type),
    symbol: h.symbol,
    name: h.instrument_name,
    market: h.exchange,
    quantity: h.quantity,
    avgPrice: h.average_cost,
    currentPrice,
    totalValue: h.market_value,
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export function InstrumentsScreen() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState<InstrumentType>("stocks")
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [transactionType, setTransactionType] = useState<"buy" | "sell">("buy")
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("")
  const [selectedBroker, setSelectedBroker] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token])

  const fetchTransactions = useCallback(async (portfolioId: string) => {
    if (!token) return
    try {
      const transactionsData = await getTransactions(portfolioId, token)
      setTransactions(transactionsData.map((tx: any) => ({
        id: String(tx.id),
        instrumentId: String(tx.instrument_id),
        type: tx.type,
        symbol: tx.symbol,
        market: tx.exchange || 'Unknown',
        quantity: tx.quantity,
        price: tx.price,
        brokerCommission: tx.broker_commission,
        marketCommission: tx.exchange_commission,
        tariffs: tx.transaction_tariff,
        total: tx.total_amount + tx.broker_commission + tx.exchange_commission + tx.transaction_tariff,
        date: new Date(tx.transaction_date).toISOString().split("T")[0],
      })))
    } catch (err: unknown) {
      console.error('Failed to fetch transactions:', err)
      // Don't show error for transactions initially
    }
  }, [token])

  const fetchHoldings = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const portfoliosRes = await fetch(`${API_BASE}/api/portfolio/list`, {
        headers: authHeaders(),
      })
      if (!portfoliosRes.ok) throw new Error("Failed to fetch portfolios")
      const portfolios: PortfolioFromAPI[] = await portfoliosRes.json()

      if (portfolios.length === 0) {
        setInstruments([])
        return
      }

      const portfolioRes = await fetch(`${API_BASE}/api/portfolio/${portfolios[0].id}`, {
        headers: authHeaders(),
      })
      if (!portfolioRes.ok) throw new Error("Failed to fetch portfolio holdings")
      const portfolio: PortfolioFromAPI = await portfolioRes.json()

      setInstruments(portfolio.holdings.map(holdingToInstrument))
      
      // Fetch transactions for this portfolio
      await fetchTransactions(portfolios[0].id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load instruments")
    } finally {
      setIsLoading(false)
    }
  }, [token, authHeaders, fetchTransactions])

  const fetchExchanges = useCallback(async () => {
    if (!token) return
    try {
      const exchangesData = await getExchanges(token)
      setExchanges(exchangesData)
    } catch (err: unknown) {
      console.error('Failed to fetch exchanges:', err)
      setError('Failed to load exchanges')
    }
  }, [token])

  const fetchPortfolios = useCallback(async () => {
    if (!token) return
    try {
      const portfoliosData = await getPortfolios(token)
      setPortfolios(portfoliosData)
      if (portfoliosData.length > 0 && !selectedPortfolio) {
        setSelectedPortfolio(portfoliosData[0].id)
      }
    } catch (err: unknown) {
      console.error('Failed to fetch portfolios:', err)
      // Don't show error for portfolios initially
    }
  }, [token, selectedPortfolio])

  const fetchBrokers = useCallback(async () => {
    if (!token) return
    try {
      const brokersData = await getBrokers(token)
      setBrokers(brokersData)
    } catch (err: unknown) {
      console.error('Failed to fetch brokers:', err)
      // Set default brokers if API fails
      setBrokers([
        { id: "1", name: "Interactive Brokers", type: "stock", commission_rate: 0.001, is_active: true, created_at: new Date().toISOString() },
        { id: "2", name: "Binance", type: "crypto", commission_rate: 0.001, is_active: true, created_at: new Date().toISOString() },
        { id: "3", name: "Coinbase", type: "crypto", commission_rate: 0.005, is_active: true, created_at: new Date().toISOString() },
        { id: "4", name: "E*TRADE", type: "stock", commission_rate: 0.0065, is_active: true, created_at: new Date().toISOString() },
      ])
    }
  }, [token])

  useEffect(() => {
    fetchHoldings()
    fetchExchanges()
    fetchPortfolios()
    fetchBrokers()
  }, [fetchHoldings, fetchExchanges, fetchPortfolios, fetchBrokers])

  const [formData, setFormData] = useState({
    symbol: "",
    name: "",
    market: "",
    quantity: "",
    price: "",
    brokerCommission: "",
    marketCommission: "",
    tariffs: "",
    portfolio: "",
    broker: "",
  })

  const filteredInstruments = instruments.filter((i) => i.type === activeTab)

  const calculateTotal = () => {
    const qty = parseFloat(formData.quantity) || 0
    const price = parseFloat(formData.price) || 0
    const broker = parseFloat(formData.brokerCommission) || 0
    const market = parseFloat(formData.marketCommission) || 0
    const tariff = parseFloat(formData.tariffs) || 0
    const subtotal = qty * price
    const fees = broker + market + tariff
    return transactionType === "buy" ? subtotal + fees : subtotal - fees
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!token || isSubmitting) return
    
    setIsSubmitting(true)
    
    try {
      const qty = parseFloat(formData.quantity) || 0
      const price = parseFloat(formData.price) || 0
      const broker = parseFloat(formData.brokerCommission) || 0
      const market = parseFloat(formData.marketCommission) || 0
      const tariff = parseFloat(formData.tariffs) || 0

      // Get or create instrument
      let instrument = await getInstrumentBySymbol(formData.symbol.toUpperCase(), token)
      
      if (!instrument) {
        // Create new instrument
        instrument = await createInstrument({
          symbol: formData.symbol.toUpperCase(),
          name: formData.name || formData.symbol.toUpperCase(),
          type: activeTab,
          exchange: formData.market,
          exchange_id: "1", // TODO: Get from exchange list
          currency: "USD",
        }, token)
      }

      // Use selected portfolio from form
      if (!formData.portfolio) {
        throw new Error("Please select a portfolio for this transaction.")
      }

      // Create transaction
      const transactionResult = await createTransaction({
        portfolioId: formData.portfolio,
        instrumentId: instrument.id,
        type: transactionType,
        quantity: qty,
        price: price,
        brokerCommission: broker,
        exchangeCommission: market,
        transactionTariff: tariff,
        transactionDate: new Date().toISOString(),
        brokerId: formData.broker || undefined,
      }, token)

      // Add new transaction to local state
      const newTransaction: Transaction = {
        id: String(transactionResult.transaction.id),
        instrumentId: String(instrument.id),
        type: transactionType,
        symbol: formData.symbol.toUpperCase(),
        market: formData.market,
        quantity: qty,
        price: price,
        brokerCommission: broker,
        marketCommission: market,
        tariffs: tariff,
        total: transactionResult.netAmount,
        date: new Date().toISOString().split("T")[0],
      }

      setTransactions([newTransaction, ...transactions])
      
      // Refresh holdings to get updated quantities
      await fetchHoldings()

      setShowTransactionModal(false)
      setFormData({
        symbol: "",
        name: "",
        market: "",
        quantity: "",
        price: "",
        brokerCommission: "",
        marketCommission: "",
        tariffs: "",
        portfolio: "",
        broker: "",
      })
    } catch (error) {
      console.error('Transaction failed:', error)
      setError(error instanceof Error ? error.message : "Transaction failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const openTransaction = (type: "buy" | "sell", instrument?: Instrument) => {
    setTransactionType(type)
    if (instrument) {
      setFormData({
        ...formData,
        symbol: instrument.symbol,
        name: instrument.name,
        market: instrument.market,
        price: instrument.currentPrice.toString(),
      })
    } else {
      setFormData({
        symbol: "",
        name: "",
        market: "",
        quantity: "",
        price: "",
        brokerCommission: "",
        marketCommission: "",
        tariffs: "",
        portfolio: "",
        broker: "",
      })
    }
    setShowTransactionModal(true)
  }

  return (
    <div className="flex-1 overflow-auto bg-[var(--bg-root)] transition-[background] duration-300 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--text-1)] tracking-wide">
            Instrument Management
          </h1>
          <p className="font-mono text-xs text-[var(--text-3)] mt-1">
            Manage your portfolio across all asset classes
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openTransaction("buy")}
            className="bg-[var(--green)] text-white px-4 py-2 rounded-[var(--radius)] font-heading text-sm font-bold tracking-wide cursor-pointer transition-all duration-[var(--trans)] hover:shadow-[0_4px_16px_var(--green-bg)] hover:-translate-y-px"
          >
            + BUY
          </button>
          <button
            onClick={() => openTransaction("sell")}
            className="bg-[var(--red)] text-white px-4 py-2 rounded-[var(--radius)] font-heading text-sm font-bold tracking-wide cursor-pointer transition-all duration-[var(--trans)] hover:shadow-[0_4px_16px_var(--red-bg)] hover:-translate-y-px"
          >
            - SELL
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-[var(--radius)] bg-[var(--red)]/10 border border-[var(--red)]/30 font-mono text-xs text-[var(--red)] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchHoldings} className="ml-4 underline cursor-pointer hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-2">
        {(Object.keys(INSTRUMENT_LABELS) as InstrumentType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`px-4 py-2 rounded-[var(--radius)] font-mono text-[10px] tracking-[0.1em] uppercase whitespace-nowrap cursor-pointer transition-all duration-[var(--trans)] ${
              activeTab === type
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-card)] text-[var(--text-3)] border border-[var(--border-2)] hover:text-[var(--text-2)] hover:border-[var(--accent)]"
            }`}
          >
            {INSTRUMENT_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Instruments Table */}
      <div className="bg-[var(--bg-panel)] border border-[var(--border-2)] rounded-[var(--radius-lg)] overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-muted)] border-b border-[var(--border-1)]">
                <th className="text-left py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Symbol</th>
                <th className="text-left py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Name</th>
                <th className="text-left py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Market</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Quantity</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Avg Price</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Current</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">P/L</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Total Value</th>
                <th className="text-center py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center font-mono text-sm text-[var(--text-3)]">
                    Loading instruments…
                  </td>
                </tr>
              ) : filteredInstruments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center font-mono text-sm text-[var(--text-3)]">
                    No {INSTRUMENT_LABELS[activeTab].toLowerCase()} in your portfolio
                  </td>
                </tr>
              ) : (
                filteredInstruments.map((instrument) => {
                  const pl = (instrument.currentPrice - instrument.avgPrice) * instrument.quantity
                  const plPercent = ((instrument.currentPrice - instrument.avgPrice) / instrument.avgPrice) * 100
                  const isProfit = pl >= 0

                  return (
                    <tr key={instrument.id} className="border-b border-[var(--border-1)] hover:bg-[var(--bg-hover)] transition-colors duration-[var(--trans)]">
                      <td className="py-3 px-4 font-mono text-sm font-bold text-[var(--accent)]">
                        {instrument.symbol}
                      </td>
                      <td className="py-3 px-4 font-sans text-sm text-[var(--text-2)]">
                        {instrument.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-[var(--text-3)]">
                        {instrument.market}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-[var(--text-1)]">
                        {instrument.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-[var(--text-2)]">
                        ${instrument.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-[var(--text-1)]">
                        ${instrument.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono text-sm ${isProfit ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                        {isProfit ? "+" : ""}{pl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[10px] ml-1">({isProfit ? "+" : ""}{plPercent.toFixed(2)}%)</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-bold text-[var(--text-1)]">
                        ${instrument.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => openTransaction("buy", instrument)}
                            className="px-2 py-1 rounded text-[10px] font-mono bg-[var(--green)]/20 text-[var(--green)] border border-[var(--green)]/30 cursor-pointer hover:bg-[var(--green)] hover:text-white transition-all duration-[var(--trans)]"
                          >
                            BUY
                          </button>
                          <button
                            onClick={() => openTransaction("sell", instrument)}
                            className="px-2 py-1 rounded text-[10px] font-mono bg-[var(--red)]/20 text-[var(--red)] border border-[var(--red)]/30 cursor-pointer hover:bg-[var(--red)] hover:text-white transition-all duration-[var(--trans)]"
                          >
                            SELL
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-[var(--bg-panel)] border border-[var(--border-2)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-1)]">
          <h2 className="font-heading text-lg font-bold text-[var(--text-1)]">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-muted)] border-b border-[var(--border-1)]">
                <th className="text-left py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Date</th>
                <th className="text-left py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Type</th>
                <th className="text-left py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Symbol</th>
                <th className="text-left py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Market</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Qty</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Price</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Broker Fee</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Market Fee</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Tariffs</th>
                <th className="text-right py-3 px-4 font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)]">Total</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center font-mono text-sm text-[var(--text-3)]">
                    No transactions yet
                  </td>
                </tr>
              ) : null}
              {transactions.slice(0, 10).map((tx) => (
                <tr key={tx.id} className="border-b border-[var(--border-1)] hover:bg-[var(--bg-hover)] transition-colors duration-[var(--trans)]">
                  <td className="py-3 px-4 font-mono text-xs text-[var(--text-3)]">{tx.date}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      tx.type === "buy" 
                        ? "bg-[var(--green)]/20 text-[var(--green)]" 
                        : "bg-[var(--red)]/20 text-[var(--red)]"
                    }`}>
                      {tx.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-sm font-bold text-[var(--accent)]">{tx.symbol}</td>
                  <td className="py-3 px-4 font-mono text-[10px] text-[var(--text-3)]">{tx.market}</td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-[var(--text-1)]">{tx.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-[var(--text-2)]">${tx.price.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs text-[var(--text-3)]">${tx.brokerCommission.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs text-[var(--text-3)]">${tx.marketCommission.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs text-[var(--text-3)]">${tx.tariffs.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono text-sm font-bold text-[var(--text-1)]">${tx.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-2)] rounded-[var(--radius-lg)] w-full max-w-md p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading text-xl font-bold text-[var(--text-1)]">
                {transactionType === "buy" ? "Buy" : "Sell"} {INSTRUMENT_LABELS[activeTab]}
              </h3>
              <button
                onClick={() => setShowTransactionModal(false)}
                className="w-8 h-8 rounded-full bg-[var(--bg-muted)] text-[var(--text-3)] flex items-center justify-center cursor-pointer hover:text-[var(--text-1)] transition-colors duration-[var(--trans)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                    Symbol *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                    placeholder="e.g. AAPL"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                    placeholder="Apple Inc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                    Portfolio *
                  </label>
                  <select
                    required
                    value={formData.portfolio}
                    onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="">Select portfolio...</option>
                    {portfolios.map((portfolio) => (
                      <option key={portfolio.id} value={portfolio.id}>
                        {portfolio.name} ({portfolio.currency || 'USD'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                    Broker
                  </label>
                  <select
                    value={formData.broker}
                    onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="">Select broker...</option>
                    {brokers.map((broker) => (
                      <option key={broker.id} value={broker.id}>
                        {broker.name} ({broker.type}) • {broker.commission_rate * 100}% fee
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                  Stock Market / Exchange *
                </label>
                <select
                  required
                  value={formData.market}
                  onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)] cursor-pointer"
                >
                  <option value="">Select exchange...</option>
                  {exchanges.map((exchange) => (
                    <option key={exchange.id} value={exchange.code}>
                      {exchange.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                    Price *
                  </label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                    placeholder="150.00"
                  />
                </div>
              </div>

              <div className="border-t border-[var(--border-1)] pt-4 mb-4">
                <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--text-3)] mb-3">
                  Fees & Commissions
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                      Broker Fee
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.brokerCommission}
                      onChange={(e) => setFormData({ ...formData, brokerCommission: e.target.value })}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                      placeholder="9.95"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                      Market Fee
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.marketCommission}
                      onChange={(e) => setFormData({ ...formData, marketCommission: e.target.value })}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                      placeholder="2.50"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-1">
                      Tariffs
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.tariffs}
                      onChange={(e) => setFormData({ ...formData, tariffs: e.target.value })}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-2)] rounded-[var(--radius)] py-2 px-3 text-[var(--text-1)] font-mono text-sm outline-none transition-all duration-[var(--trans)] focus:border-[var(--accent)]"
                      placeholder="1.25"
                    />
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-[var(--bg-muted)] border border-[var(--border-1)] rounded-[var(--radius)] p-3 mb-4">
                <div className="font-mono text-[8px] tracking-[0.14em] uppercase text-[var(--text-3)] mb-2">
                  Order Summary
                </div>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-[var(--text-3)]">Subtotal</span>
                  <span className="text-[var(--text-2)]">
                    ${((parseFloat(formData.quantity) || 0) * (parseFloat(formData.price) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-[var(--text-3)]">Total Fees</span>
                  <span className="text-[var(--text-2)]">
                    ${((parseFloat(formData.brokerCommission) || 0) + (parseFloat(formData.marketCommission) || 0) + (parseFloat(formData.tariffs) || 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-mono text-sm font-bold pt-1 border-t border-[var(--border-1)]">
                  <span className="text-[var(--text-1)]">Total</span>
                  <span className={transactionType === "buy" ? "text-[var(--green)]" : "text-[var(--red)]"}>
                    ${calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 border-none rounded-[var(--radius)] font-heading text-base font-bold tracking-[0.08em] uppercase cursor-pointer transition-all duration-[var(--trans)] ${
                  transactionType === "buy"
                    ? "bg-[var(--green)] text-white hover:shadow-[0_4px_16px_var(--green-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                    : "bg-[var(--red)] text-white hover:shadow-[0_4px_16px_var(--red-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {isSubmitting ? `PROCESSING...` : `CONFIRM ${transactionType.toUpperCase()}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
