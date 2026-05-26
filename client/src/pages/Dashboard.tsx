import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { fetchCryptoPrices } from '../lib/api';
import {
  Wallet,
  Activity,
  Zap,
  Shield,
  Pause,
  Coins,
  RefreshCw,
  Brain
} from 'lucide-react';

const cryptoList = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', icon: '₿' },
  { symbol: 'ETHUSDT', name: 'Ethereum', icon: 'Ξ' },
  { symbol: 'SOLUSDT', name: 'Solana', icon: '◎' },
  { symbol: 'BNBUSDT', name: 'BNB', icon: '🔶' },
  { symbol: 'XRPUSDT', name: 'Ripple', icon: '✕' },
  { symbol: 'ADAUSDT', name: 'Cardano', icon: '₳' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', icon: 'Ð' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', icon: '▲' },
  { symbol: 'LINKUSDT', name: 'Chainlink', icon: '🔗' },
  { symbol: 'DOTUSDT', name: 'Polkadot', icon: '●' },
];

export default function Dashboard() {
  const {
    balance,
    walletBalance,
    aiTradingEnabled,
    aiTradingPercent,
    aiSymbols,
    aiStopLoss,
    aiTakeProfit,
    setAiTradingEnabled,
    setAiTradingPercent,
    setAiSymbols,
    setAiStopLoss,
    setAiTakeProfit,
  } = useAppStore();

  const [cryptoPrices, setCryptoPrices] = useState<Record<string, any>>({});
  const [selectedCrypto, setSelectedCrypto] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPrices = async () => {
    setLoading(true);
    try {
      const prices = await fetchCryptoPrices(cryptoList.map(c => c.symbol));
      const priceObj: Record<string, any> = {};
      prices.forEach((p: any) => { priceObj[p.symbol] = p; });
      setCryptoPrices(priceObj);
    } catch (e) {
      console.error('Failed to load prices:', e);
    }
    setLoading(false);
  };

  const priceChange = cryptoPrices[selectedCrypto]?.priceChangePercent || 0;

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const symbols = cryptoList.map(c => c.symbol.toLowerCase());
    const streams = symbols.map(s => `${s}@ticker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Dashboard WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.e === '24hrTicker') {
          setCryptoPrices(prev => ({
            ...prev,
            [data.s]: {
              symbol: data.s,
              price: parseFloat(data.c),
              priceChange: parseFloat(data.p),
              priceChangePercent: parseFloat(data.P),
              high24h: parseFloat(data.h),
              low24h: parseFloat(data.l),
              volume: parseFloat(data.v),
              quoteVolume: parseFloat(data.q),
            },
          }));
        }
      } catch (e) {
        console.error('WS message error:', e);
      }
    };

    ws.onclose = () => {
      console.log('Dashboard WebSocket disconnected, reconnecting in 5s...');
      wsRef.current = null;
      reconnectTimerRef.current = setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
      console.error('Dashboard WebSocket error:', error);
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const aiTradingAmount = (walletBalance * aiTradingPercent) / 100;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Trading Dashboard</h1>
          <p className="text-muted">AI-Powered Crypto Trading Platform</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-success flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Live Market
          </span>
          <button onClick={loadPrices} disabled={loading} className="btn-ghost">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Account Balance & AI Trading Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wallet Balance Card */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-sm text-muted">Account Balance</h3>
              <p className="text-2xl font-bold text-white">${walletBalance.toLocaleString()}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted">Trading Balance</span>
              <span className="text-sm font-medium text-white">${walletBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted">Paper Balance</span>
              <span className="text-sm font-medium text-white">${balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* AI Trading Setup Card */}
        <div className="card p-6 bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
              <Brain className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Trading Agent</h3>
              <p className="text-sm text-muted">Auto-trade with AI</p>
            </div>
          </div>

          {/* Percentage Slider */}
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted">Investment Amount</span>
              <span className="text-sm font-medium text-accent">{aiTradingPercent}% (${aiTradingAmount.toFixed(0)})</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={aiTradingPercent}
              onChange={(e) => setAiTradingPercent(parseInt(e.target.value))}
              className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-accent"
            />
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-background/50">
            <div className="flex items-center gap-2">
              <Zap className={`w-5 h-5 ${aiTradingEnabled ? 'text-accent' : 'text-muted'}`} />
              <span className="font-medium text-white">Enable AI Trading</span>
            </div>
            <button
              onClick={() => setAiTradingEnabled(!aiTradingEnabled)}
              className={`w-12 h-6 rounded-full transition-colors ${
                aiTradingEnabled ? 'bg-accent' : 'bg-surface'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                aiTradingEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* Risk Settings Card */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center">
              <Shield className="w-6 h-6 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Risk Management</h3>
              <p className="text-sm text-muted">Stop Loss & Take Profit</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted">Stop Loss</span>
                <span className="text-sm font-medium text-secondary">{aiStopLoss}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={aiStopLoss}
                onChange={(e) => setAiStopLoss(parseInt(e.target.value))}
                className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-secondary"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted">Take Profit</span>
                <span className="text-sm font-medium text-primary">{aiTakeProfit}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={aiTakeProfit}
                onChange={(e) => setAiTakeProfit(parseInt(e.target.value))}
                className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Crypto Selection */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          Select Crypto Pairs for AI Trading
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cryptoList.map((crypto) => {
            const price = cryptoPrices[crypto.symbol]?.price || 0;
            const change = cryptoPrices[crypto.symbol]?.priceChangePercent || 0;
            const isSelected = aiSymbols.includes(crypto.symbol);

            return (
              <button
                key={crypto.symbol}
                onClick={() => {
                  if (isSelected) {
                    setAiSymbols(aiSymbols.filter(s => s !== crypto.symbol));
                  } else {
                    setAiSymbols([...aiSymbols, crypto.symbol]);
                  }
                }}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-gray-600'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{crypto.icon}</span>
                  <span className="font-semibold text-white">{crypto.name}</span>
                </div>

                <p className="text-xs text-muted">{crypto.symbol}</p>
                <p className="text-sm font-medium text-white">
                  ${price > 0 ? (price > 1 ? price.toFixed(2) : price.toFixed(6)) : '...'}
                </p>
                <p className={`text-xs font-medium ${change >= 0 ? 'text-primary' : 'text-secondary'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </p>
              </button>
            );
          })}
        </div>

        {aiSymbols.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-accent/5 border border-accent/20">
            <p className="text-sm text-white">
              <span className="text-accent font-medium">{aiSymbols.length}</span> pairs selected for AI trading:
              <span className="text-muted ml-2">{aiSymbols.join(', ')}</span>
            </p>
          </div>
        )}
      </div>

      {/* Live Prices Grid */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Live Market Prices
          </h3>
          <button onClick={loadPrices} disabled={loading} className="btn-ghost text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cryptoList.slice(0, 10).map((crypto) => {
            const price = cryptoPrices[crypto.symbol]?.price || 0;
            const change = cryptoPrices[crypto.symbol]?.priceChangePercent || 0;
            const volume = cryptoPrices[crypto.symbol]?.quoteVolume || 0;
            const isSelected = selectedCrypto === crypto.symbol;

            return (
              <button
                key={crypto.symbol}
                onClick={() => setSelectedCrypto(crypto.symbol)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{crypto.icon}</span>
                  <span className={`text-xs font-medium ${change >= 0 ? 'text-primary' : 'text-secondary'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                  </span>
                </div>
                <p className="font-semibold text-white text-sm">{crypto.symbol.replace('USDT', '')}</p>
                <p className="text-lg font-bold text-white">
                  ${price > 0 ? (price > 1 ? price.toFixed(2) : price.toFixed(6)) : '...'}
                </p>
                <p className="text-xs text-muted mt-1">
                  Vol: ${volume > 1000000 ? (volume / 1000000).toFixed(1) + 'M' : volume.toFixed(0)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Crypto Detail */}
      {selectedCrypto && cryptoPrices[selectedCrypto] && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-3xl">
                {cryptoList.find(c => c.symbol === selectedCrypto)?.icon || '₿'}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {cryptoList.find(c => c.symbol === selectedCrypto)?.name || selectedCrypto}
                </h3>
                <p className="text-muted">{selectedCrypto}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-3xl font-bold text-white">
                ${cryptoPrices[selectedCrypto]?.price > 1
                  ? cryptoPrices[selectedCrypto]?.price.toFixed(2)
                  : cryptoPrices[selectedCrypto]?.price.toFixed(6)}
              </p>
              <p className={`text-lg font-medium ${priceChange >= 0 ? 'text-primary' : 'text-secondary'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-background/50">
              <p className="text-sm text-muted mb-1">24h High</p>
              <p className="text-lg font-semibold text-primary">
                ${cryptoPrices[selectedCrypto]?.high24h?.toFixed(2) || '...'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-background/50">
              <p className="text-sm text-muted mb-1">24h Low</p>
              <p className="text-lg font-semibold text-secondary">
                ${cryptoPrices[selectedCrypto]?.low24h?.toFixed(2) || '...'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-background/50">
              <p className="text-sm text-muted mb-1">24h Volume</p>
              <p className="text-lg font-semibold text-white">
                ${(cryptoPrices[selectedCrypto]?.quoteVolume / 1000000).toFixed(2)}M
              </p>
            </div>
            <div className="p-4 rounded-xl bg-background/50">
              <p className="text-sm text-muted mb-1">Price Change</p>
              <p className={`text-lg font-semibold ${cryptoPrices[selectedCrypto]?.priceChange >= 0 ? 'text-primary' : 'text-secondary'}`}>
                {cryptoPrices[selectedCrypto]?.priceChange >= 0 ? '+' : ''}
                ${cryptoPrices[selectedCrypto]?.priceChange?.toFixed(2) || '...'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            {aiSymbols.includes(selectedCrypto) ? (
              <button className="btn-ghost flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                AI Trading Enabled
              </button>
            ) : (
              <button
                onClick={() => setAiSymbols([...aiSymbols, selectedCrypto])}
                className="btn-accent flex items-center gap-2"
              >
                <Brain className="w-4 h-4" />
                Add to AI Trading
              </button>
            )}
            <a href="/analysis" className="btn-primary flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Run AI Analysis
            </a>
          </div>
        </div>
      )}

      {/* AI Trading Status */}
      {aiTradingEnabled && aiSymbols.length > 0 && (
        <div className="card p-6 border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center animate-pulse">
                <Brain className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-white">AI Trading Agent Active</h3>
                <p className="text-sm text-muted">
                  Analyzing {aiSymbols.length} pairs with ${aiTradingAmount.toFixed(0)} from your wallet
                </p>
              </div>
            </div>
            <button
              onClick={() => setAiTradingEnabled(false)}
              className="btn-secondary flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              Stop AI Trading
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl bg-background/50 text-center">
              <p className="text-xs text-muted">Trading Amount</p>
              <p className="text-lg font-bold text-accent">${aiTradingAmount.toFixed(0)}</p>
            </div>
            <div className="p-3 rounded-xl bg-background/50 text-center">
              <p className="text-xs text-muted">Pairs</p>
              <p className="text-lg font-bold text-white">{aiSymbols.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-background/50 text-center">
              <p className="text-xs text-muted">Stop Loss</p>
              <p className="text-lg font-bold text-secondary">{aiStopLoss}%</p>
            </div>
            <div className="p-3 rounded-xl bg-background/50 text-center">
              <p className="text-xs text-muted">Take Profit</p>
              <p className="text-lg font-bold text-primary">{aiTakeProfit}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}