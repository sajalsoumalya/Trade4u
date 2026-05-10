export default function Dashboard() {
  const balance = 100000;
  const positions = [
    { id: '1', symbol: 'AAPL', type: 'buy', quantity: 100, price: 178.50, pnl: 250 },
    { id: '2', symbol: 'NVDA', type: 'buy', quantity: 50, price: 875.00, pnl: -120 }
  ];
  const recentTrades = [
    { id: '1', symbol: 'TSLA', type: 'buy', quantity: 200, pnl: 150 },
    { id: '2', symbol: 'SPY', type: 'sell', quantity: 50, pnl: 75 }
  ];

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">Paper Trading</span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <p className="text-gray-400 text-sm">Account Balance</p>
          <p className="text-3xl font-bold text-primary">${balance.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Paper Trading Mode</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Open Positions</p>
          <p className="text-3xl font-bold">{positions.length}</p>
          <p className="text-xs text-gray-500 mt-1">{positions.length} active</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">Total P&L</p>
          <p className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-primary' : 'text-secondary'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL}
          </p>
          <p className="text-xs text-gray-500 mt-1">All time</p>
        </div>
      </div>

      {/* Quick Trade */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Quick Trade</h2>
        <div className="flex flex-wrap gap-3">
          <input type="text" placeholder="Symbol (e.g., AAPL)" className="input flex-1 min-w-[150px]" />
          <input type="number" placeholder="Qty" className="input w-24" />
          <button className="btn-primary bg-primary hover:bg-primary/90">Buy</button>
          <button className="btn-secondary bg-secondary hover:bg-secondary/90">Sell</button>
        </div>
      </div>

      {/* Open Positions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Open Positions</h2>
        <div className="space-y-3">
          {positions.map((pos) => (
            <div key={pos.id} className="flex justify-between items-center p-4 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${pos.type === 'buy' ? 'bg-primary' : 'bg-secondary'}`}></span>
                <div>
                  <span className="font-bold text-lg">{pos.symbol}</span>
                  <span className="text-gray-400 ml-2">{pos.type.toUpperCase()} {pos.quantity} @ ${pos.price}</span>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${pos.pnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                  {pos.pnl >= 0 ? '+' : ''}${pos.pnl}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Trades */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Trades</h2>
        <div className="space-y-3">
          {recentTrades.map((trade) => (
            <div key={trade.id} className="flex justify-between items-center p-3 bg-[#0A0A0A] rounded-lg">
              <div className="flex items-center gap-2">
                <span className={`text-xs ${trade.type === 'buy' ? 'text-primary' : 'text-secondary'}`}>{trade.type.toUpperCase()}</span>
                <span className="font-medium">{trade.symbol}</span>
                <span className="text-gray-400">×{trade.quantity}</span>
              </div>
              <span className={`${trade.pnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}