import { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Activity,
  DollarSign,
  BarChart3,
  Clock,
  Play,
  RefreshCw
} from 'lucide-react';

const balance = 100000;
const positions = [
  { id: '1', symbol: 'AAPL', type: 'buy', quantity: 100, price: 178.50, currentPrice: 182.50, pnl: 400 },
  { id: '2', symbol: 'NVDA', type: 'buy', quantity: 50, price: 875.00, currentPrice: 860.00, pnl: -750 },
  { id: '3', symbol: 'TSLA', type: 'buy', quantity: 75, price: 245.00, currentPrice: 258.75, pnl: 1031.25 },
];
const recentTrades = [
  { id: '1', symbol: 'TSLA', type: 'buy', quantity: 200, price: 245.00, pnl: 2750, date: '2024-01-15' },
  { id: '2', symbol: 'SPY', type: 'sell', quantity: 50, price: 478.50, pnl: 375, date: '2024-01-14' },
  { id: '3', symbol: 'AAPL', type: 'buy', quantity: 100, price: 178.50, pnl: 400, date: '2024-01-13' },
  { id: '4', symbol: 'NVDA', type: 'buy', quantity: 25, price: 890.00, pnl: -750, date: '2024-01-12' },
];
const marketIndices = [
  { symbol: 'SPY', name: 'S&P 500', price: 478.52, change: 2.35, changePercent: 0.49 },
  { symbol: 'QQQ', name: 'NASDAQ', price: 412.18, change: 5.82, changePercent: 1.43 },
  { symbol: 'DIA', name: 'DOW', price: 385.20, change: -1.45, changePercent: -0.38 },
  { symbol: 'IWM', name: 'Russell', price: 198.45, change: 1.23, changePercent: 0.62 },
];

export default function Dashboard() {
  const [quickTradeSymbol, setQuickTradeSymbol] = useState('');
  const [quickTradeQty, setQuickTradeQty] = useState('');
  const [quickTradeType, setQuickTradeType] = useState<'buy' | 'sell'>('buy');

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalValue = positions.reduce((sum, p) => sum + (p.currentPrice * p.quantity), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-muted">Welcome back! Here's your portfolio overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-success flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Live Market
          </span>
          <button className="btn-ghost flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Market Indices */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {marketIndices.map((index) => (
          <div key={index.symbol} className="card p-4 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white">{index.symbol}</span>
              {index.change >= 0 ? (
                <TrendingUp className="w-4 h-4 text-primary" />
              ) : (
                <TrendingDown className="w-4 h-4 text-secondary" />
              )}
            </div>
            <p className="text-lg font-bold text-white">${index.price.toFixed(2)}</p>
            <p className={`text-sm font-medium ${index.change >= 0 ? 'text-primary' : 'text-secondary'}`}>
              {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent.toFixed(2)}%)
            </p>
          </div>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card green p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <span className="badge-success text-xs">Paper Mode</span>
          </div>
          <p className="text-sm text-muted mb-1">Account Balance</p>
          <p className="text-2xl font-bold text-white">${balance.toLocaleString()}</p>
        </div>

        <div className="stat-card blue p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-info" />
            </div>
          </div>
          <p className="text-sm text-muted mb-1">Portfolio Value</p>
          <p className="text-2xl font-bold text-white">${(balance + totalValue + totalPnL).toLocaleString()}</p>
        </div>

        <div className="stat-card purple p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-accent" />
            </div>
          </div>
          <p className="text-sm text-muted mb-1">Open Positions</p>
          <p className="text-2xl font-bold text-white">{positions.length}</p>
          <p className="text-xs text-muted mt-1">{positions.length} active trades</p>
        </div>

        <div className={`stat-card ${totalPnL >= 0 ? 'green' : 'red'} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl ${totalPnL >= 0 ? 'bg-primary/20' : 'bg-secondary/20'} flex items-center justify-center`}>
              {totalPnL >= 0 ? (
                <TrendingUp className="w-6 h-6 text-primary" />
              ) : (
                <TrendingDown className="w-6 h-6 text-secondary" />
              )}
            </div>
          </div>
          <p className="text-sm text-muted mb-1">Total P&L</p>
          <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-primary' : 'text-secondary'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}
          </p>
          <p className="text-xs text-muted mt-1">All time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Open Positions */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Open Positions
              </h2>
              <a href="/trading" className="text-sm text-primary hover:text-primary-light flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            <div className="space-y-3">
              {positions.map((pos, index) => (
                <div
                  key={pos.id}
                  className="group p-4 rounded-xl bg-background/50 hover:bg-background border border-transparent hover:border-border transition-all cursor-pointer animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                        pos.type === 'buy' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                      }`}>
                        {pos.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{pos.symbol}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            pos.type === 'buy' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                          }`}>
                            {pos.type.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-muted">
                          {pos.quantity} shares @ ${pos.price.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-white">
                        ${(pos.currentPrice * pos.quantity).toLocaleString()}
                      </p>
                      <p className={`text-sm font-medium ${pos.pnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                        {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toLocaleString()}
                      </p>
                    </div>

                    <div className="hidden group-hover:flex items-center gap-2">
                      <button className="btn-ghost text-xs py-1 px-2">Edit</button>
                      <button className="btn-secondary text-xs py-1 px-2">Close</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Trade */}
        <div>
          <div className="card">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
              <Play className="w-5 h-5 text-accent" />
              Quick Trade
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-2">Symbol</label>
                <input
                  type="text"
                  placeholder="AAPL"
                  value={quickTradeSymbol}
                  onChange={(e) => setQuickTradeSymbol(e.target.value.toUpperCase())}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-2">Quantity</label>
                <input
                  type="number"
                  placeholder="100"
                  value={quickTradeQty}
                  onChange={(e) => setQuickTradeQty(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-2">Order Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setQuickTradeType('buy')}
                    className={`py-3 rounded-xl font-semibold transition-all ${
                      quickTradeType === 'buy'
                        ? 'bg-gradient-to-r from-primary to-primary-light text-white shadow-lg shadow-primary/30'
                        : 'bg-background text-muted hover:text-white'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setQuickTradeType('sell')}
                    className={`py-3 rounded-xl font-semibold transition-all ${
                      quickTradeType === 'sell'
                        ? 'bg-gradient-to-r from-secondary to-secondary-light text-white shadow-lg shadow-secondary/30'
                        : 'bg-background text-muted hover:text-white'
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>

              <button className={`w-full ${quickTradeType === 'buy' ? 'btn-primary' : 'btn-secondary'} flex items-center justify-center gap-2`}>
                {quickTradeType === 'buy' ? 'Buy' : 'Sell'} {quickTradeSymbol || 'Stock'}
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Recent Trades
          </h2>
          <a href="/trading" className="text-sm text-primary hover:text-primary-light flex items-center gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-muted border-b border-border">
                <th className="pb-3 font-medium">Symbol</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Quantity</th>
                <th className="pb-3 font-medium">Price</th>
                <th className="pb-3 font-medium">P&L</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {recentTrades.map((trade) => (
                <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-xs ${
                        trade.type === 'buy' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                      }`}>
                        {trade.symbol.slice(0, 2)}
                      </div>
                      <span className="font-semibold text-white">{trade.symbol}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                      trade.type === 'buy' ? 'text-primary' : 'text-secondary'
                    }`}>
                      {trade.type === 'buy' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {trade.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 text-white">{trade.quantity}</td>
                  <td className="py-4 text-white">${trade.price.toFixed(2)}</td>
                  <td className={`py-4 font-semibold ${trade.pnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString()}
                  </td>
                  <td className="py-4 text-muted text-sm">{trade.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}