import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts';
import { fetchCryptoPrice, fetchCryptoKlines } from '../lib/api';
import {
  LineChart,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  Info,
  DollarSign,
  Activity,
  BarChart3,
  Clock
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
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
];

export default function Market() {
  const chartContainer = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [price, setPrice] = useState<any>(null);
  const [interval, setInterval] = useState('1h');
  const [loading, setLoading] = useState(false);

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
        vertLine: {
          width: 1,
          color: '#10b981',
          style: 2,
          labelBackgroundColor: '#10b981',
        },
        horzLine: {
          width: 1,
          color: '#10b981',
          style: 2,
          labelBackgroundColor: '#10b981',
        },
      },
      rightPriceScale: {
        borderColor: '#1f2937',
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false,
      },
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
        chartRef.current.applyOptions({
          width: chartContainer.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [symbol, interval]);

  const loadData = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const [priceData, klinesData] = await Promise.all([
        fetchCryptoPrice(symbol),
        fetchCryptoKlines(symbol, interval, 200),
      ]);
      setPrice(priceData);

      if (klinesData && seriesRef.current) {
        const chartData = klinesData.map((k: any) => ({
          time: Math.floor(k.time / 1000) as any,
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Live Market</h1>
          <p className="text-muted">Real-time crypto prices and charts</p>
        </div>
        <button onClick={loadData} disabled={loading} className="btn-ghost flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Crypto Selector */}
      <div className="card p-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {cryptoList.map((c) => (
            <button
              key={c.symbol}
              onClick={() => setSymbol(c.symbol)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                symbol === c.symbol
                  ? 'bg-primary text-white'
                  : 'bg-background text-gray-400 hover:text-white'
              }`}
            >
              <span>{c.icon}</span>
              <span className="font-medium">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interval Selector */}
      <div className="flex items-center gap-2">
        {intervals.map((int) => (
          <button
            key={int.value}
            onClick={() => setInterval(int.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              interval === int.value
                ? 'bg-primary text-white'
                : 'bg-surface text-muted hover:text-white'
            }`}
          >
            {int.label}
          </button>
        ))}
      </div>

      {/* Price Info */}
      {price && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted">Current Price</span>
            </div>
            <p className="text-2xl font-bold text-white">
              ${price.price > 1 ? price.price.toFixed(2) : price.price.toFixed(6)}
            </p>
            <p className={`text-sm font-medium ${isPositive ? 'text-primary' : 'text-secondary'}`}>
              {isPositive ? '+' : ''}{price.priceChangePercent?.toFixed(2)}%
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted">24h High</span>
            </div>
            <p className="text-2xl font-bold text-white">
              ${price.high24h > 1 ? price.high24h.toFixed(2) : price.high24h.toFixed(6)}
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-secondary" />
              <span className="text-sm text-muted">24h Low</span>
            </div>
            <p className="text-2xl font-bold text-white">
              ${price.low24h > 1 ? price.low24h.toFixed(2) : price.low24h.toFixed(6)}
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-accent" />
              <span className="text-sm text-muted">24h Volume</span>
            </div>
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
              <p className="text-sm text-muted">{symbol}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-[450px] flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div ref={chartContainer} className="w-full" />
        )}
      </div>

      {/* Market Overview */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Market Overview
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
              {cryptoList.map((c) => (
                <CryptoRow key={c.symbol} crypto={c} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CryptoRow({ crypto }: { crypto: any }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchCryptoPrice(crypto.symbol).then(setData).catch(console.error);
  }, [crypto.symbol]);

  if (!data) return null;

  const isPositive = data.priceChangePercent >= 0;

  return (
    <tr className="border-b border-border/50 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => window.location.href = '/market'}>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{crypto.icon}</span>
          <div>
            <p className="font-medium text-white">{crypto.symbol.replace('USDT', '')}</p>
            <p className="text-xs text-muted">{crypto.name}</p>
          </div>
        </div>
      </td>
      <td className="py-3 font-medium text-white">
        ${data.price > 1 ? data.price.toFixed(2) : data.price.toFixed(6)}
      </td>
      <td className={`py-3 font-medium ${isPositive ? 'text-primary' : 'text-secondary'}`}>
        {isPositive ? '+' : ''}{data.priceChangePercent?.toFixed(2)}%
      </td>
      <td className="py-3 text-white">${data.high24h?.toFixed(2)}</td>
      <td className="py-3 text-white">${data.low24h?.toFixed(2)}</td>
      <td className="py-3 text-muted">${(data.quoteVolume / 1000000).toFixed(1)}M</td>
    </tr>
  );
}