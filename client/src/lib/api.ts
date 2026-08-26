import { API_BASE, getAuthHeaders } from './firebase';

const CRYPTO_API = 'https://api.binance.com';

// Crypto API (no auth required) — Binance is queried directly from the browser
export const fetchCryptoPrices = async (symbols: string[]) => {
  const symbolsParam = encodeURIComponent(JSON.stringify(symbols.map(s => s.toUpperCase())));
  const res = await fetch(`${CRYPTO_API}/api/v3/ticker/24hr?symbols=${symbolsParam}`);
  const data = await res.json();
  const arrayData = Array.isArray(data) ? data : [data];
  return arrayData.map((t: any) => ({
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

// --- Trading API ---------------------------------------------------------
// SQLite on the server is the single source of truth for bots, positions and
// balance; these read and mutate it rather than keeping a parallel copy.

const req = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${API_BASE}${path}`, { headers: getAuthHeaders(), ...init });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
};

export interface ApiBot {
  id: string;
  name: string;
  createdAt: string;
  symbols: string[];
  allocationType: 'percentage' | 'fixed';
  allocationValue: number;
  frozenAmount: number;
  status: 'running' | 'stopped';
  positions: any[];
  closedPositions: any[];
  totalPnl: number;
  closedTrades: number;
  winningTrades: number;
  stopLoss?: number;
  takeProfit?: number;
  interval: number;
  botProvider?: string;
  botQuickModel?: string;
  botDeepModel?: string;
  engineRunning?: boolean;
}

export const getBots = (): Promise<ApiBot[]> => req('/trading/bots');

export const getWalletBalance = async (): Promise<number> => {
  const data = await req('/trading/balance');
  return data?.balance ?? 0;
};

export const setWalletBalance = (balance: number) =>
  req('/trading/balance', { method: 'POST', body: JSON.stringify({ balance }) });

export const createBotApi = (config: {
  name: string; symbols: string[];
  allocationType: 'percentage' | 'fixed'; allocationValue: number;
  stopLoss?: number; takeProfit?: number; interval: number;
  botProvider?: string; botQuickModel?: string; botDeepModel?: string;
  start?: boolean;
}): Promise<ApiBot> => req('/trading/bots', { method: 'POST', body: JSON.stringify(config) });

export const updateBotApi = (botId: string, changes: Record<string, unknown>): Promise<ApiBot> =>
  req(`/trading/bots/${botId}`, { method: 'PATCH', body: JSON.stringify(changes) });

export const deleteBotApi = (botId: string) =>
  req(`/trading/bots/${botId}`, { method: 'DELETE' });

export const startBotEngine = (botId: string) =>
  req(`/trading/bots/${botId}/start`, { method: 'POST' });

export const stopBotEngine = (botId: string) =>
  req(`/trading/bots/${botId}/stop`, { method: 'POST' });

export const closePositionApi = (positionId: string, price: number, status?: string) =>
  req(`/trading/positions/${positionId}/close`, {
    method: 'POST',
    body: JSON.stringify({ price, status }),
  });

export const closeAllPositionsApi = (botId: string, prices: Record<string, number>) =>
  req(`/trading/bots/${botId}/close-all`, { method: 'POST', body: JSON.stringify({ prices }) });

export const updatePositionSltpApi = (positionId: string, stopLoss?: number, takeProfit?: number) =>
  req(`/trading/positions/${positionId}/sltp`, {
    method: 'PATCH',
    body: JSON.stringify({ stopLoss, takeProfit }),
  });

export const importBotsApi = (bots: unknown[]) =>
  req('/trading/bots/import', { method: 'POST', body: JSON.stringify({ bots }) });

// LLM Config API
export const saveLlmConfig = async (config: {
  provider: string; apiKey: string; quickModel: string; deepModel: string;
  fallbackProvider?: string; fallbackApiKey?: string; fallbackQuickModel?: string; fallbackDeepModel?: string;
}) => {
  const res = await fetch(`${API_BASE}/trading/config`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(config)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 200));
  }
  return res.json();
};

export const loadLlmConfig = async () => {
  const res = await fetch(`${API_BASE}/trading/config`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) return {};
  const text = await res.text();
  try { return JSON.parse(text); } catch { return {}; }
};

export const testConnection = async (provider: string, apiKey?: string, isFallback = false, model?: string) => {
  const res = await fetch(`${API_BASE}/trading/test-connection`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ provider, apiKey, isFallback, model })
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` }; }
};

export const fetchModelsFromProvider = async (provider: string, apiKey?: string) => {
  const res = await fetch(`${API_BASE}/trading/models/fetch`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ provider, apiKey })
  });
  return res.json();
};

export const fetchBinanceSymbols = async (): Promise<string[]> => {
  try {
    const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    const data = await res.json();
    if (data && data.symbols) {
      return data.symbols
        .filter((s: any) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
        .map((s: any) => s.symbol)
        .sort();
    }
  } catch (e) {
    console.error('Failed to fetch Binance symbols:', e);
  }
  return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
};

export const fetchBotLogs = async (botId: string, limit = 50) => {
  const res = await fetch(`${API_BASE}/trading/bots/${botId}/logs?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};