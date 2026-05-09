const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"

// Types
export interface Exchange {
  id: string
  name: string
  type: 'stock' | 'crypto' | 'bond' | 'commodity' | 'forex'
  country?: string
  code?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Instrument {
  id: number
  symbol: string
  name: string
  type: string
  exchange: string
  currency: string
  created_at: string
  updated_at: string
}

export interface TransactionRequest {
  portfolioId: number
  instrumentId: number
  type: 'buy' | 'sell'
  quantity: number
  price: number
  brokerCommission?: number
  exchangeCommission?: number
  transactionTariff?: number
  transactionDate?: string
  notes?: string
}

export interface TransactionResponse {
  transaction: {
    id: number
    portfolio_id: number
    instrument_id: number
    type: string
    quantity: number
    price: number
    total_amount: number
    broker_commission: number
    exchange_commission: number
    transaction_tariff: number
    transaction_date: string
    notes?: string
    created_at: string
    updated_at: string
    symbol: string
    name: string
    instrument_type: string
  }
  totalFees: number
  netAmount: number
}

// API Functions
export async function getInstruments(token: string): Promise<Instrument[]> {
  const response = await fetch(`${API_BASE}/instruments`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch instruments')
  }

  return response.json()
}

export async function getInstrumentBySymbol(symbol: string, token: string): Promise<Instrument | null> {
  try {
    const response = await fetch(`${API_BASE}/instruments/symbol/${symbol}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('Failed to fetch instrument')
    }

    return response.json()
  } catch (error) {
    console.error('Error fetching instrument by symbol:', error)
    return null
  }
}

export async function createInstrument(
  instrument: Omit<Instrument, 'id' | 'created_at' | 'updated_at'>,
  token: string
): Promise<Instrument> {
  const response = await fetch(`${API_BASE}/instruments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(instrument),
  })

  if (!response.ok) {
    throw new Error('Failed to create instrument')
  }

  return response.json()
}

export async function getExchanges(token: string): Promise<Exchange[]> {
  const response = await fetch(`${API_BASE}/exchanges`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch exchanges')
  }

  return response.json()
}

export async function createExchange(
  exchange: Omit<Exchange, 'id' | 'created_at' | 'updated_at'>,
  token: string
): Promise<Exchange> {
  const response = await fetch(`${API_BASE}/exchanges`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(exchange),
  })

  if (!response.ok) {
    throw new Error('Failed to create exchange')
  }

  return response.json()
}

export async function createTransaction(
  transaction: TransactionRequest,
  token: string
): Promise<TransactionResponse> {
  const response = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(transaction),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create transaction: ${errorText}`)
  }

  return response.json()
}

export async function getTransactions(
  portfolioId: number,
  token: string
): Promise<any[]> {
  const response = await fetch(`${API_BASE}/transactions/portfolio/${portfolioId}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch transactions')
  }

  return response.json()
}
