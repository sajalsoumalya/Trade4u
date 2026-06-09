import React from 'react';

interface TradingStatsProps {
  walletBalance: number;
  activeBots: number;
  totalBots: number;
  totalInvested: number;
  totalPnl: number;
  winRate: string;
  totalTrades: number;
}

export function TradingStats({
  walletBalance,
  activeBots,
  totalBots,
  totalInvested,
  totalPnl,
  winRate,
  totalTrades,
}: TradingStatsProps) {
  const roi = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Balance', val: `$${walletBalance.toLocaleString()}`, color: 'text-white' },
          { label: 'Active Bots', val: `${activeBots}/${totalBots}`, color: 'text-primary' },
          { label: 'Total Invested', val: `$${totalInvested.toLocaleString()}`, color: 'text-white' },
          { label: 'Total P&L', val: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? 'text-primary' : 'text-secondary' },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-5 shadow-card hover:border-gray-700 transition-all duration-300">
            <p className="text-xs text-muted mb-1 font-medium tracking-wide uppercase">{s.label}</p>
            <p className={`text-xl font-bold font-mono ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Secondary Stats Summary */}
      {totalBots > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface border border-border rounded-xl p-4 shadow-card">
            <p className="text-xs text-muted mb-1">Win Rate</p>
            <p className={`text-base font-bold font-mono ${parseFloat(winRate) >= 50 ? 'text-primary' : 'text-secondary'}`}>{winRate}%</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 shadow-card">
            <p className="text-xs text-muted mb-1">Total Trades</p>
            <p className="text-base font-bold font-mono text-white">{totalTrades}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 shadow-card">
            <p className="text-xs text-muted mb-1">Active Engine Instances</p>
            <p className="text-base font-bold font-mono text-primary">{activeBots}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 shadow-card">
            <p className="text-xs text-muted mb-1">Average Bot ROI</p>
            <p className={`text-base font-bold font-mono ${totalPnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
              {totalPnl >= 0 ? '+' : ''}{roi.toFixed(2)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
