import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, ColorType } from 'lightweight-charts';
import { fetchPrice, fetchHistory } from '../lib/api';
import { LineChart, TrendingUp, TrendingDown, RefreshCw, Search, Info, DollarSign, Activity, BarChart3 } from 'lucide-react';

const periods = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
];

export default function Market() {
  const chartContainer = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [symbol, setSymbol] = useState('AAPL');
  const [inputSymbol, setInputSymbol] = useState('AAPL');
  const [price, setPrice] = useState<any>(null);
  const [period, setPeriod] = useState('1mo');
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'area'>('area');

  useEffect(() => {
    if (!chartContainer.current) return;

    chartRef.current = createChart(chartContainer.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#6b7280',
        fontFamily: 'Inter, sans-serif',
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
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainer.current.clientWidth,
      height: 450,
    });

    seriesRef.current = chartRef.current.addLineSeries({
      color: '#10b981',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: '#10b981',
      crosshairMarkerBackgroundColor: '#111827',
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
  }, [symbol, period]);

  const loadData = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const [priceData, historyData] = await Promise.all([
        fetchPrice(symbol),
        fetchHistory(symbol, period),
      ]);
      setPrice(priceData);

      if (historyData.data && seriesRef.current) {
        const chartData: LineData[] = historyData.data.map((d: any) => ({
          time: d.time,
          value: d.close,
        }));
        seriesRef.current.setData(chartData);
        chartRef.current?.timeScale().fitContent();
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    if (inputSymbol) {
      setSymbol(inputSymbol.toUpperCase());
    }
  };

  const isPositive = price?.change >= 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Market</h1>
          <p className="text-muted">Real-time market data and charts</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="btn-ghost flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Search & Controls */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={inputSymbol}
                onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="input w-full pl-12 pr-4"
                placeholder="Enter symbol (e.g., AAPL, TSLA)"
              />
            </div>
            <button onClick={handleSearch} className="btn-primary">
              Search
            </button>
          </div>

          <div className="flex items-center gap-2">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  period === p.value
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'bg-background text-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Price Info */}
      {price && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-6 relative overflow-hidden group hover:border-primary/30 transition-all">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm text-muted">Current Price</span>
              </div>
              <p className="text-2xl font-bold text-white">${price.price?.toFixed(2)}</p>
              <p className={`text-sm font-medium mt-1 flex items-center gap-1 ${isPositive ? 'text-primary' : 'text-secondary'}`}>
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {isPositive ? '+' : ''}{price.change?.toFixed(2)} ({price.changePercent?.toFixed(2)}%)
              </p>
            </div>

            <div className="card p-6 relative overflow-hidden hover:border-info/30 transition-all">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-info/20 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-info" />
                </div>
                <span className="text-sm text-muted">Day High</span>
              </div>
              <p className="text-2xl font-bold text-white">${price.high?.toFixed(2)}</p>
            </div>

            <div className="card p-6 relative overflow-hidden hover:border-warning/30 transition-all">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-warning/20 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-warning" />
                </div>
                <span className="text-sm text-muted">Day Low</span>
              </div>
              <p className="text-2xl font-bold text-white">${price.low?.toFixed(2)}</p>
            </div>

            <div className="card p-6 relative overflow-hidden hover:border-accent/30 transition-all">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-accent/20 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-accent" />
                </div>
                <span className="text-sm text-muted">Volume</span>
              </div>
              <p className="text-2xl font-bold text-white">{(price.volume / 1000000).toFixed(2)}M</p>
            </div>
          </div>

          {/* Chart */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                  isPositive ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                }`}>
                  {symbol.slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{symbol}</h2>
                  <p className="text-sm text-muted">{price.price?.toFixed(2)} USD</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-ghost text-xs">
                  <Info className="w-4 h-4 mr-1" />
                  Indicators
                </button>
              </div>
            </div>

            {loading ? (
              <div className="h-[450px] flex items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                  <p className="text-muted">Loading chart data...</p>
                </div>
              </div>
            ) : (
              <div ref={chartContainer} className="w-full" />
            )}
          </div>

          {/* Stock Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Market Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted">Open</span>
                  <span className="font-medium text-white">${price.open?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted">Previous Close</span>
                  <span className="font-medium text-white">${(price.price - price.change)?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted">52 Week High</span>
                  <span className="font-medium text-primary">${(price.price * 1.2)?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted">52 Week Low</span>
                  <span className="font-medium text-secondary">${(price.price * 0.8)?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <LineChart className="w-5 h-5 text-accent" />
                Price Analysis
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted">Change Today</span>
                  <span className={`font-medium ${isPositive ? 'text-primary' : 'text-secondary'}`}>
                    {isPositive ? '+' : ''}{price.change?.toFixed(2)} ({price.changePercent?.toFixed(2)}%)
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted">Market Cap</span>
                  <span className="font-medium text-white">{(price.price * 1000000000 / 1000000).toFixed(0)}B</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted">Day Range</span>
                  <span className="font-medium text-white">${price.low?.toFixed(2)} - ${price.high?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted">Avg Volume</span>
                  <span className="font-medium text-white">{(price.volume / 1000000).toFixed(0)}M</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!price && !loading && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <LineChart className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Search for a Symbol</h3>
          <p className="text-muted mb-4">Enter a stock symbol to view real-time market data and charts</p>
          <button onClick={loadData} className="btn-primary">
            Load Demo Data
          </button>
        </div>
      )}
    </div>
  );
}