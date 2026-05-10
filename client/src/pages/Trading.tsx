import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { getPositions, getTradeHistory, placeOrder, closePosition, fetchPrice } from '../lib/api';

export default function Trading() {
  const { balance, tradingMode } = useAppStore();

  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [posData, tradeData] = await Promise.all([
        getPositions(),
        getTradeHistory(20)
      ]);
      setPositions(posData);
      setHistory(tradeData.trades);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlaceOrder = async () => {
    if (!symbol || !quantity) return;
    setLoading(true);
    try {
      // Get current price if not provided
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

  const handleClosePosition = async (id: string) => {
    setLoading(true);
    try {
      const priceData = await fetchPrice(positions.find(p => p.id === id)?.symbol || 'SPY');
      await closePosition(id, priceData.price);
      await loadData();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Trading</h1>

      {/* Balance and Mode */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <p className="text-gray-400 text-sm">Available Balance</p>
          <p className="text-2xl font-bold">${balance.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Trading Mode</p>
          <p className={`text-2xl font-bold ${tradingMode === 'paper' ? 'text-primary' : 'text-secondary'}`}>
            {tradingMode === 'paper' ? 'Paper Trading' : 'Live Trading'}
          </p>
        </div>
      </div>

      {/* Place Order */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Place Order</h2>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="input flex-1 min-w-32"
            placeholder="Symbol"
          />
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="input w-32"
            placeholder="Quantity"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setOrderType('buy')}
              className={`px-4 py-2 rounded-lg font-medium ${
                orderType === 'buy' ? 'bg-primary text-white' : 'bg-surface text-gray-400'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setOrderType('sell')}
              className={`px-4 py-2 rounded-lg font-medium ${
                orderType === 'sell' ? 'bg-secondary text-white' : 'bg-surface text-gray-400'
              }`}
            >
              Sell
            </button>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={loading || !symbol || !quantity}
            className="btn-primary"
          >
            {loading ? 'Processing...' : 'Place Order'}
          </button>
        </div>
      </div>

      {/* Open Positions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Open Positions</h2>
        {positions.length === 0 ? (
          <p className="text-gray-400">No open positions</p>
        ) : (
          <div className="space-y-2">
            {positions.map((pos) => (
              <div key={pos.id} className="flex justify-between items-center p-3 bg-background rounded-lg">
                <div>
                  <span className="font-medium">{pos.symbol}</span>
                  <span className="text-gray-400 ml-2">
                    {pos.type} {pos.quantity} @ ${pos.price?.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => handleClosePosition(pos.id)}
                  disabled={loading}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade History */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Trade History</h2>
        {history.length === 0 ? (
          <p className="text-gray-400">No trades yet</p>
        ) : (
          <div className="space-y-2">
            {history.map((trade) => (
              <div key={trade.id} className="flex justify-between p-3 bg-background rounded-lg">
                <div>
                  <span className="font-medium">{trade.symbol}</span>
                  <span className="text-gray-400 ml-2">
                    {trade.type} {trade.quantity} @ ${trade.price?.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <p className={trade.pnl >= 0 ? 'text-primary' : 'text-secondary'}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(trade.openedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}