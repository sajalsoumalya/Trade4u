import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { getPositions, getTradeHistory, placeOrder, closePosition, fetchPrice } from '../lib/api';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus,
  X,
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart3,
  ArrowLeftRight,
  RefreshCw,
  DollarSign,
  AlertCircle
} from 'lucide-react';

export default function Trading() {
  const { balance, tradingMode } = useAppStore();

  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'history'>('positions');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [posData, tradeData] = await Promise.all([
        getPositions(),
        getTradeHistory(20),
      ]);
      setPositions(posData);
      setHistory(tradeData.trades || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlaceOrder = async () => {
    if (!symbol || !quantity) return;
    setLoading(true);
    try {
      const priceData = await fetchPrice(symbol);
      await placeOrder(symbol, orderType, parseFloat(quantity), priceData.price);
      await loadData();
      setSymbol('');
      setQuantity('');
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleClosePosition = async (id: string, posSymbol: string) => {
    setLoading(true);
    try {
      const priceData = await fetchPrice(posSymbol);
      await closePosition(id, priceData.price);
      await loadData();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const totalPnL = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Trading</h1>
          <p className="text-muted">Place orders and manage your positions</p>
        </div>
        <button onClick={loadData} disabled={loading} className="btn-ghost flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card green p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <span className={`badge ${tradingMode === 'paper' ? 'badge-success' : 'badge-danger'}`}>
              {tradingMode === 'paper' ? 'Paper' : 'Live'}
            </span>
          </div>
          <p className="text-sm text-muted mb-1">Available Balance</p>
          <p className="text-2xl font-bold text-white">${balance.toLocaleString()}</p>
        </div>

        <div className="stat-card blue p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-info" />
            </div>
          </div>
          <p className="text-sm text-muted mb-1">Open Positions</p>
          <p className="text-2xl font-bold text-white">{positions.length}</p>
          <p className="text-xs text-muted mt-1">{positions.length} active</p>
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
          <p className="text-sm text-muted mb-1">Unrealized P&L</p>
          <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-primary' : 'text-secondary'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Form */}
        <div className="lg:col-span-1">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Place Order</h2>
                <p className="text-xs text-muted">{tradingMode === 'paper' ? 'Paper Trading Mode' : 'Live Trading'}</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm text-muted mb-2">Symbol</label>
                <div className="relative">
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="input w-full pl-4 pr-4 py-3"
                    placeholder="AAPL"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted mb-2">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input w-full py-3"
                  placeholder="100"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-3">Order Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setOrderType('buy')}
                    className={`relative py-4 rounded-xl font-semibold transition-all overflow-hidden ${
                      orderType === 'buy'
                        ? 'bg-gradient-to-br from-primary to-primary-light text-white shadow-lg shadow-primary/30'
                        : 'bg-background text-muted hover:text-white border border-border'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <ArrowUpRight className="w-5 h-5" />
                      Buy
                    </div>
                    {orderType === 'buy' && (
                      <div className="absolute inset-0 bg-white/10 animate-shimmer" />
                    )}
                  </button>
                  <button
                    onClick={() => setOrderType('sell')}
                    className={`relative py-4 rounded-xl font-semibold transition-all overflow-hidden ${
                      orderType === 'sell'
                        ? 'bg-gradient-to-br from-secondary to-secondary-light text-white shadow-lg shadow-secondary/30'
                        : 'bg-background text-muted hover:text-white border border-border'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <ArrowDownRight className="w-5 h-5" />
                      Sell
                    </div>
                    {orderType === 'sell' && (
                      <div className="absolute inset-0 bg-white/10 animate-shimmer" />
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={loading || !symbol || !quantity}
                className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  orderType === 'buy'
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {orderType === 'buy' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                    {orderType === 'buy' ? 'Buy' : 'Sell'} {symbol || 'Stock'}
                  </>
                )}
              </button>
            </div>
          </div>

          {tradingMode === 'paper' && (
            <div className="card p-4 mt-4 bg-warning/5 border-warning/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Paper Trading</p>
                  <p className="text-xs text-muted mt-1">
                    You're trading with virtual money. No real trades will be executed.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Positions & History */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('positions')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'positions'
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted hover:text-white'
                  }`}
                >
                  Open Positions ({positions.length})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'history'
                      ? 'bg-accent/20 text-accent'
                      : 'text-muted hover:text-white'
                  }`}
                >
                  Trade History ({history.length})
                </button>
              </div>
            </div>

            {activeTab === 'positions' ? (
              <div className="space-y-3">
                {positions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-muted/10 flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-8 h-8 text-muted" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">No Open Positions</h3>
                    <p className="text-sm text-muted">Place your first order to start trading</p>
                  </div>
                ) : (
                  positions.map((pos, index) => (
                    <div
                      key={pos.id}
                      className="group p-4 rounded-xl bg-background/50 border border-transparent hover:border-border transition-all animate-slide-up"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg ${
                            pos.type === 'buy' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                          }`}>
                            {pos.symbol?.slice(0, 2) || 'NA'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-white text-lg">{pos.symbol}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                pos.type === 'buy' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                              }`}>
                                {pos.type?.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-muted">
                              {pos.quantity} shares @ ${pos.price?.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold text-white text-lg">
                            ${(pos.currentPrice * pos.quantity || pos.price * pos.quantity)?.toLocaleString()}
                          </p>
                          <p className={`text-sm font-medium ${(pos.pnl || 0) >= 0 ? 'text-primary' : 'text-secondary'}`}>
                            {(pos.pnl || 0) >= 0 ? '+' : ''}${(pos.pnl || 0).toLocaleString()}
                          </p>
                        </div>

                        <div className="hidden group-hover:flex items-center gap-2">
                          <button
                            onClick={() => handleClosePosition(pos.id, pos.symbol)}
                            disabled={loading}
                            className="btn-secondary text-sm py-2 px-4 flex items-center gap-1"
                          >
                            <X className="w-4 h-4" />
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-muted/10 flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-muted" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">No Trade History</h3>
                    <p className="text-sm text-muted">Your completed trades will appear here</p>
                  </div>
                ) : (
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
                        {history.map((trade) => (
                          <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-xs ${
                                  trade.type === 'buy' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                                }`}>
                                  {trade.symbol?.slice(0, 2) || 'NA'}
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
                                {trade.type?.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-4 text-white">{trade.quantity}</td>
                            <td className="py-4 text-white">${trade.price?.toFixed(2)}</td>
                            <td className={`py-4 font-semibold ${(trade.pnl || 0) >= 0 ? 'text-primary' : 'text-secondary'}`}>
                              {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                            </td>
                            <td className="py-4 text-muted text-sm">
                              {new Date(trade.openedAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}