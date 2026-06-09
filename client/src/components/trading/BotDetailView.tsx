import React, { useState } from 'react';
import { Bot, Position } from '../../store/appStore';
import {
  ArrowLeft,
  Zap,
  Square,
  XCircle,
  Edit3,
  Trash2,
  Check,
  X,
  History,
  Terminal,
  PencilLine,
  Save,
  Play,
} from 'lucide-react';
import { PositionsTab } from './PositionsTab';
import { ClosedPositionsTab } from './ClosedPositionsTab';
import { LogTerminalTab } from './LogTerminalTab';

interface BotDetailViewProps {
  bot: Bot;
  prices: Record<string, any>;
  pairNames: Record<string, string>;
  allPairs: string[];
  logs: any[];
  walletBalance: number;
  onBack: () => void;
  onStartBot: (id: string) => void;
  onStopBot: (id: string) => void;
  onDeleteBot: (id: string) => void;
  onClosePosition: (botId: string, posId: string, cp: number) => void;
  onCloseAllPositions: (botId: string, prices: Record<string, number>) => void;
  onUpdatePositionSLTP: (botId: string, posId: string, sl?: number, tp?: number) => void;
  onUpdateBotSLTP: (botId: string, sl: number, tp: number) => void;
  onUpdateBot: (botId: string, changes: Partial<Bot>) => void;
}

