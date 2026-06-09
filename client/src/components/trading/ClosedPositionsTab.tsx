import React from 'react';
import { Bot } from '../../store/appStore';
import { History } from 'lucide-react';

interface ClosedPositionsTabProps {
  bot: Bot;
  pairNames: Record<string, string>;
}

export function ClosedPositionsTab({
  bot,
  pairNames,
}: ClosedPositionsTabProps) {
  const closed = [...bot.closedPositions].reverse();

  return (
    <div className="space-y-4">
      {closed.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 border border-border">
            <History className="w-5 h-5 text-muted" />
          </div>
          <p className="text-sm text-muted">No trading history</p>
          <p className="text-xs text-muted/80 mt-1">Completed positions and trade history will be archived here</p>
        </div>
      ) : (
        <>
          {/* Desktop Position History Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted border-b border-border">
                  <th className="text-left p-4 font-semibold uppercase tracking-wider">Time</th>
                  <th className="text-left p-4 font-semibold uppercase tracking-wider">Pair</th>
                  <th className="text-left p-4 font-semibold uppercase tracking-wider">Type</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Qty</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Entry</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Exit</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">SL</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">TP</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">PNL</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Fee</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {closed.map(cp => (
                  <tr key={cp.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                    <td className="p-4 text-xs text-muted font-mono">{new Date(cp.closedAt).toLocaleString()}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-white">{pairNames[cp.symbol] || cp.symbol.replace('USDT', '')}</span>
                        <span className="text-xs text-muted">/USDT</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          cp.type === 'buy'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-secondary/10 text-secondary border border-secondary/20'
                        }`}
                      >
                        {cp.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right text-sm font-mono text-white">{cp.quantity}</td>
                    <td className="p-4 text-right text-sm font-mono text-white">${cp.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-right text-sm font-mono text-white">${cp.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-right text-xs font-mono text-secondary">
                      {cp.stopLoss ? <span>{cp.stopLoss}%</span> : <span className="text-muted">--</span>}
                    </td>
                    <td className="p-4 text-right text-xs font-mono text-primary">
                      {cp.takeProfit ? <span>{cp.takeProfit}%</span> : <span className="text-muted">--</span>}
                    </td>
                    <td className={`p-4 text-right text-sm font-mono font-bold ${cp.pnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                      {cp.pnl >= 0 ? '+' : ''}${cp.pnl.toFixed(2)}
                      <span className="text-xs font-medium ml-1.5">({cp.pnlPct >= 0 ? '+' : ''}{cp.pnlPct.toFixed(2)}%)</span>
                    </td>
                    <td className="p-4 text-right text-sm font-mono text-muted">${cp.fee.toFixed(2)}</td>
                    <td className="p-4 text-right">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                          cp.status === 'closed'
                            ? 'bg-white/5 text-muted border border-border'
                            : cp.status === 'sl'
                            ? 'bg-secondary/10 text-secondary border border-secondary/20'
                            : cp.status === 'tp'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-warning/10 text-warning border border-warning/20'
                        }`}
                      >
                        {cp.status === 'closed'
                          ? 'Closed'
                          : cp.status === 'sl'
                          ? 'SL Hit'
                          : cp.status === 'tp'
                          ? 'TP Hit'
                          : 'Stopped'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Position History Cards */}
          <div className="md:hidden space-y-2.5 p-3">
            {closed.map(cp => (
              <div key={cp.id} className="bg-background border border-border rounded-xl p-4 shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {pairNames[cp.symbol] || cp.symbol.replace('USDT', '')}/USDT
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        cp.type === 'buy' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                      }`}
                    >
                      {cp.type.toUpperCase()}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${
                      cp.status === 'closed'
                        ? 'bg-white/5 text-muted border-border'
                        : cp.status === 'sl'
                        ? 'bg-secondary/10 text-secondary border-secondary/20'
                        : cp.status === 'tp'
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-warning/10 text-warning border-warning/20'
                    }`}
                  >
                    {cp.status === 'closed' ? 'Closed' : cp.status === 'sl' ? 'SL' : cp.status === 'tp' ? 'TP' : 'Stopped'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3 text-muted">
                  <div>
                    <span>Quantity</span>
                    <p className="text-white font-mono font-medium">{cp.quantity}</p>
                  </div>
                  <div>
                    <span>Entry Price</span>
                    <p className="text-white font-mono font-medium">${cp.entryPrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <span>Exit Price</span>
                    <p className="text-white font-mono font-medium">${cp.exitPrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <span>Transaction Fee</span>
                    <p className="text-muted font-mono">${cp.fee.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                  <div className="flex gap-3 text-muted">
                    <span>
                      SL: {cp.stopLoss ? <span className="text-secondary font-semibold font-mono">{cp.stopLoss}%</span> : '--'}
                    </span>
                    <span>
                      TP: {cp.takeProfit ? <span className="text-primary font-semibold font-mono">{cp.takeProfit}%</span> : '--'}
                    </span>
                  </div>
                  <p className={`font-mono font-bold ${cp.pnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                    {cp.pnl >= 0 ? '+' : ''}${cp.pnl.toFixed(2)} ({cp.pnlPct >= 0 ? '+' : ''}{cp.pnlPct.toFixed(2)}%)
                  </p>
                </div>
                <p className="text-[10px] text-muted mt-2 text-right font-mono">{new Date(cp.closedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
