import { API_BASE, getAuthHeaders } from './firebase';

const CRYPTO_API = 'https://api.binance.com';

// Crypto API (no auth required)
export const fetchCryptoPrice = async (symbol: string) => {
  const res = await fetch(`${CRYPTO_API}/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);
  const data = await res.json();
  return {
    symbol: data.symbol,
    price: parseFloat(data.lastPrice),
    priceChange: parseFloat(data.priceChange),
    priceChangePercent: parseFloat(data.priceChangePercent),
    high24h: parseFloat(data.highPrice),
    low24h: parseFloat(data.lowPrice),
    volume: parseFloat(data.volume),
    quoteVolume: parseFloat(data.quoteVolume),
  };
};

export const fetchCryptoPrices = async (symbols: string[]) => {
  const res = await fetch(`${CRYPTO_API}/api/v3/ticker/24hr`);
  const allData = await res.json();
  return allData
    .filter((t: any) => symbols.includes(t.symbol))
    .map((t: any) => ({
      symbol: t.symbol,
      price: parseFloat(t.lastPrice),
      priceChange: parseFloat(t.priceChange),
      priceChangePercent: parseFloat(t.priceChangePercent),
      high24h: parseFloat(t.highPrice),
      low24h: parseFloat(t.lowPrice),
      volume: parseFloat(t.volume),
      quoteVolume: parseFloat(t.quoteVolume),
    }));
};

export const fetchCryptoKlines = async (symbol: string, interval = '1h', limit = 100) => {
  const res = await fetch(
    `${CRYPTO_API}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`
  );
  const data = await res.json();
  return data.map((k: any) => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
};

// Market API
export const fetchPrice = async (symbol: string) => {
  const res = await fetch(`${API_BASE}/market/price/${symbol}`);
  return res.json();
};

export const fetchHistory = async (symbol: string, period = '1mo') => {
  const res = await fetch(`${API_BASE}/market/history/${symbol}?period=${period}`);
  return res.json();
};

export const fetchPrices = async (symbols: string[]) => {
  const res = await fetch(`${API_BASE}/market/prices`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ symbols })
  });
  return res.json();
};

// Analysis API
export const runAnalysis = async (symbol: string, date?: string, options?: Record<string, string>) => {
  const res = await fetch(`${API_BASE}/analysis/run`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ symbol, date, ...options })
  });
  return res.json();
};

export const getAnalysis = async (id: string) => {
  const res = await fetch(`${API_BASE}/analysis/${id}`, {
    headers: getAuthHeaders()
  });
  return res.json();
};

export const getAnalysisHistory = async (limit = 20) => {
  const res = await fetch(`${API_BASE}/analysis?limit=${limit}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) return [];
  return res.json();
};

// Trading API
export const placeOrder = async (symbol: string, type: 'buy' | 'sell', quantity: number, price?: number) => {
  const res = await fetch(`${API_BASE}/trading/order`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ symbol, type, quantity, price })
  });
  return res.json();
};

export const closePosition = async (id: string, price: number) => {
  const res = await fetch(`${API_BASE}/trading/order/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    body: JSON.stringify({ price })
  });
  return res.json();
};

export const getPositions = async () => {
  const res = await fetch(`${API_BASE}/trading/positions`, {
    headers: getAuthHeaders()
  });
  return res.json();
};

export const getTradeHistory = async (limit = 50) => {
  const res = await fetch(`${API_BASE}/trading/history?limit=${limit}`, {
    headers: getAuthHeaders()
  });
  return res.json();
};

export const getBalance = async () => {
  const res = await fetch(`${API_BASE}/trading/balance`, {
    headers: getAuthHeaders()
  });
  return res.json();
};

export const verifyToken = async (idToken: string) => {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  return res.json();
};

// AI Bot Engine API
export const startBotEngine = async (botId: string, symbols: string[], stopLoss?: number, takeProfit?: number) => {
  const res = await fetch(`${API_BASE}/trading/bots/${botId}/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ symbols, stopLoss, takeProfit })
  });
  return res.json();
};

export const stopBotEngine = async (botId: string) => {
  const res = await fetch(`${API_BASE}/trading/bots/${botId}/stop`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return res.json();
};