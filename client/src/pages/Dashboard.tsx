import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { getBalance, getPositions, getTradeHistory } from '../lib/api';

export default function Dashboard() {
  const { balance, setBalance, tradingMode } = useAppStore();
  const [positions, setPositions] = useState<any[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [balData, posData, tradeData] = await Promise.all([
          getBalance(),
          getPositions(),
          getTradeHistory(5)
        ]);
        setBalance(balData.balance);
        setPositions(posData);
        setRecentTrades(tradeData.trades);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
  }, []);

  const totalPnL = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-gray-400 text-sm">Account Balance</p>
          <p className="text-2xl font-bold">${balance.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Mode: {tradingMode}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Open Positions</p>
          <p className="text-2xl font-bold">{positions.length}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Total P&L</p>
          <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-primary' : 'text-secondary'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Quick Trade */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Quick Trade</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Symbol (e.g., AAPL)"
            className="input flex-1"
          />
          <input
            type="number"
            placeholder="Qty"
            className="input w-24"
          />
          <button className="btn-primary">Buy</button>
          <button className="btn-secondary">Sell</button>
        </div>
      </div>

      {/* Open Positions */}
      {positions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Open Positions</h2>
          <div className="space-y-2">
            {positions.map((pos) => (
              <div key={pos.id} className="flex justify-between items-center p-3 bg-background rounded-lg">
                <div>
                  <span className="font-medium">{pos.symbol}</span>
                  <span className="text-gray-400 ml-2">
                    {pos.type} {pos.quantity} @ ${pos.price?.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <p className={pos.pnl >= 0 ? 'text-primary' : 'text-secondary'}>
                    {pos.pnl >= 0 ? '+' : ''}${pos.pnl?.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Trades */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Trades</h2>
        {recentTrades.length === 0 ? (
          <p className="text-gray-400">No trades yet</p>
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade) => (
              <div key={trade.id} className="flex justify-between p-3 bg-background rounded-lg">
                <span>{trade.symbol} - {trade.type} {trade.quantity}</span>
                <span className={trade.pnl >= 0 ? 'text-primary' : 'text-secondary'}>
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}