export function BotDetailView({
  bot,
  prices,
  pairNames,
  allPairs,
  logs,
  walletBalance,
  onBack,
  onStartBot,
  onStopBot,
  onDeleteBot,
  onClosePosition,
  onCloseAllPositions,
  onUpdatePositionSLTP,
  onUpdateBotSLTP,
  onUpdateBot,
}: BotDetailViewProps) {
  const [detailTab, setDetailTab] = useState<'open' | 'history' | 'logs'>('open');
  const [isEditingBot, setIsEditingBot] = useState(false);
  const [editingBotSL, setEditingBotSL] = useState(false);
  const [editingBotTP, setEditingBotTP] = useState(false);

  // Edit bot config states
  const [editName, setEditName] = useState(bot.name);
  const [editPairs, setEditPairs] = useState<string[]>([...bot.symbols]);
  const [editAllocType, setEditAllocType] = useState<'percentage' | 'fixed'>(bot.allocationType);
  const [editAllocValue, setEditAllocValue] = useState(bot.allocationValue);
  const [editInterval, setEditInterval] = useState(bot.interval);

  // Local SL/TP inputs
  const [botSLEdit, setBotSLEdit] = useState(bot.stopLoss || 0);
  const [botTPEdit, setBotTPEdit] = useState(bot.takeProfit || 0);
  const [editSearchQuery, setEditSearchQuery] = useState('');

  const roi = bot.frozenAmount > 0 ? (bot.totalPnl / bot.frozenAmount) * 100 : 0;

  const calcUnrealizedPnl = () => {
    return bot.positions.reduce((sum, pos) => {
      const cp = prices[pos.symbol]?.price || pos.entryPrice;
      return sum + (pos.type === 'sell' ? (pos.entryPrice - cp) * pos.quantity : (cp - pos.entryPrice) * pos.quantity);
    }, 0);
  };

  const uPnl = calcUnrealizedPnl();

  const handleCloseAll = () => {
    const pm: Record<string, number> = {};
    bot.positions.forEach(pos => {
      pm[pos.symbol] = prices[pos.symbol]?.price || pos.entryPrice;
    });
    onCloseAllPositions(bot.id, pm);
  };

  const handleOpenEditModal = () => {
    setEditName(bot.name);
    setEditPairs([...bot.symbols]);
    setEditAllocType(bot.allocationType);
    setEditAllocValue(bot.allocationValue);
    setEditInterval(bot.interval);
    setIsEditingBot(true);
  };

  const handleSaveBotChanges = () => {
    onUpdateBot(bot.id, {
      name: editName,
      symbols: editPairs,
      allocationType: editAllocType,
      allocationValue: editAllocValue,
      interval: editInterval,
    });
    setIsEditingBot(false);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Bots
      </button>

      {/* Bot Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface p-4 border border-border rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">{bot.name}</h1>
            <p className="text-xs text-muted">
              {bot.symbols.map(s => pairNames[s] || s.replace('USDT', '/USDT')).join(' / ')}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
            bot.status === 'running'
              ? 'bg-primary/10 text-primary border border-primary/20 animate-pulse'
              : 'bg-white/5 text-muted border border-border'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${bot.status === 'running' ? 'bg-primary' : 'bg-muted'}`} />
          {bot.status === 'running' ? 'Running' : 'Stopped'}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Reserved Capital', val: `$${bot.frozenAmount.toLocaleString()}`, color: 'text-white' },
          {
            label: 'Realized PNL',
            val: `${bot.totalPnl >= 0 ? '+' : ''}$${bot.totalPnl.toFixed(2)}`,
            color: bot.totalPnl >= 0 ? 'text-primary' : 'text-secondary',
          },
          {
            label: 'Unrealized PNL',
            val: `${uPnl >= 0 ? '+' : ''}$${uPnl.toFixed(2)}`,
            color: uPnl >= 0 ? 'text-primary' : 'text-secondary',
          },
          {
            label: 'Current Bot ROI',
            val: `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`,
            color: roi >= 0 ? 'text-primary' : 'text-secondary',
          },
          { label: 'Monitored Positions', val: bot.positions.length.toString(), color: 'text-white' },
          {
            label: 'Bot Win Rate',
            val: `${
              bot.closedTrades > 0
                ? ((bot.winningTrades / bot.closedTrades) * 100).toFixed(1)
                : '0.0'
            }%`,
            color:
              bot.closedTrades > 0 && bot.winningTrades / bot.closedTrades >= 0.5
                ? 'text-primary'
                : 'text-secondary',
          },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4 shadow-card">
            <p className="text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">{s.label}</p>
            <p className={`text-base font-bold font-mono ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Control Actions */}
      <div className="flex flex-wrap gap-2.5">
        {bot.status === 'running' ? (
          <>
            <button
              onClick={() => onStopBot(bot.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 text-sm font-semibold transition-all"
            >
              <Square className="w-4 h-4" /> Stop Engine
            </button>
            {bot.positions.length > 0 && (
              <button
                onClick={handleCloseAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 text-sm font-semibold transition-all"
              >
                <XCircle className="w-4 h-4" /> Close Positions
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => onStartBot(bot.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-sm font-semibold transition-all"
          >
            <Play className="w-4 h-4" /> Start Engine
          </button>
        )}
        <button
          onClick={handleOpenEditModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 text-muted hover:text-white border border-border text-sm font-semibold transition-all"
        >
          <Edit3 className="w-4 h-4" /> Edit Bot
        </button>
        <button
          onClick={() => onDeleteBot(bot.id)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 text-muted hover:text-secondary border border-border text-sm font-semibold transition-all"
        >
          <Trash2 className="w-4 h-4" /> Delete Bot
        </button>
      </div>

      {/* Engine Error Indicator */}
      {bot.engineError && (
        <div className="bg-secondary/10 border border-secondary/20 rounded-xl px-4 py-3.5 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-secondary flex-shrink-0" />
          <p className="text-xs text-secondary font-medium flex-1">
            <span className="font-bold">Execution Error:</span> {bot.engineError}
          </p>
          <button
            onClick={() => onUpdateBot(bot.id, { engineError: undefined })}
            className="text-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Config Panel */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-card">
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-xs">Bot Config Limits</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-sm">
          <div>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1">Method Allocation</p>
            <p className="text-white font-mono font-medium">
              {bot.allocationType === 'percentage' ? `${bot.allocationValue}%` : `$${bot.allocationValue}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1">Debate Interval</p>
            <p className="text-white font-mono font-medium">{bot.interval} min</p>
          </div>
          <div>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1">Global Stop Loss</p>
            {editingBotSL ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={botSLEdit}
                  onChange={e => setBotSLEdit(parseFloat(e.target.value))}
                  className="w-16 bg-background border border-border rounded px-1.5 py-0.5 text-secondary font-mono text-xs focus:outline-none focus:border-primary"
                />
                <span className="text-secondary text-xs font-semibold">%</span>
                <button
                  onClick={() => {
                    onUpdateBotSLTP(bot.id, botSLEdit, bot.takeProfit || 0);
                    setEditingBotSL(false);
                  }}
                  className="text-primary hover:text-white"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    onUpdateBot(bot.id, { stopLoss: undefined });
                    setEditingBotSL(false);
                  }}
                  className="text-muted hover:text-white"
                  title="Remove SL"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {bot.stopLoss ? (
                  <>
                    <span className="text-secondary font-mono font-semibold">{bot.stopLoss}%</span>
                    <button
                      onClick={() => {
                        setBotSLEdit(bot.stopLoss!);
                        setEditingBotSL(true);
                        setEditingBotTP(false);
                      }}
                      className="text-muted hover:text-white"
                    >
                      <PencilLine className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-muted font-mono font-semibold">--</span>
                    <button
                      onClick={() => {
                        setBotSLEdit(2);
                        setEditingBotSL(true);
                        setEditingBotTP(false);
                      }}
                      className="text-muted hover:text-secondary"
                    >
                      <PencilLine className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1">Global Take Profit</p>
            {editingBotTP ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0.5"
                  max="100"
                  step="0.5"
                  value={botTPEdit}
                  onChange={e => setBotTPEdit(parseFloat(e.target.value))}
                  className="w-16 bg-background border border-border rounded px-1.5 py-0.5 text-primary font-mono text-xs focus:outline-none focus:border-primary"
                />
                <span className="text-primary text-xs font-semibold">%</span>
                <button
                  onClick={() => {
                    onUpdateBotSLTP(bot.id, bot.stopLoss || 0, botTPEdit);
                    setEditingBotTP(false);
                  }}
                  className="text-primary hover:text-white"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    onUpdateBot(bot.id, { takeProfit: undefined });
                    setEditingBotTP(false);
                  }}
                  className="text-muted hover:text-white"
                  title="Remove TP"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {bot.takeProfit ? (
                  <>
                    <span className="text-primary font-mono font-semibold">{bot.takeProfit}%</span>
                    <button
                      onClick={() => {
                        setBotTPEdit(bot.takeProfit!);
                        setEditingBotTP(true);
                        setEditingBotSL(false);
                      }}
                      className="text-muted hover:text-white"
                    >
                      <PencilLine className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-muted font-mono font-semibold">--</span>
                    <button
                      onClick={() => {
                        setBotTPEdit(5);
                        setEditingBotTP(true);
                        setEditingBotSL(false);
                      }}
                      className="text-muted hover:text-primary"
                    >
                      <PencilLine className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {bot.botProvider && (
          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 md:grid-cols-3 gap-5 text-sm">
            <div>
              <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1 font-mono">LLM Provider</p>
              <p className="text-white font-mono text-xs">{bot.botProvider.toUpperCase()}</p>
            </div>
            {bot.botQuickModel && (
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1 font-mono">Decision Model</p>
                <p className="text-white font-mono text-xs">{bot.botQuickModel}</p>
              </div>
            )}
            {bot.botDeepModel && (
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1 font-mono">Debate Model</p>
                <p className="text-white font-mono text-xs">{bot.botDeepModel}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDetailTab('open')}
              className={`text-sm font-semibold pb-1 border-b-2 transition-all ${
                detailTab === 'open'
                  ? 'text-white border-primary'
                  : 'text-muted border-transparent hover:text-white'
              }`}
            >
              Open Positions ({bot.positions.length})
            </button>
            <button
              onClick={() => setDetailTab('history')}
              className={`text-sm font-semibold pb-1 border-b-2 transition-all flex items-center gap-1.5 ${
                detailTab === 'history'
                  ? 'text-white border-primary'
                  : 'text-muted border-transparent hover:text-white'
              }`}
            >
              <History className="w-4 h-4" /> Position History ({bot.closedPositions.length})
            </button>
            <button
              onClick={() => setDetailTab('logs')}
              className={`text-sm font-semibold pb-1 border-b-2 transition-all flex items-center gap-1.5 ${
                detailTab === 'logs'
                  ? 'text-white border-primary'
                  : 'text-muted border-transparent hover:text-white'
              }`}
            >
              <Terminal className="w-4 h-4" /> Decision Logs ({logs.length})
            </button>
          </div>
        </div>

        {detailTab === 'open' && (
          <PositionsTab
            bot={bot}
            prices={prices}
            pairNames={pairNames}
            onClosePosition={(posId, cp) => onClosePosition(bot.id, posId, cp)}
            onCloseAllPositions={handleCloseAll}
            onUpdatePositionSLTP={(posId, sl, tp) => onUpdatePositionSLTP(bot.id, posId, sl, tp)}
          />
        )}
        {detailTab === 'history' && (
          <ClosedPositionsTab bot={bot} pairNames={pairNames} />
        )}
        {detailTab === 'logs' && (
          <LogTerminalTab bot={bot} logs={logs} />
        )}
      </div>

      {/* Edit Bot Config Modal Dialog */}
      {isEditingBot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in"
          onClick={() => setIsEditingBot(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-xs">Edit Bot Parameters</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted mb-1 block font-medium uppercase tracking-wider">Bot Instance Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-white text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-2 block font-medium uppercase tracking-wider">Trading Pairs</label>
                
                {/* Selected Tags */}
                {editPairs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5 p-2 bg-background/50 border border-border rounded-lg">
                    {editPairs.map(p => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 bg-primary/10 border border-primary/30 text-primary px-2.5 py-0.5 rounded text-xs font-semibold"
                      >
                        {pairNames[p] || p.replace('USDT', '')}
                        <button
                          type="button"
                          onClick={() => setEditPairs(editPairs.filter(x => x !== p))}
                          className="ml-1 text-muted hover:text-white font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search Input */}
                <input
                  type="text"
                  value={editSearchQuery}
                  onChange={e => setEditSearchQuery(e.target.value)}
                  placeholder="Filter pairs (e.g. BTC, ETH)..."
                  className="w-full mb-2 bg-background border border-border rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-primary"
                />

                {/* Suggestions */}
                <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                  {allPairs
                    .filter(p => p.toLowerCase().includes(editSearchQuery.toLowerCase()))
                    .slice(0, 15)
                    .map(p => {
                      const isSelected = editPairs.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            setEditPairs(prev =>
                              prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                            )
                          }
                          className={`px-2.5 py-1.5 rounded text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted hover:text-white'
                          }`}
                        >
                          {pairNames[p] || p.replace('USDT', '')}
                        </button>
                      );
                    })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block font-medium uppercase tracking-wider">Allocation Method</label>
                  <select
                    value={editAllocType}
                    onChange={e => setEditAllocType(e.target.value as any)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-white text-xs"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                  <input
                    type="number"
                    value={editAllocValue}
                    onChange={e => setEditAllocValue(parseInt(e.target.value))}
                    className="w-full mt-1.5 bg-background border border-border rounded px-2.5 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block font-medium uppercase tracking-wider">Interval (min)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={editInterval}
                    onChange={e => setEditInterval(parseInt(e.target.value))}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-white text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsEditingBot(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-all border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBotChanges}
                disabled={!editName || editPairs.length === 0}
                className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-light text-black text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
