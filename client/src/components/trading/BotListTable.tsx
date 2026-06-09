import React, { useState } from 'react';
import { Bot } from '../../store/appStore';
import { Plus, Play, Square, Trash2, ChevronRight, BarChart3 } from 'lucide-react';

interface BotListTableProps {
  bots: Bot[];
  activeBotsCount: number;
  winRate: string;
  totalTrades: number;
  prices: Record<string, any>;
  pairNames: Record<string, string>;
  onSelectBot: (id: string) => void;
  onStartBot: (id: string) => void;
  onStopBot: (id: string) => void;
  onDeleteBot: (id: string) => void;
  onNavigateToCreate: () => void;
}

export function BotListTable({
  bots,
  activeBotsCount,
  winRate,
  totalTrades,
  prices,
  pairNames,
  onSelectBot,
  onStartBot,
  onStopBot,
  onDeleteBot,
  onNavigateToCreate,
}: BotListTableProps) {
  const [tab, setTab] = useState<'running' | 'all'>('running');

  const calcUnrealizedPnl = (bot: Bot) => {
    return bot.positions.reduce((sum, pos) => {
      const cp = prices[pos.symbol]?.price || pos.entryPrice;
      return sum + (pos.type === 'sell' ? (pos.entryPrice - cp) * pos.quantity : (cp - pos.entryPrice) * pos.quantity);
    }, 0);
  };

  const filteredBots = tab === 'running' ? bots.filter(b => b.status === 'running') : bots;

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-card">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setTab('running')}
            className={`text-sm font-medium pb-1 border-b-2 transition-all ${
              tab === 'running'
                ? 'text-white border-primary'
                : 'text-muted border-transparent hover:text-white'
            }`}
          >
            Running ({activeBotsCount})
          </button>
          <button
            onClick={() => setTab('all')}
            className={`text-sm font-medium pb-1 border-b-2 transition-all ${
              tab === 'all'
                ? 'text-white border-primary'
                : 'text-muted border-transparent hover:text-white'
            }`}
          >
            All Bots ({bots.length})
          </button>
        </div>
        <div className="text-xs text-muted hidden sm:block">
          <span className="mr-4">
            Win Rate:{' '}
            <span className={parseFloat(winRate) >= 50 ? 'text-primary font-bold' : 'text-secondary font-bold'}>
              {winRate}%
            </span>
          </span>
          <span>Total Trades: {totalTrades}</span>
        </div>
      </div>

      {bots.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-border">
            <BarChart3 className="w-6 h-6 text-muted" />
          </div>
          <p className="text-white text-sm font-medium mb-1">No trading bots yet</p>
          <p className="text-muted text-xs mb-4">Create your first AI-powered trading bot to automate decisions</p>
          <button
            onClick={onNavigateToCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-black text-sm font-semibold hover:bg-primary-light transition-all"
          >
            <Plus className="w-4 h-4" /> Create Bot
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted border-b border-border">
                  <th className="text-left p-4 font-semibold uppercase tracking-wider">Bot</th>
                  <th className="text-left p-4 font-semibold uppercase tracking-wider">Status</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Allocated</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Realized PNL</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Unrealized PNL</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">ROI</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Positions</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBots.map(bot => {
                  const uPnl = calcUnrealizedPnl(bot);
                  const roi = bot.frozenAmount > 0 ? (bot.totalPnl / bot.frozenAmount) * 100 : 0;
                  return (
                    <tr
                      key={bot.id}
                      className="border-b border-border/50 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => onSelectBot(bot.id)}
                    >
                      <td className="p-4">
                        <div>
                          <p className="text-sm font-medium text-white">{bot.name}</p>
                          <p className="text-xs text-muted">
                            {bot.symbols.map(s => pairNames[s] || s.replace('USDT', '')).join(' / ')}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            bot.status === 'running' ? 'text-primary' : 'text-muted'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              bot.status === 'running' ? 'bg-primary animate-pulse' : 'bg-muted'
                            }`}
                          />
                          {bot.status === 'running' ? 'Running' : 'Stopped'}
                        </span>
                      </td>
                      <td className="p-4 text-right text-sm font-mono text-white">${bot.frozenAmount.toLocaleString()}</td>
                      <td className={`p-4 text-right text-sm font-mono ${bot.totalPnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                        {bot.totalPnl >= 0 ? '+' : ''}${bot.totalPnl.toFixed(2)}
                      </td>
                      <td className={`p-4 text-right text-sm font-mono ${uPnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                        {uPnl >= 0 ? '+' : ''}${uPnl.toFixed(2)}
                      </td>
                      <td className={`p-4 text-right text-sm font-mono ${roi >= 0 ? 'text-primary' : 'text-secondary'}`}>
                        {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                      </td>
                      <td className="p-4 text-right text-sm text-white font-mono">{bot.positions.length}</td>
                      <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {bot.status === 'running' ? (
                            <button
                              onClick={() => onStopBot(bot.id)}
                              className="p-1.5 rounded hover:bg-white/5 text-secondary transition-all"
                              title="Stop Bot Engine"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onStartBot(bot.id)}
                              className="p-1.5 rounded hover:bg-white/5 text-primary transition-all"
                              title="Start Bot Engine"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteBot(bot.id)}
                            className="p-1.5 rounded hover:bg-white/5 text-muted hover:text-secondary transition-all"
                            title="Delete Bot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-muted" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2.5 p-3">
            {filteredBots.map(bot => {
              const uPnl = calcUnrealizedPnl(bot);
              return (
                <div
                  key={bot.id}
                  className="bg-surface/50 border border-border rounded-xl p-4 transition-all"
                  onClick={() => onSelectBot(bot.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-white">{bot.name}</p>
                      <p className="text-xs text-muted">
                        {bot.symbols.map(s => pairNames[s] || s.replace('USDT', '')).join(' / ')}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3 text-muted">
                    <div>
                      <span>Status</span>
                      <p className={`font-semibold ${bot.status === 'running' ? 'text-primary' : 'text-muted'}`}>
                        {bot.status === 'running' ? 'Running' : 'Stopped'}
                      </p>
                    </div>
                    <div>
                      <span>Allocated</span>
                      <p className="text-white font-mono">${bot.frozenAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <span>Realized PNL</span>
                      <p className={`font-mono font-semibold ${bot.totalPnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                        {bot.totalPnl >= 0 ? '+' : ''}${bot.totalPnl.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span>Unrealized PNL</span>
                      <p className={`font-mono font-semibold ${uPnl >= 0 ? 'text-primary' : 'text-secondary'}`}>
                        {uPnl >= 0 ? '+' : ''}${uPnl.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    {bot.status === 'running' ? (
                      <button
                        onClick={() => onStopBot(bot.id)}
                        className="flex-1 py-2 rounded-lg bg-secondary/10 hover:bg-secondary/20 text-secondary text-xs font-semibold transition-all"
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartBot(bot.id)}
                        className="flex-1 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all"
                      >
                        Start
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteBot(bot.id)}
                      className="px-3.5 py-2 rounded-lg bg-white/5 text-muted hover:text-secondary border border-border/50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
