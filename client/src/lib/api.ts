import { API_BASE, getAuthHeaders } from '../lib/firebase';

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
export const runAnalysis = async (symbol: string, date?: string, options?: object) => {
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