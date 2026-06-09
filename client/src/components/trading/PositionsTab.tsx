import React, { useState } from 'react';
import { Bot, Position } from '../../store/appStore';
import { BarChart3, Check, X, PencilLine } from 'lucide-react';

interface PositionsTabProps {
  bot: Bot;
  prices: Record<string, any>;
  pairNames: Record<string, string>;
  onClosePosition: (posId: string, cp: number) => void;
  onCloseAllPositions: () => void;
  onUpdatePositionSLTP: (posId: string, sl?: number, tp?: number) => void;
}

export function PositionsTab({
  bot,
  prices,
  pairNames,
  onClosePosition,
  onCloseAllPositions,
  onUpdatePositionSLTP,
}: PositionsTabProps) {
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [editSL, setEditSL] = useState('');
  const [editTP, setEditTP] = useState('');

  const handleStartEdit = (pos: Position) => {
    setEditingPosId(pos.id);
    setEditSL(pos.stopLoss?.toString() || '');
    setEditTP(pos.takeProfit?.toString() || '');
  };

  const handleSave = (posId: string) => {
    const sl = editSL ? parseFloat(editSL) : undefined;
    const tp = editTP ? parseFloat(editTP) : undefined;
    onUpdatePositionSLTP(posId, sl, tp);
    setEditingPosId(null);
  };

  return (
    <div className="space-y-4">
      {bot.positions.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 border border-border">
            <BarChart3 className="w-5 h-5 text-muted" />
          </div>
          <p className="text-sm text-muted">No open positions</p>
          <p className="text-xs text-muted/80 mt-1">Start the bot and wait for agentic trading signals to execute positions</p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center px-4 pt-4">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Active Holdings</h4>
            <button
              onClick={onCloseAllPositions}
              className="text-xs px-3 py-1.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 transition-all font-semibold"
            >
              Close All Positions
            </button>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted border-b border-border">
                  <th className="text-left p-4 font-semibold uppercase tracking-wider">Pair</th>
                  <th className="text-left p-4 font-semibold uppercase tracking-wider">Type</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Quantity</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Entry Price</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Mark Price</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Stop Loss</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Take Profit</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">PNL</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {bot.positions.map(pos => {
                  const cp = prices[pos.symbol]?.price || pos.entryPrice;
                  const pnl = pos.type === 'sell' ? (pos.entryPrice - cp) * pos.quantity : (cp - pos.entryPrice) * pos.quantity;
                  const pnlPct = ((cp - pos.entryPrice) / pos.entryPrice) * 100 * (pos.type === 'sell' ? -1 : 1);
                  const isEditing = editingPosId === pos.id;

                  return (
                    <tr key={pos.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-white">{pairNames[pos.symbol] || pos.symbol.replace('USDT', '')}</span>
                          <span className="text-xs text-muted">/USDT</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            pos.type === 'buy'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-secondary/10 text-secondary border border-secondary/20'
                          }`}
                        >
                          {pos.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-right text-sm font-mono text-white">{pos.quantity}</td>
                      <td className="p-4 text-right text-sm font-mono text-white">${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right text-sm font-mono text-white">${cp.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editSL}
                              onChange={e => setEditSL(e.target.value)}
                              placeholder="--"
                              className="w-16 bg-background border border-border rounded px-1.5 py-0.5 text-secondary font-mono text-xs text-right focus:outline-none focus:border-primary"
                            />
                            <span className="text-secondary text-xs font-semibold">%</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(pos)}
                            className="text-xs font-mono text-muted hover:text-white transition-colors flex items-center gap-1 justify-end ml-auto"
                          >
                            {pos.stopLoss ? <span className="text-secondary font-semibold">{pos.stopLoss}%</span> : <span>--</span>}
                            <PencilLine className="w-3 h-3 text-muted/50" />
                          </button>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editTP}
                              onChange={e => setEditTP(e.target.value)}
                              placeholder="--"
                              className="w-16 bg-background border border-border rounded px-1.5 py-0.5 text-primary font-mono text-xs text-right focus:outline-none focus:border-primary"
                            />
                            <span className="text-primary text-xs font-semibold">%</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(pos)}
                            className="text-xs font-mono text-muted hover:text-white transition-colors flex items-center gap-1 justify-end ml-auto"
                          >
                            {pos.takeProfit ? <span className="text-primary font-semibold">{pos.takeProfit}%</span> : <span>--</span>}
                            <PencilLine className="w-3 h-3 text-muted/50" />
                          </button>
                        )}
                      </td>
                      <td className={`p-4 text-right text-sm font-mono font-semibold ${pnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        <span className="text-xs font-medium ml-1.5">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
                      </td>
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSave(pos.id)}
                              className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingPosId(null)}
                              className="p-1 rounded bg-white/5 hover:bg-white/10 text-muted"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => onClosePosition(pos.id, cp)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 transition-all font-semibold"
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Position Cards */}
          <div className="md:hidden space-y-2.5 p-3">
            {bot.positions.map(pos => {
              const cp = prices[pos.symbol]?.price || pos.entryPrice;
              const pnl = pos.type === 'sell' ? (pos.entryPrice - cp) * pos.quantity : (cp - pos.entryPrice) * pos.quantity;
              const pnlPct = ((cp - pos.entryPrice) / pos.entryPrice) * 100 * (pos.type === 'sell' ? -1 : 1);
              const isEditing = editingPosId === pos.id;

              return (
                <div key={pos.id} className="bg-background border border-border rounded-xl p-4 shadow-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {pairNames[pos.symbol] || pos.symbol.replace('USDT', '')}/USDT
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          pos.type === 'buy' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                        }`}
                      >
                        {pos.type.toUpperCase()}
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSave(pos.id)}
                          className="px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20 text-xs font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPosId(null)}
                          className="px-2.5 py-1 rounded bg-white/5 text-muted text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleStartEdit(pos)}
                          className="text-xs px-2.5 py-1.5 rounded bg-white/5 text-muted hover:text-white border border-border"
                        >
                          Edit SL/TP
                        </button>
                        <button
                          onClick={() => onClosePosition(pos.id, cp)}
                          className="text-xs px-2.5 py-1.5 rounded bg-secondary/10 text-secondary border border-secondary/20 font-semibold"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3 text-muted">
                    <div>
                      <span>Quantity</span>
                      <p className="text-white font-mono font-medium">{pos.quantity}</p>
                    </div>
                    <div>
                      <span>Entry Price</span>
                      <p className="text-white font-mono font-medium">${pos.entryPrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <span>Mark Price</span>
                      <p className="text-white font-mono font-medium">${cp.toLocaleString()}</p>
                    </div>
                    <div>
                      <span>Holding PNL</span>
                      <p className={`font-mono font-bold ${pnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                      </p>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                      <div>
                        <label className="text-[10px] text-muted block mb-1">Stop Loss (%)</label>
                        <input
                          type="number"
                          value={editSL}
                          onChange={e => setEditSL(e.target.value)}
                          placeholder="--"
                          className="w-full bg-background border border-border rounded px-2 py-1 text-secondary font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted block mb-1">Take Profit (%)</label>
                        <input
                          type="number"
                          value={editTP}
                          onChange={e => setEditTP(e.target.value)}
                          placeholder="--"
                          className="w-full bg-background border border-border rounded px-2 py-1 text-primary font-mono text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 pt-2 border-t border-border/50 text-xs">
                      <div>
                        <span className="text-muted mr-1.5">SL:</span>
                        {pos.stopLoss ? <span className="text-secondary font-semibold">{pos.stopLoss}%</span> : <span className="text-muted">--</span>}
                      </div>
                      <div>
                        <span className="text-muted mr-1.5">TP:</span>
                        {pos.takeProfit ? <span className="text-primary font-semibold">{pos.takeProfit}%</span> : <span className="text-muted">--</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
