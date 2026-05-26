import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CandlestickData, Time } from 'lightweight-charts';
import { fetchCryptoKlines } from '../lib/api';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wifi,
  WifiOff,
  BarChart3
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
];

const intervals = [
  { value: '1m', label: '1M' },
  { value: '5m', label: '5M' },
  { value: '15m', label: '15M' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
];

export default function Market() {
  const chartContainer = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [price, setPrice] = useState<any>(null);
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [interval, setInterval] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Initialize chart
  useEffect(() => {
    if (!chartContainer.current) return;

    chartRef.current = createChart(chartContainer.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: 1,
        vertLine: { width: 1, color: '#10b981', style: 2, labelBackgroundColor: '#10b981' },
        horzLine: { width: 1, color: '#10b981', style: 2, labelBackgroundColor: '#10b981' },
      },
      rightPriceScale: { borderColor: '#1f2937' },
      timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
      width: chartContainer.current.clientWidth,
      height: 450,
    });

    seriesRef.current = chartRef.current.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const handleResize = () => {
      if (chartRef.current && chartContainer.current) {
        chartRef.current.applyOptions({ width: chartContainer.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.remove();
    };
  }, []);

  // Load chart data
  useEffect(() => {
    loadChartData();
  }, [symbol, interval]);

  // Connect to Binance WebSocket for live prices
  useEffect(() => {
    const symbols = cryptoList.map(c => c.symbol.toLowerCase());
    const streams = symbols.map(s => `${s}@ticker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;

    console.log('Connecting to Binance WebSocket...');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Binance WebSocket connected');
      setIsLive(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.e === '24hrTicker') {
          const priceData = {
            symbol: data.s,
            price: parseFloat(data.c),
            priceChange: parseFloat(data.p),
            priceChangePercent: parseFloat(data.P),
            high24h: parseFloat(data.h),
            low24h: parseFloat(data.l),
            volume: parseFloat(data.v),
            quoteVolume: parseFloat(data.q),
            bidPrice: parseFloat(data.b),
            askPrice: parseFloat(data.a),
          };

          setPrices(prev => ({
            ...prev,
            [data.s]: priceData,
          }));

          // Update current price if this is the selected symbol
          if (data.s === symbol) {
            setPrice(priceData);
          }
        }
      } catch (e) {
        console.error('WS message error:', e);
      }
    };

    ws.onclose = () => {
      console.log('Binance WebSocket disconnected');
      setIsLive(false);

      // Reconnect after 5 seconds
      setTimeout(() => {
        wsRef.current = null;
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('Binance WebSocket error:', error);
    };

    wsRef.current = ws;

    // Initial price fetch
    loadAllPrices();

    return () => {
      ws.close();
    };
  }, [symbol]);

  const loadAllPrices = async () => {
    try {
      const symbols = cryptoList.map(c => c.symbol);
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const allData = await response.json();
      const priceMap: Record<string, any> = {};
      allData
        .filter((t: any) => symbols.includes(t.symbol))
        .forEach((t: any) => {
          priceMap[t.symbol] = {
            symbol: t.symbol,
            price: parseFloat(t.lastPrice),
            priceChange: parseFloat(t.priceChange),
            priceChangePercent: parseFloat(t.priceChangePercent),
            high24h: parseFloat(t.highPrice),
            low24h: parseFloat(t.lowPrice),
            volume: parseFloat(t.volume),
            quoteVolume: parseFloat(t.quoteVolume),
          };
        });
      setPrices(priceMap);
      if (symbol) setPrice(priceMap[symbol]);
    } catch (e) {
      console.error('Failed to load prices:', e);
    }
  };

  const loadChartData = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const klinesData = await fetchCryptoKlines(symbol, interval, 200);
      if (klinesData && seriesRef.current) {
        const chartData: CandlestickData<Time>[] = klinesData.map((k: any) => ({
          time: Math.floor(k.time / 1000) as Time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));
        seriesRef.current.setData(chartData);
        chartRef.current?.timeScale().fitContent();
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const isPositive = price?.priceChangePercent >= 0;
  const crypto = cryptoList.find(c => c.symbol === symbol);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Live Market</h1>
          <p className="text-muted">Real-time crypto prices from Binance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            isLive ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
          }`}>
            {isLive ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span className="text-sm font-medium">{isLive ? 'Live' : 'Connecting...'}</span>
          </div>
          <button onClick={loadChartData} disabled={loading} className="btn-ghost">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Crypto Selector */}
      <div className="card p-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {cryptoList.map((c) => {
            const priceData = prices[c.symbol];
            const change = priceData?.priceChangePercent || 0;
            return (
              <button
                key={c.symbol}
                onClick={() => setSymbol(c.symbol)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap transition-all ${
                  symbol === c.symbol
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-background text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-lg">{c.icon}</span>
                <div className="text-left">
                  <p className="font-semibold">{c.symbol.replace('USDT', '')}</p>
                  <p className={`text-xs ${symbol === c.symbol ? 'text-white/80' : 'text-muted'}`}>
                    {priceData?.price > 1 ? `$${priceData.price.toFixed(2)}` : `$${priceData?.price?.toFixed(6) || '...'}`}
                  </p>
                </div>
                {priceData && (
                  <span className={`text-xs font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interval Selector */}
      <div className="flex items-center gap-2">
        {intervals.map((int) => (
          <button
            key={int.value}
            onClick={() => setInterval(int.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              interval === int.value
                ? 'bg-primary text-white'
                : 'bg-surface text-muted hover:text-white'
            }`}
          >
            {int.label}
          </button>
        ))}
      </div>

      {/* Price Info Cards */}
      {price && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-muted mb-1">Current Price</p>
            <p className="text-2xl font-bold text-white">
              ${price.price > 1 ? price.price.toFixed(2) : price.price.toFixed(6)}
            </p>
            <p className={`text-sm font-medium ${isPositive ? 'text-primary' : 'text-secondary'}`}>
              {isPositive ? '+' : ''}{price.priceChangePercent?.toFixed(2)}%
            </p>
          </div>

          <div className="card p-4">
            <p className="text-sm text-muted mb-1">24h High</p>
            <p className="text-2xl font-bold text-primary">
              ${price.high24h > 1 ? price.high24h.toFixed(2) : price.high24h.toFixed(6)}
            </p>
          </div>

          <div className="card p-4">
            <p className="text-sm text-muted mb-1">24h Low</p>
            <p className="text-2xl font-bold text-secondary">
              ${price.low24h > 1 ? price.low24h.toFixed(2) : price.low24h.toFixed(6)}
            </p>
          </div>

          <div className="card p-4">
            <p className="text-sm text-muted mb-1">24h Volume</p>
            <p className="text-2xl font-bold text-white">
              ${(price.quoteVolume / 1000000).toFixed(1)}M
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-2xl">
              {crypto?.icon || '₿'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{crypto?.name || symbol}</h2>
              <p className="text-sm text-muted">{symbol} - USDT</p>
            </div>
          </div>

          {price && (
            <div className="text-right">
              <p className="text-2xl font-bold text-white">
                ${price.price > 1 ? price.price.toFixed(2) : price.price.toFixed(6)}
              </p>
              <p className={`text-sm font-medium ${isPositive ? 'text-primary' : 'text-secondary'}`}>
                {isPositive ? <TrendingUp className="w-4 h-4 inline" /> : <TrendingDown className="w-4 h-4 inline" />}
                {' '}{isPositive ? '+' : ''}{price.priceChange?.toFixed(2)} ({price.priceChangePercent?.toFixed(2)}%)
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-[450px] flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div ref={chartContainer} className="w-full" />
        )}
      </div>

      {/* Live Prices Table */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Live Prices
          <span className="ml-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-muted border-b border-border">
                <th className="pb-3 font-medium">Pair</th>
                <th className="pb-3 font-medium">Price</th>
                <th className="pb-3 font-medium">24h Change</th>
                <th className="pb-3 font-medium">24h High</th>
                <th className="pb-3 font-medium">24h Low</th>
                <th className="pb-3 font-medium">Volume</th>
              </tr>
            </thead>
            <tbody>
              {cryptoList.map((c) => {
                const data = prices[c.symbol];
                if (!data) return null;

                const isPos = data.priceChangePercent >= 0;
                return (
                  <tr
                    key={c.symbol}
                    className="border-b border-border/50 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setSymbol(c.symbol)}
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{c.icon}</span>
                        <div>
                          <p className="font-medium text-white">{c.symbol.replace('USDT', '')}</p>
                          <p className="text-xs text-muted">{c.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 font-medium text-white">
                      ${data.price > 1 ? data.price.toFixed(2) : data.price.toFixed(6)}
                    </td>
                    <td className={`py-4 font-medium ${isPos ? 'text-primary' : 'text-secondary'}`}>
                      {isPos ? '+' : ''}{data.priceChangePercent?.toFixed(2)}%
                    </td>
                    <td className="py-4 text-white">${data.high24h?.toFixed(2)}</td>
                    <td className="py-4 text-white">${data.low24h?.toFixed(2)}</td>
                    <td className="py-4 text-muted">${(data.quoteVolume / 1000000).toFixed(1)}M</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}