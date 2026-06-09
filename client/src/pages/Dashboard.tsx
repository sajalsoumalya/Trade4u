import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { createChart, IChartApi, ISeriesApi, ColorType, CandlestickData, Time } from 'lightweight-charts';
import { fetchCryptoKlines } from '../lib/api';
import { TrendingUp, TrendingDown, BarChart3, Wallet, Snowflake, LineChart, Trophy, Target, PieChart, Activity } from 'lucide-react';

const cryptoList = [
  { symbol: 'BTCUSDT', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', name: 'Ethereum' },
  { symbol: 'SOLUSDT', name: 'Solana' },
  { symbol: 'BNBUSDT', name: 'BNB' },
  { symbol: 'XRPUSDT', name: 'Ripple' },
];

const intervals = [
  { value: '1h', label: '1H' }, { value: '4h', label: '4H' }, { value: '1d', label: '1D' }, { value: '1w', label: '1W' },
];

export default function Dashboard() {
  const { walletBalance, bots } = useAppStore();
  const totalPnl = bots.reduce((s, b) => s + b.totalPnl, 0);
  const totalFrozen = bots.reduce((s, b) => s + b.frozenAmount, 0);
  const totalTrades = bots.reduce((s, b) => s + b.closedTrades, 0);
  const totalWins = bots.reduce((s, b) => s + b.winningTrades, 0);
  const winRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100) : 0;
  const totalPositions = bots.reduce((s, b) => s + b.positions.length, 0);
  const available = walletBalance;
  const bestBot = [...bots].sort((a, b) => b.totalPnl - a.totalPnl)[0];

  const [prices, setPrices] = useState<Record<string, any>>({});
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1h');
  const chartContainer = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainer.current) return;
    chartRef.current = createChart(chartContainer.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#6b7280' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      crosshair: { mode: 1, vertLine: { width: 1, color: '#10b981', style: 2, labelBackgroundColor: '#10b981' }, horzLine: { width: 1, color: '#10b981', style: 2, labelBackgroundColor: '#10b981' } },
      rightPriceScale: { borderColor: '#1f2937' },
      timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
      width: chartContainer.current.clientWidth,
      height: 400,
    });
    seriesRef.current = chartRef.current.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444', borderUpColor: '#10b981', borderDownColor: '#ef4444', wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });
    const handleResize = () => { if (chartRef.current && chartContainer.current) chartRef.current.applyOptions({ width: chartContainer.current.clientWidth }); };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chartRef.current?.remove(); };
  }, []);

  useEffect(() => { loadChartData(); }, [symbol, interval]);

  useEffect(() => {
    const streams = cryptoList.map(c => `${c.symbol.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === '24hrTicker') {
          setPrices(prev => ({ ...prev, [data.s]: { symbol: data.s, price: parseFloat(data.c), priceChange: parseFloat(data.p), priceChangePercent: parseFloat(data.P), high24h: parseFloat(data.h), low24h: parseFloat(data.l), quoteVolume: parseFloat(data.q) } }));
        }
      } catch {}
    };
    return () => ws.close();
  }, []);

  const loadChartData = async () => {
    if (!symbol || !seriesRef.current) return;
    try {
      const data = await fetchCryptoKlines(symbol, interval, 150);
      if (data) {
        seriesRef.current.setData(data.map((k: any) => ({ time: Math.floor(k.time / 1000) as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
        chartRef.current?.timeScale().fitContent();
      }
    } catch {}
  };

  const price = prices[symbol];
  const isPositive = price?.priceChangePercent >= 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />Live
        </span>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Total Balance</p>
          <p className="text-xl font-bold text-white">${walletBalance.toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1 flex items-center gap-1"><Snowflake className="w-3 h-3 text-accent" /> Frozen</p>
          <p className="text-xl font-bold text-accent">${totalFrozen.toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1 flex items-center gap-1"><Activity className="w-3 h-3" /> Available</p>
          <p className="text-xl font-bold text-white">${available.toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1 flex items-center gap-1"><LineChart className="w-3 h-3" /> Total P&L</p>
          <p className={`text-xl font-bold ${totalPnl >= 0 ? 'text-primary' : 'text-secondary'}`}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1 flex items-center gap-1"><Target className="w-3 h-3 text-primary" /> Win Rate</p>
          <p className={`text-xl font-bold ${winRate >= 50 ? 'text-primary' : 'text-secondary'}`}>{winRate.toFixed(1)}%</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1 flex items-center gap-1"><Trophy className="w-3 h-3 text-accent" /> Best Bot</p>
          <p className="text-xl font-bold text-white truncate">{bestBot ? bestBot.name : '--'}</p>
        </div>
      </div>

      {/* Per-Bot Performance Bars */}
      {bots.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Bot Performance</h3>
          <div className="space-y-2">
            {bots.map(b => {
              const maxPnl = Math.max(...bots.map(x => Math.abs(x.totalPnl)), 1);
              const barPct = Math.abs(b.totalPnl) / maxPnl * 100;
              return (
                <div key={b.id} className="flex items-center gap-3">
                  <span className="text-xs text-white w-20 truncate">{b.name}</span>
                  <div className="flex-1 h-5 bg-[#1E2329] rounded overflow-hidden">
                    <div className="h-full rounded" style={{
                      width: `${barPct}%`,
                      backgroundColor: b.totalPnl >= 0 ? '#0ECB81' : '#F6465D',
                      marginLeft: b.totalPnl < 0 ? 'auto' : undefined,
                      float: b.totalPnl >= 0 ? 'left' : 'right',
                    }} />
                  </div>
                  <span className={`text-xs font-mono w-20 text-right ${b.totalPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                    {b.totalPnl >= 0 ? '+' : ''}${b.totalPnl.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[#848E9C] w-16 text-right">{b.positions.length} pos</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                {cryptoList.map(c => (
                  <button key={c.symbol} onClick={() => setSymbol(c.symbol)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${symbol === c.symbol ? 'bg-primary text-white' : 'bg-background text-muted hover:text-white'}`}>
                    {c.symbol.replace('USDT', '/USDT')}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {intervals.map(int => (
                  <button key={int.value} onClick={() => setInterval(int.value)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${interval === int.value ? 'bg-primary/20 text-primary' : 'text-muted hover:text-white'}`}>
                    {int.label}
                  </button>
                ))}
              </div>
            </div>
            {price && (
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <p className="text-lg font-bold text-white">${price.price > 1 ? price.price.toFixed(2) : price.price.toFixed(6)}</p>
                  <p className={`text-xs font-medium flex items-center gap-1 ${isPositive ? 'text-primary' : 'text-secondary'}`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isPositive ? '+' : ''}{price.priceChangePercent?.toFixed(2)}%
                  </p>
                </div>
                <div className="flex gap-4 text-xs text-muted">
                  <span>H: ${price.high24h?.toFixed(2)}</span>
                  <span>L: ${price.low24h?.toFixed(2)}</span>
                  <span>Vol: ${(price.quoteVolume / 1000000).toFixed(1)}M</span>
                </div>
              </div>
            )}
            <div ref={chartContainer} className="w-full" />
          </div>

          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Market Prices
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {cryptoList.map(c => {
                const p = prices[c.symbol];
                if (!p) return null;
                return (
                  <button key={c.symbol} onClick={() => setSymbol(c.symbol)}
                    className={`p-3 rounded-lg border transition-all text-left ${symbol === c.symbol ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-600'}`}>
                    <p className="text-xs text-muted">{c.symbol.replace('USDT', '/USDT')}</p>
                    <p className="text-sm font-semibold text-white">${p.price > 1 ? p.price.toFixed(2) : p.price.toFixed(6)}</p>
                    <p className={`text-xs font-medium ${p.priceChangePercent >= 0 ? 'text-primary' : 'text-secondary'}`}>
                      {p.priceChangePercent >= 0 ? '+' : ''}{p.priceChangePercent.toFixed(2)}%
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Bots Overview</h3>
            {bots.length > 0 ? (
              <div className="space-y-3">
                {bots.map(b => (
                  <div key={b.id} className="p-3 rounded-lg bg-background/50 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{b.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${b.status === 'running' ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#2B3139] text-[#848E9C]'}`}>
                        {b.status === 'running' ? 'Running' : 'Stopped'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-[#848E9C]">
                      <span>{b.symbols.length} pairs</span>
                      <span>{b.positions.length} open</span>
                      <span className={b.totalPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>
                        {b.totalPnl >= 0 ? '+' : ''}${b.totalPnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
                <a href="/trading" className="block text-center py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-all">
                  Manage Bots
                </a>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted py-2">No bots created yet</p>
                <a href="/trading" className="block text-center py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-all">
                  Create Bot
                </a>
              </div>
            )}
          </div>

          {bots.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><PieChart className="w-4 h-4 text-accent" /> Win/Loss</h3>
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2B3139" strokeWidth="2" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0ECB81" strokeWidth="2"
                      strokeDasharray={`${winRate} ${100 - winRate}`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{winRate.toFixed(0)}%</span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#0ECB81]" />Wins: {totalWins}</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#F6465D]" />Losses: {totalTrades - totalWins}</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#848E9C]" />Total: {totalTrades}</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <a href="/trading" className="block text-center py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-all">
                Configure Bots
              </a>
              <a href="/settings" className="block text-center py-2 rounded-lg bg-background text-muted text-sm font-medium hover:bg-white/5 transition-all border border-border">
                Settings
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
