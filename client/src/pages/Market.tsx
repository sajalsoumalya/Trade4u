import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData } from 'lightweight-charts';
import { fetchPrice, fetchHistory } from '../lib/api';

export default function Market() {
  const chartContainer = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [symbol, setSymbol] = useState('SPY');
  const [price, setPrice] = useState<any>(null);
  const [period, setPeriod] = useState('1mo');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chartContainer.current) return;

    chartRef.current = createChart(chartContainer.current, {
      layout: {
        background: { color: '#1A1A1A' },
        textColor: '#9CA3AF'
      },
      grid: {
        vertLines: { color: '#2A2A2A' },
        horzLines: { color: '#2A2A2A' }
      },
      width: chartContainer.current.clientWidth,
      height: 400
    });

    seriesRef.current = chartRef.current.addLineSeries({
      color: '#10B981',
      lineWidth: 2
    });

    const handleResize = () => {
      if (chartRef.current && chartContainer.current) {
        chartRef.current.applyOptions({
          width: chartContainer.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.remove();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [priceData, historyData] = await Promise.all([
        fetchPrice(symbol),
        fetchHistory(symbol, period)
      ]);
      setPrice(priceData);

      if (historyData.data && seriesRef.current) {
        const chartData: LineData[] = historyData.data.map((d: any) => ({
          time: d.time,
          value: d.close
        }));
        seriesRef.current.setData(chartData);
        chartRef.current?.timeScale().fitContent();
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [symbol, period]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Market</h1>
        <div className="flex gap-2">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="input w-32"
            placeholder="Symbol"
          />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input"
          >
            <option value="1d">1 Day</option>
            <option value="1w">1 Week</option>
            <option value="1mo">1 Month</option>
            <option value="3mo">3 Months</option>
            <option value="1y">1 Year</option>
          </select>
          <button onClick={loadData} disabled={loading} className="btn-primary">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Price Card */}
      {price && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-gray-400 text-sm">Price</p>
            <p className="text-2xl font-bold">${price.price?.toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-gray-400 text-sm">Change</p>
            <p className={`text-2xl font-bold ${price.change >= 0 ? 'text-primary' : 'text-secondary'}`}>
              {price.change >= 0 ? '+' : ''}{price.change?.toFixed(2)} ({price.changePercent?.toFixed(2)}%)
            </p>
          </div>
          <div className="card">
            <p className="text-gray-400 text-sm">Day High</p>
            <p className="text-2xl font-bold">${price.high?.toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-gray-400 text-sm">Day Low</p>
            <p className="text-2xl font-bold">${price.low?.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="card">
        <div ref={chartContainer} className="w-full" />
      </div>
    </div>
  );
}