import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { fetchCryptoPrices } from '../lib/api';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart3,
  RefreshCw,
  DollarSign,
  Target
} from 'lucide-react';

export default function Trading() {
  const {
    walletBalance,
    aiTradingPercent,
    aiTradingEnabled,
    aiSymbols,
    aiStopLoss,
    aiTakeProfit,
  } = useAppStore();

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [quantity, setQuantity] = useState('');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, any>>({});

  useEffect(() => {
    loadPrices();
  }, []);



  const loadPrices = async () => {
    try {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
      const data = await fetchCryptoPrices(symbols);
      const priceMap: Record<string, any> = {};
      data.forEach((d: any) => {
        priceMap[d.symbol] = d;
      });
      setPrices(priceMap);
      if (symbol) setCurrentPrice(priceMap[symbol]?.price || 0);
    } catch (e) {
      console.error(e);
    }
  };

  const amount = currentPrice * (parseFloat(quantity) || 0);
  const aiTradingAmount = (walletBalance * aiTradingPercent) / 100;

  const handleBuy = () => {
    if (!symbol || !quantity) return;
    setLoading(true);
    // Execute buy order
    setTimeout(() => {
      setPositions([...positions, {
        id: Date.now().toString(),
        symbol,
        type: 'buy',
        quantity: parseFloat(quantity),
        entryPrice: currentPrice,
        pnl: 0,
      }]);
      setQuantity('');
      setLoading(false);
    }, 1000);
  };

  const handleSell = (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;

    const pnl = (currentPrice - position.entryPrice) * position.quantity;
    setHistory([...history, { ...position, pnl, exitPrice: currentPrice }]);
    setPositions(positions.filter(p => p.id !== positionId));
  };

  const totalPnL = positions.reduce((sum, p) => {
    const current = prices[p.symbol]?.price || p.entryPrice;
    return sum + (current - p.entryPrice) * p.quantity;
  }, 0) + history.reduce((sum, t) => sum + (t.pnl || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Trading</h1>
          <p className="text-muted">Execute trades and manage positions</p>
        </div>
        <button onClick={loadPrices} disabled={loading} className="btn-ghost flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card green p-6">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
          </div>
          <p className="text-sm text-muted mt-4 mb-1">Wallet Balance</p>
          <p className="text-2xl font-bold text-white">${walletBalance.toLocaleString()}</p>
        </div>

        <div className="stat-card blue p-6">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-info" />
            </div>
          </div>
          <p className="text-sm text-muted mt-4 mb-1">AI Trading Amount</p>
          <p className="text-2xl font-bold text-white">${aiTradingAmount.toFixed(0)}</p>
          <p className="text-xs text-muted">{aiTradingPercent}% of wallet</p>
        </div>

        <div className="stat-card purple p-6">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-accent" />
            </div>
          </div>
          <p className="text-sm text-muted mt-4 mb-1">Open Positions</p>
          <p className="text-2xl font-bold text-white">{positions.length}</p>
        </div>

        <div className={`stat-card ${totalPnL >= 0 ? 'green' : 'red'} p-6`}>
          <div className="flex items-center justify-between">
            <div className={`w-12 h-12 rounded-xl ${totalPnL >= 0 ? 'bg-primary/20' : 'bg-secondary/20'} flex items-center justify-center`}>
              {totalPnL >= 0 ? <TrendingUp className="w-6 h-6 text-primary" /> : <TrendingDown className="w-6 h-6 text-secondary" />}
            </div>
          </div>
          <p className="text-sm text-muted mt-4 mb-1">Total P&L</p>
          <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-primary' : 'text-secondary'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trade Form */}
        <div className="lg:col-span-1">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                {orderType === 'buy' ? (
                  <ArrowUpRight className="w-5 h-5 text-primary" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-secondary" />
                )}
              </div>
              <h2 className="text-lg font-semibold text-white">Place Order</h2>
            </div>

            {/* Symbol Selector */}
            <div className="mb-4">
              <label className="block text-sm text-muted mb-2">Trading Pair</label>
              <select
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value);
                  setCurrentPrice(prices[e.target.value]?.price || 0);
                }}
                className="input w-full"
              >
                <option value="BTCUSDT">BTC/USDT</option>
                <option value="ETHUSDT">ETH/USDT</option>
                <option value="SOLUSDT">SOL/USDT</option>
                <option value="BNBUSDT">BNB/USDT</option>
                <option value="XRPUSDT">XRP/USDT</option>
              </select>
            </div>

            {/* Current Price */}
            <div className="mb-4 p-4 rounded-xl bg-background/50">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Current Price</span>
                <span className="text-lg font-bold text-white">
                  ${currentPrice > 1 ? currentPrice.toFixed(2) : currentPrice.toFixed(6)}
                </span>
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <label className="block text-sm text-muted mb-2">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input w-full"
                placeholder="0.00"
                min="0"
              />
            </div>

            {/* Amount */}
            <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Total Amount</span>
                <span className="text-xl font-bold text-primary">
                  ${amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Buy/Sell Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOrderType('buy')}
                className={`py-4 rounded-xl font-semibold transition-all ${
                  orderType === 'buy'
                    ? 'bg-gradient-to-r from-primary to-primary-light text-white shadow-lg shadow-primary/30'
                    : 'bg-background text-muted border border-border'
                }`}
              >
                <Plus className="w-5 h-5 inline mr-1" />
                Buy
              </button>
              <button
                onClick={() => setOrderType('sell')}
                className={`py-4 rounded-xl font-semibold transition-all ${
                  orderType === 'sell'
                    ? 'bg-gradient-to-r from-secondary to-secondary-light text-white shadow-lg shadow-secondary/30'
                    : 'bg-background text-muted border border-border'
                }`}
              >
                <Minus className="w-5 h-5 inline mr-1" />
                Sell
              </button>
            </div>

            <button
              onClick={orderType === 'buy' ? handleBuy : () => handleSell(positions[0]?.id)}
              disabled={loading || !quantity || amount <= 0}
              className={`w-full mt-4 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                orderType === 'buy' ? 'btn-primary' : 'btn-secondary'
              } disabled:opacity-50`}
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {orderType === 'buy' ? 'Buy' : 'Sell'} {symbol.replace('USDT', '')}
                </>
              )}
            </button>
          </div>

          {/* AI Trading Info */}
          {aiTradingEnabled && (
            <div className="card p-4 mt-4 bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-accent" />
                <span className="font-semibold text-white">AI Trading Active</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Trading Pairs</span>
                  <span className="text-white">{aiSymbols.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Stop Loss</span>
                  <span className="text-secondary">{aiStopLoss}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Take Profit</span>
                  <span className="text-primary">{aiTakeProfit}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Positions & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Open Positions */}
          <div className="card">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Open Positions
              </h3>
            </div>

            <div className="p-6">
              {positions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-muted/10 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-8 h-8 text-muted" />
                  </div>
                  <p className="text-muted">No open positions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {positions.map((pos) => {
                    const currentPrice = prices[pos.symbol]?.price || pos.entryPrice;
                    const pnl = (currentPrice - pos.entryPrice) * pos.quantity;
                    const pnlPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

                    return (
                      <div key={pos.id} className="p-4 rounded-xl bg-background/50 border border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                              pos.type === 'buy' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                            }`}>
                              {pos.symbol.replace('USDT', '')}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{pos.symbol.replace('USDT', '')}/USDT</p>
                              <p className="text-sm text-muted">
                                {pos.quantity} @ ${pos.entryPrice.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-lg font-bold text-white">
                              ${(currentPrice * pos.quantity).toFixed(2)}
                            </p>
                            <p className={`text-sm font-medium ${pnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPercent.toFixed(2)}%)
                            </p>
                          </div>

                          <button
                            onClick={() => handleSell(pos.id)}
                            className="btn-secondary py-2 px-4"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Trade History */}
          <div className="card">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                Trade History
              </h3>
            </div>

            <div className="p-6">
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-muted/10 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-muted" />
                  </div>
                  <p className="text-muted">No trade history yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.slice(-10).reverse().map((trade) => (
                    <div key={trade.id} className="flex items-center justify-between p-3 rounded-xl bg-background/50">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${trade.type === 'buy' ? 'text-primary' : 'text-secondary'}`}>
                          {trade.type.toUpperCase()}
                        </span>
                        <span className="font-medium text-white">{trade.symbol.replace('USDT', '')}</span>
                        <span className="text-muted">x{trade.quantity}</span>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${trade.pnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted">{new Date().toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}