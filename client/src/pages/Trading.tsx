import { useState, useEffect, useRef } from 'react';
import { useAppStore, Bot } from '../store/appStore';
import { fetchCryptoPrices, startBotEngine, stopBotEngine } from '../lib/api';
import { io } from 'socket.io-client';
import { Plus, Play, Square, XCircle, Trash2, ChevronRight, ArrowLeft, TrendingUp, TrendingDown, Settings2, Zap, BarChart3, Wallet, History, PencilLine, Check, X } from 'lucide-react';

const allPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
const PAIR_NAMES: Record<string, string> = { BTCUSDT: 'BTC', ETHUSDT: 'ETH', SOLUSDT: 'SOL', BNBUSDT: 'BNB', XRPUSDT: 'XRP', ADAUSDT: 'ADA', DOGEUSDT: 'DOGE' };

export default function Trading() {
  const { bots, walletBalance, createBot, deleteBot, startBot, stopBot, closePosition, closeAllPositions, addPosition, updatePositionSLTP, updateBotSLTP } = useAppStore();
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [tab, setTab] = useState<'running' | 'history'>('running');
  const [detailTab, setDetailTab] = useState<'open' | 'history'>('open');
  const [editingPosSLTP, setEditingPosSLTP] = useState<string | null>(null);
  const [editSL, setEditSL] = useState('');
  const [editTP, setEditTP] = useState('');
  const [editingBotSL, setEditingBotSL] = useState(false);
  const [editingBotTP, setEditingBotTP] = useState(false);
  const [botSLEdit, setBotSLEdit] = useState(0);
  const [botTPEdit, setBotTPEdit] = useState(0);
  // Create form state
  const [formName, setFormName] = useState('');
  const [formSymbols, setFormSymbols] = useState<string[]>(['BTCUSDT']);
  const [formAllocType, setFormAllocType] = useState<'percentage' | 'fixed'>('percentage');
  const [formAllocValue, setFormAllocValue] = useState(10);
  const [formSL, setFormSL] = useState(2);
  const [formTP, setFormTP] = useState(5);
  const [formSLEnabled, setFormSLEnabled] = useState(false);
  const [formTPEnabled, setFormTPEnabled] = useState(false);

  const socketRef = useRef<any>(null);

  useEffect(() => {
    loadPrices();
    const interval = setInterval(loadPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  // Socket.IO for AI engine signals
  useEffect(() => {
    const socket = io({ path: '/api/socket.io' });
    socketRef.current = socket;

    bots.forEach(bot => {
      if (bot.status === 'running') {
        socket.on(`bot:${bot.id}:trade`, (signal: any) => {
          if (signal.action === 'buy' && signal.price) {
            addPosition(bot.id, {
              symbol: signal.symbol, type: 'buy',
              quantity: 0.001, entryPrice: signal.price,
            });
          } else if (signal.action === 'sell') {
            const pos = bot.positions.find(p => p.symbol === signal.symbol);
            if (pos) closePosition(bot.id, pos.id, signal.price || signal.price);
          }
        });
        socket.on(`bot:${bot.id}:status`, (status: any) => {
          console.log(`[Bot ${bot.id}] AI engine status:`, status);
        });
      }
    });

    return () => { socket.disconnect(); };
  }, [bots.length]);

  const loadPrices = async () => {
    try {
      const data = await fetchCryptoPrices(allPairs);
      const map: Record<string, any> = {};
      data.forEach((d: any) => { map[d.symbol] = d; });
      setPrices(map);
    } catch {}
  };

  const selectedBot = bots.find(b => b.id === selectedBotId) || null;

  const totalInvested = bots.reduce((s, b) => s + b.frozenAmount, 0);
  const totalPnl = bots.reduce((s, b) => s + b.totalPnl, 0);
  const activeBots = bots.filter(b => b.status === 'running').length;
  const totalTrades = bots.reduce((s, b) => s + b.closedTrades, 0);

  const winRate = totalTrades > 0 ? ((bots.reduce((s, b) => s + b.winningTrades, 0) / totalTrades) * 100).toFixed(1) : '0.0';

  const formatPrice = (p: number) => p > 1 ? p.toFixed(2) : p.toFixed(6);
  const calcFrozen = (type: 'percentage' | 'fixed', val: number) => type === 'percentage' ? Math.round(walletBalance * (val / 100)) : Math.min(val, walletBalance);

  const handleCreate = () => {
    if (!formName || formSymbols.length === 0) return;
    createBot({
      name: formName, symbols: formSymbols, allocationType: formAllocType, allocationValue: formAllocValue,
      ...(formSLEnabled ? { stopLoss: formSL } : {}),
      ...(formTPEnabled ? { takeProfit: formTP } : {}),
    });
    setFormName('');
    setView('list');
  };

  const handleDeleteBot = (id: string) => { if (confirm('Delete this bot?')) deleteBot(id); };

  // --- Bot List View ---
  if (view === 'list') {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Trading Bots</h1>
          <button onClick={() => { setFormName(''); setFormSymbols(['BTCUSDT']); setFormAllocType('percentage'); setFormAllocValue(10); setFormSL(2); setFormTP(5); setFormSLEnabled(false); setFormTPEnabled(false); setView('create'); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F0B90B] text-black text-sm font-semibold hover:bg-[#F0B90B]/90 transition-all">
            <Plus className="w-4 h-4" /> Create Bot
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Balance', val: `$${walletBalance.toLocaleString()}`, color: 'text-white' },
            { label: 'Active Bots', val: `${activeBots}/${bots.length}`, color: 'text-[#0ECB81]' },
            { label: 'Total Invested', val: `$${totalInvested.toLocaleString()}`, color: 'text-white' },
            { label: 'Total P&L', val: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]' },
          ].map(s => (
            <div key={s.label} className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-4">
              <p className="text-xs text-[#848E9C] mb-1">{s.label}</p>
              <p className={`text-lg font-bold font-mono ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Bot List Table */}
        <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#2B3139] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setTab('running')} className={`text-sm font-medium pb-1 border-b-2 transition-all ${tab === 'running' ? 'text-white border-[#F0B90B]' : 'text-[#848E9C] border-transparent hover:text-white'}`}>Running ({activeBots})</button>
              <button onClick={() => setTab('history')} className={`text-sm font-medium pb-1 border-b-2 transition-all ${tab === 'history' ? 'text-white border-[#F0B90B]' : 'text-[#848E9C] border-transparent hover:text-white'}`}>History ({bots.length - activeBots})</button>
            </div>
            <div className="text-xs text-[#848E9C] hidden sm:block">
              <span className="mr-4">Win Rate: <span className={parseFloat(winRate) >= 50 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>{winRate}%</span></span>
              <span>Total Trades: {totalTrades}</span>
            </div>
          </div>

          {bots.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-[#2B3139] flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-6 h-6 text-[#848E9C]" />
              </div>
              <p className="text-[#848E9C] text-sm mb-1">No trading bots yet</p>
              <p className="text-[#848E9C] text-xs mb-4">Create your first AI-powered trading bot</p>
              <button onClick={() => setView('create')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F0B90B] text-black text-sm font-semibold hover:bg-[#F0B90B]/90">
                <Plus className="w-4 h-4" /> Create Bot
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-[#848E9C] border-b border-[#2B3139]">
                      <th className="text-left p-4 font-medium">Bot</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-right p-4 font-medium">Allocated</th>
                      <th className="text-right p-4 font-medium">PNL</th>
                      <th className="text-right p-4 font-medium">ROI</th>
                      <th className="text-right p-4 font-medium">Positions</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tab === 'running' ? bots.filter(b => b.status === 'running') : bots).map(bot => {
                      const roi = bot.frozenAmount > 0 ? ((bot.totalPnl / bot.frozenAmount) * 100) : 0;
                      return (
                        <tr key={bot.id} className="border-b border-[#2B3139] hover:bg-[#2B3139]/50 transition-colors cursor-pointer" onClick={() => { setSelectedBotId(bot.id); setView('detail'); }}>
                          <td className="p-4">
                            <div>
                              <p className="text-sm font-medium text-white">{bot.name}</p>
                              <p className="text-xs text-[#848E9C]">{bot.symbols.map(s => PAIR_NAMES[s] || s.replace('USDT', '')).join(' / ')}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs ${bot.status === 'running' ? 'text-[#0ECB81]' : 'text-[#848E9C]'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'running' ? 'bg-[#0ECB81]' : 'bg-[#848E9C]'}`} />
                              {bot.status === 'running' ? 'Running' : 'Stopped'}
                            </span>
                          </td>
                          <td className="p-4 text-right text-sm font-mono text-white">${bot.frozenAmount.toLocaleString()}</td>
                          <td className={`p-4 text-right text-sm font-mono ${bot.totalPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                            {bot.totalPnl >= 0 ? '+' : ''}${bot.totalPnl.toFixed(2)}
                          </td>
                          <td className={`p-4 text-right text-sm font-mono ${roi >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                            {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                          </td>
                          <td className="p-4 text-right text-sm text-white font-mono">{bot.positions.length}</td>
                          <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {bot.status === 'running' ? (
                                <button onClick={() => { stopBot(bot.id); stopBotEngine(bot.id); }} className="p-1.5 rounded hover:bg-[#2B3139] text-[#F6465D]"><Square className="w-3.5 h-3.5" /></button>
                              ) : (
                                <button onClick={() => { startBot(bot.id); startBotEngine(bot.id, bot.symbols, bot.stopLoss, bot.takeProfit); }} className="p-1.5 rounded hover:bg-[#2B3139] text-[#0ECB81]"><Play className="w-3.5 h-3.5" /></button>
                              )}
                              <button onClick={() => handleDeleteBot(bot.id)} className="p-1.5 rounded hover:bg-[#2B3139] text-[#848E9C]"><Trash2 className="w-3.5 h-3.5" /></button>
                              <ChevronRight className="w-4 h-4 text-[#848E9C]" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-2 p-3">
                {(tab === 'running' ? bots.filter(b => b.status === 'running') : bots).map(bot => {
                  const roi = bot.frozenAmount > 0 ? ((bot.totalPnl / bot.frozenAmount) * 100) : 0;
                  return (
                    <div key={bot.id} className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-4" onClick={() => { setSelectedBotId(bot.id); setView('detail'); }}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium text-white">{bot.name}</p>
                          <p className="text-xs text-[#848E9C]">{bot.symbols.map(s => PAIR_NAMES[s] || s.replace('USDT', '')).join(' / ')}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#848E9C]" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={`inline-flex items-center gap-1 ${bot.status === 'running' ? 'text-[#0ECB81]' : 'text-[#848E9C]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'running' ? 'bg-[#0ECB81]' : 'bg-[#848E9C]'}`} />{bot.status === 'running' ? 'Running' : 'Stopped'}
                        </span>
                        <span className="text-[#848E9C]">${bot.frozenAmount.toLocaleString()}</span>
                        <span className={bot.totalPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}>{bot.totalPnl >= 0 ? '+' : ''}${bot.totalPnl.toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                        {bot.status === 'running' ? (
                          <button onClick={() => { stopBot(bot.id); stopBotEngine(bot.id); }} className="flex-1 py-2 rounded bg-[#F6465D]/10 text-[#F6465D] text-xs font-medium">Stop</button>
                        ) : (
                          <button onClick={() => { startBot(bot.id); startBotEngine(bot.id, bot.symbols, bot.stopLoss, bot.takeProfit); }} className="flex-1 py-2 rounded bg-[#0ECB81]/10 text-[#0ECB81] text-xs font-medium">Start</button>
                        )}
                        <button onClick={() => handleDeleteBot(bot.id)} className="px-3 py-2 rounded bg-[#2B3139] text-[#848E9C] text-xs"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {bots.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-3">
              <p className="text-xs text-[#848E9C]">Win Rate</p>
              <p className={`text-sm font-bold font-mono ${parseFloat(winRate) >= 50 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>{winRate}%</p>
            </div>
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-3">
              <p className="text-xs text-[#848E9C]">Total Trades</p>
              <p className="text-sm font-bold font-mono text-white">{totalTrades}</p>
            </div>
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-3">
              <p className="text-xs text-[#848E9C]">Active</p>
              <p className="text-sm font-bold font-mono text-[#0ECB81]">{activeBots}</p>
            </div>
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-3">
              <p className="text-xs text-[#848E9C]">ROI</p>
              <p className={`text-sm font-bold font-mono ${totalPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>{totalPnl >= 0 ? '+' : ''}{(totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0).toFixed(2)}%</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Create Bot View ---
  if (view === 'create') {
    const frozen = calcFrozen(formAllocType, formAllocValue);
    return (
      <div className="space-y-4 animate-fade-in max-w-5xl mx-auto">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-[#848E9C] hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Bots
        </button>
        <h1 className="text-xl font-bold text-white">Create AI Trading Bot</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: Configuration */}
          <div className="lg:col-span-3 bg-[#1E2329] border border-[#2B3139] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[#F0B90B]" /> Configuration
            </h2>

            <div className="mb-5">
              <label className="block text-xs text-[#848E9C] mb-1.5">Bot Name</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#F0B90B] transition-colors"
                placeholder="e.g. BTC Momentum Bot" />
            </div>

            <div className="mb-5">
              <label className="block text-xs text-[#848E9C] mb-1.5">Trading Pairs</label>
              <div className="flex flex-wrap gap-1.5">
                {allPairs.map(s => {
                  const sel = formSymbols.includes(s);
                  return (
                    <button key={s} onClick={() => setFormSymbols(sel ? formSymbols.filter(x => x !== s) : [...formSymbols, s])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${sel ? 'border-[#F0B90B] bg-[#F0B90B]/10 text-[#F0B90B]' : 'border-[#2B3139] text-[#848E9C] hover:text-white hover:border-[#848E9C]'}`}>
                      {PAIR_NAMES[s] || s.replace('USDT', '')}
                    </button>
                  );
                })}
              </div>
              {formSymbols.length === 0 && <p className="text-xs text-[#F6465D] mt-1.5">Select at least one pair</p>}
            </div>

            <div className="mb-5">
              <label className="block text-xs text-[#848E9C] mb-1.5">Allocation Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setFormAllocType('percentage')}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${formAllocType === 'percentage' ? 'border-[#F0B90B] bg-[#F0B90B]/10 text-[#F0B90B]' : 'border-[#2B3139] text-[#848E9C] hover:text-white'}`}>
                  % of Wallet
                </button>
                <button onClick={() => setFormAllocType('fixed')}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${formAllocType === 'fixed' ? 'border-[#F0B90B] bg-[#F0B90B]/10 text-[#F0B90B]' : 'border-[#2B3139] text-[#848E9C] hover:text-white'}`}>
                  Fixed Amount
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs text-[#848E9C] mb-1.5">
                {formAllocType === 'percentage' ? `Allocation: ${formAllocValue}%` : `Amount: $${formAllocValue}`}
              </label>
              <input type="range" min={formAllocType === 'percentage' ? 1 : 10} max={formAllocType === 'percentage' ? 100 : walletBalance}
                value={formAllocValue} onChange={e => setFormAllocValue(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[#2B3139] rounded-lg appearance-none cursor-pointer accent-[#F0B90B]" />
              <div className="flex justify-between text-xs text-[#848E9C] mt-1">
                <span>{formAllocType === 'percentage' ? '1%' : '$10'}</span>
                <span className="text-[#F0B90B]">${frozen.toLocaleString()} will be frozen</span>
                <span>{formAllocType === 'percentage' ? '100%' : `$${walletBalance}`}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-[#848E9C]">Stop Loss</label>
                  <button onClick={() => setFormSLEnabled(!formSLEnabled)}
                    className={`text-xs px-2 py-0.5 rounded transition-all ${formSLEnabled ? 'bg-[#F6465D]/10 text-[#F6465D]' : 'bg-[#2B3139] text-[#848E9C]'}`}>
                    {formSLEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {formSLEnabled && (
                  <div className="flex items-center gap-2">
                    <input type="range" min="0.5" max="10" step="0.5" value={formSL} onChange={e => setFormSL(parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-[#2B3139] rounded-lg appearance-none cursor-pointer accent-[#F6465D]" />
                    <span className="text-xs text-[#F6465D] font-mono w-10 text-right">{formSL}%</span>
                  </div>
                )}
                {!formSLEnabled && <p className="text-xs text-[#848E9C] mt-1">Not set</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-[#848E9C]">Take Profit</label>
                  <button onClick={() => setFormTPEnabled(!formTPEnabled)}
                    className={`text-xs px-2 py-0.5 rounded transition-all ${formTPEnabled ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#2B3139] text-[#848E9C]'}`}>
                    {formTPEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {formTPEnabled && (
                  <div className="flex items-center gap-2">
                    <input type="range" min="0.5" max="50" step="0.5" value={formTP} onChange={e => setFormTP(parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-[#2B3139] rounded-lg appearance-none cursor-pointer accent-[#0ECB81]" />
                    <span className="text-xs text-[#0ECB81] font-mono w-10 text-right">{formTP}%</span>
                  </div>
                )}
                {!formTPEnabled && <p className="text-xs text-[#848E9C] mt-1">Not set</p>}
              </div>
            </div>

            <button onClick={handleCreate} disabled={!formName || formSymbols.length === 0 || frozen <= 0}
              className="w-full py-3 rounded-lg bg-[#F0B90B] text-black text-sm font-semibold hover:bg-[#F0B90B]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" /> Create Bot
            </button>
          </div>

          {/* Right: Summary Panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Allocation Preview</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#848E9C]">Wallet Balance</span>
                  <span className="text-white font-mono">${walletBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#848E9C]">Bot Allocation</span>
                  <span className="text-[#F0B90B] font-mono">- ${frozen.toLocaleString()}</span>
                </div>
                <div className="pt-3 border-t border-[#2B3139] flex justify-between text-sm">
                  <span className="text-[#848E9C]">Remaining</span>
                  <span className="text-white font-mono font-semibold">${(walletBalance - frozen).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Risk Settings</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#848E9C]">Stop Loss</span>
                  <span className="text-[#F6465D] font-mono">{formSLEnabled ? `${formSL}%` : '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848E9C]">Take Profit</span>
                  <span className="text-[#0ECB81] font-mono">{formTPEnabled ? `${formTP}%` : '--'}</span>
                </div>
                {formSLEnabled && formTPEnabled && (
                <div className="flex justify-between">
                  <span className="text-[#848E9C]">Risk/Reward</span>
                  <span className="text-white font-mono">1:{(formTP / formSL).toFixed(1)}</span>
                </div>
                )}
              </div>
            </div>

            <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Selected Pairs</h3>
              {formSymbols.length === 0 ? (
                <p className="text-xs text-[#848E9C]">No pairs selected</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {formSymbols.map(s => {
                    const p = prices[s];
                    return (
                      <div key={s} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0B0E11] border border-[#2B3139]">
                        <span className="text-sm font-medium text-white">{PAIR_NAMES[s]}</span>
                        {p && <span className="text-xs font-mono text-[#848E9C]">${formatPrice(p.price)}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Bot Detail View ---
  const bot = selectedBot;
  if (!bot) return null;

  const roi = bot.frozenAmount > 0 ? ((bot.totalPnl / bot.frozenAmount) * 100) : 0;

  const handleSavePositionSLTP = (posId: string) => {
    const sl = editSL ? parseFloat(editSL) : undefined;
    const tp = editTP ? parseFloat(editTP) : undefined;
    updatePositionSLTP(bot.id, posId, sl, tp);
    setEditingPosSLTP(null);
    setEditSL('');
    setEditTP('');
  };

  const handleStartEditSLTP = (pos: { id: string; stopLoss?: number; takeProfit?: number }) => {
    setEditingPosSLTP(pos.id);
    setEditSL(pos.stopLoss?.toString() || '');
    setEditTP(pos.takeProfit?.toString() || '');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={() => { setView('list'); setEditingBotSL(false); setEditingBotTP(false); }} className="flex items-center gap-1.5 text-sm text-[#848E9C] hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Bots
      </button>

      {/* Bot Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#F0B90B]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{bot.name}</h1>
            <p className="text-xs text-[#848E9C]">{bot.symbols.map(s => PAIR_NAMES[s] || s.replace('USDT', '')).join(' / ')}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-sm ${bot.status === 'running' ? 'text-[#0ECB81]' : 'text-[#848E9C]'}`}>
          <span className={`w-2 h-2 rounded-full ${bot.status === 'running' ? 'bg-[#0ECB81] animate-pulse' : 'bg-[#848E9C]'}`} />
          {bot.status === 'running' ? 'Running' : 'Stopped'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-4">
          <p className="text-xs text-[#848E9C] mb-1">Allocated</p>
          <p className="text-lg font-bold font-mono text-white">${bot.frozenAmount.toLocaleString()}</p>
        </div>
        <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-4">
          <p className="text-xs text-[#848E9C] mb-1">PNL</p>
          <p className={`text-lg font-bold font-mono ${bot.totalPnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
            {bot.totalPnl >= 0 ? '+' : ''}${bot.totalPnl.toFixed(2)}
          </p>
        </div>
        <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-4">
          <p className="text-xs text-[#848E9C] mb-1">ROI</p>
          <p className={`text-lg font-bold font-mono ${roi >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
            {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
          </p>
        </div>
        <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-4">
          <p className="text-xs text-[#848E9C] mb-1">Positions</p>
          <p className="text-lg font-bold font-mono text-white">{bot.positions.length}</p>
        </div>
        <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-4">
          <p className="text-xs text-[#848E9C] mb-1">Win Rate</p>
          <p className={`text-lg font-bold font-mono ${bot.closedTrades > 0 && (bot.winningTrades / bot.closedTrades) >= 0.5 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
            {bot.closedTrades > 0 ? ((bot.winningTrades / bot.closedTrades) * 100).toFixed(1) : '0.0'}%
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {bot.status === 'running' ? (
          <>
            <button onClick={() => { stopBot(bot.id); stopBotEngine(bot.id); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F6465D]/10 text-[#F6465D] text-sm font-medium hover:bg-[#F6465D]/20 transition-all">
              <Square className="w-4 h-4" /> Stop Bot
            </button>
            {bot.positions.length > 0 && (
              <button onClick={() => { const pm: Record<string, number> = {}; bot.positions.forEach(p => { pm[p.symbol] = prices[p.symbol]?.price || p.entryPrice; }); closeAllPositions(bot.id, pm); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F6465D]/10 text-[#F6465D] text-sm font-medium hover:bg-[#F6465D]/20 transition-all">
                <XCircle className="w-4 h-4" /> Close All Positions
              </button>
            )}
          </>
        ) : (
          <button onClick={() => { startBot(bot.id); startBotEngine(bot.id, bot.symbols, bot.stopLoss, bot.takeProfit); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0ECB81]/10 text-[#0ECB81] text-sm font-medium hover:bg-[#0ECB81]/20 transition-all">
            <Play className="w-4 h-4" /> Start Bot
          </button>
        )}
        <button onClick={() => handleDeleteBot(bot.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2B3139] text-[#848E9C] text-sm font-medium hover:text-[#F6465D] transition-all">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>

      {/* Editable Bot Config */}
      <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Bot Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-xs text-[#848E9C]">Allocation</p>
            <p className="text-white font-mono">{bot.allocationType === 'percentage' ? `${bot.allocationValue}%` : `$${bot.allocationValue}`}</p>
          </div>
          <div>
            <p className="text-xs text-[#848E9C]">Stop Loss</p>
            {editingBotSL ? (
              <div className="flex items-center gap-1">
                <input type="number" min="0.5" max="50" step="0.5" value={botSLEdit} onChange={e => setBotSLEdit(parseFloat(e.target.value))}
                  className="w-16 bg-[#0B0E11] border border-[#2B3139] rounded px-1.5 py-0.5 text-[#F6465D] font-mono text-xs focus:outline-none focus:border-[#F0B90B]" />
                <span className="text-[#F6465D] text-xs">%</span>
                <button onClick={() => { updateBotSLTP(bot.id, botSLEdit, bot.takeProfit); setEditingBotSL(false); }} className="text-[#0ECB81] hover:text-white"><Check className="w-3 h-3" /></button>
                <button onClick={() => { updateBotSLTP(bot.id, undefined, bot.takeProfit); setEditingBotSL(false); }} className="text-[#848E9C] hover:text-white" title="Remove SL"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {bot.stopLoss ? (
                  <><span className="text-[#F6465D] font-mono">{bot.stopLoss}%</span><button onClick={() => { setBotSLEdit(bot.stopLoss!); setEditingBotSL(true); setEditingBotTP(false); }} className="text-[#848E9C] hover:text-white"><PencilLine className="w-3 h-3" /></button></>
                ) : (
                  <><span className="text-[#848E9C] font-mono">--</span><button onClick={() => { setBotSLEdit(2); setEditingBotSL(true); setEditingBotTP(false); }} className="text-[#848E9C] hover:text-[#F6465D]"><PencilLine className="w-3 h-3" /></button></>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-[#848E9C]">Take Profit</p>
            {editingBotTP ? (
              <div className="flex items-center gap-1">
                <input type="number" min="0.5" max="100" step="0.5" value={botTPEdit} onChange={e => setBotTPEdit(parseFloat(e.target.value))}
                  className="w-16 bg-[#0B0E11] border border-[#2B3139] rounded px-1.5 py-0.5 text-[#0ECB81] font-mono text-xs focus:outline-none focus:border-[#F0B90B]" />
                <span className="text-[#0ECB81] text-xs">%</span>
                <button onClick={() => { updateBotSLTP(bot.id, bot.stopLoss, botTPEdit); setEditingBotTP(false); }} className="text-[#0ECB81] hover:text-white"><Check className="w-3 h-3" /></button>
                <button onClick={() => { updateBotSLTP(bot.id, bot.stopLoss, undefined); setEditingBotTP(false); }} className="text-[#848E9C] hover:text-white" title="Remove TP"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {bot.takeProfit ? (
                  <><span className="text-[#0ECB81] font-mono">{bot.takeProfit}%</span><button onClick={() => { setBotTPEdit(bot.takeProfit!); setEditingBotTP(true); setEditingBotSL(false); }} className="text-[#848E9C] hover:text-white"><PencilLine className="w-3 h-3" /></button></>
                ) : (
                  <><span className="text-[#848E9C] font-mono">--</span><button onClick={() => { setBotTPEdit(5); setEditingBotTP(true); setEditingBotSL(false); }} className="text-[#848E9C] hover:text-[#0ECB81]"><PencilLine className="w-3 h-3" /></button></>
                )}
              </div>
            )}
          </div>
          {bot.stopLoss && bot.takeProfit && (
          <div>
            <p className="text-xs text-[#848E9C]">Risk/Reward</p>
            <p className="text-white font-mono">1:{(bot.takeProfit / bot.stopLoss).toFixed(1)}</p>
          </div>
          )}
          <div>
            <p className="text-xs text-[#848E9C]">Created</p>
            <p className="text-white font-mono text-xs">{new Date(bot.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Tabs: Open Positions | Position History */}
      <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg overflow-hidden">
        <div className="p-4 border-b border-[#2B3139] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setDetailTab('open')} className={`text-sm font-medium pb-1 border-b-2 transition-all ${detailTab === 'open' ? 'text-white border-[#F0B90B]' : 'text-[#848E9C] border-transparent hover:text-white'}`}>
              Open Positions ({bot.positions.length})
            </button>
            <button onClick={() => setDetailTab('history')} className={`text-sm font-medium pb-1 border-b-2 transition-all ${detailTab === 'history' ? 'text-white border-[#F0B90B]' : 'text-[#848E9C] border-transparent hover:text-white'}`}>
              <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Position History ({bot.closedPositions.length})</span>
            </button>
          </div>
          {detailTab === 'open' && bot.positions.length > 0 && (
            <button onClick={() => { const pm: Record<string, number> = {}; bot.positions.forEach(p => { pm[p.symbol] = prices[p.symbol]?.price || p.entryPrice; }); closeAllPositions(bot.id, pm); }}
              className="text-xs px-3 py-1.5 rounded bg-[#F6465D]/10 text-[#F6465D] hover:bg-[#F6465D]/20 transition-all">
              Close All
            </button>
          )}
        </div>

        {detailTab === 'open' ? (
          <>
            {bot.positions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#2B3139] flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="w-5 h-5 text-[#848E9C]" />
                </div>
                <p className="text-sm text-[#848E9C]">No open positions</p>
                <p className="text-xs text-[#848E9C] mt-1">Start the bot and wait for signals</p>
              </div>
            ) : (
              <>
                {/* Desktop Open Positions Table */}
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-[#848E9C] border-b border-[#2B3139]">
                        <th className="text-left p-4 font-medium">Pair</th>
                        <th className="text-left p-4 font-medium">Type</th>
                        <th className="text-right p-4 font-medium">Quantity</th>
                        <th className="text-right p-4 font-medium">Entry Price</th>
                        <th className="text-right p-4 font-medium">Mark Price</th>
                        <th className="text-right p-4 font-medium">SL</th>
                        <th className="text-right p-4 font-medium">TP</th>
                        <th className="text-right p-4 font-medium">PNL</th>
                        <th className="text-right p-4 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bot.positions.map(pos => {
                        const cp = prices[pos.symbol]?.price || pos.entryPrice;
                        const pnl = pos.type === 'sell' ? (pos.entryPrice - cp) * pos.quantity : (cp - pos.entryPrice) * pos.quantity;
                        const pnlPct = ((cp - pos.entryPrice) / pos.entryPrice) * 100 * (pos.type === 'sell' ? -1 : 1);
                        const editing = editingPosSLTP === pos.id;
                        return (
                          <tr key={pos.id} className="border-b border-[#2B3139] hover:bg-[#2B3139]/50">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">{PAIR_NAMES[pos.symbol] || pos.symbol.replace('USDT', '')}</span>
                                <span className="text-xs text-[#848E9C]">/USDT</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${pos.type === 'buy' ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#F6465D]/10 text-[#F6465D]'}`}>
                                {pos.type === 'buy' ? 'BUY' : 'SELL'}
                              </span>
                            </td>
                            <td className="p-4 text-right text-sm font-mono text-white">{pos.quantity}</td>
                            <td className="p-4 text-right text-sm font-mono text-white">${pos.entryPrice.toFixed(2)}</td>
                            <td className="p-4 text-right text-sm font-mono text-white">${cp.toFixed(2)}</td>
                            <td className="p-4 text-right">
                              {editing ? (
                                <div className="flex items-center justify-end gap-0.5">
                                  <input type="number" value={editSL} onChange={e => setEditSL(e.target.value)} placeholder="--"
                                    className="w-14 bg-[#0B0E11] border border-[#2B3139] rounded px-1 py-0.5 text-[#F6465D] font-mono text-xs text-right focus:outline-none focus:border-[#F0B90B]" />
                                  <span className="text-[#F6465D] text-xs">%</span>
                                  <button onClick={() => handleSavePositionSLTP(pos.id)} className="text-[#0ECB81] hover:text-white ml-0.5"><Check className="w-3 h-3" /></button>
                                  <button onClick={() => setEditingPosSLTP(null)} className="text-[#848E9C] hover:text-white"><X className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <button onClick={() => handleStartEditSLTP(pos)} className="text-xs font-mono text-[#848E9C] hover:text-white transition-colors">
                                  {pos.stopLoss ? <span className="text-[#F6465D]">{pos.stopLoss}%</span> : <span>--</span>}
                                </button>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {editing ? (
                                <div className="flex items-center justify-end gap-0.5">
                                  <input type="number" value={editTP} onChange={e => setEditTP(e.target.value)} placeholder="--"
                                    className="w-14 bg-[#0B0E11] border border-[#2B3139] rounded px-1 py-0.5 text-[#0ECB81] font-mono text-xs text-right focus:outline-none focus:border-[#F0B90B]" />
                                  <span className="text-[#0ECB81] text-xs">%</span>
                                </div>
                              ) : (
                                <button onClick={() => handleStartEditSLTP(pos)} className="text-xs font-mono text-[#848E9C] hover:text-white transition-colors">
                                  {pos.takeProfit ? <span className="text-[#0ECB81]">{pos.takeProfit}%</span> : <span>--</span>}
                                </button>
                              )}
                            </td>
                            <td className={`p-4 text-right text-sm font-mono ${pnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                              <span className="text-xs ml-1">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
                            </td>
                            <td className="p-4 text-right">
                              <button onClick={() => closePosition(bot.id, pos.id, cp)}
                                className="text-xs px-3 py-1.5 rounded bg-[#F6465D]/10 text-[#F6465D] hover:bg-[#F6465D]/20 transition-all">
                                Close
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Open Position Cards */}
                <div className="md:hidden space-y-2 p-3">
                  {bot.positions.map(pos => {
                    const cp = prices[pos.symbol]?.price || pos.entryPrice;
                    const pnl = pos.type === 'sell' ? (pos.entryPrice - cp) * pos.quantity : (cp - pos.entryPrice) * pos.quantity;
                    const pnlPct = ((cp - pos.entryPrice) / pos.entryPrice) * 100 * (pos.type === 'sell' ? -1 : 1);
                    return (
                      <div key={pos.id} className="bg-[#0B0E11] border border-[#2B3139] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{PAIR_NAMES[pos.symbol] || pos.symbol.replace('USDT', '')}/USDT</span>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${pos.type === 'buy' ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#F6465D]/10 text-[#F6465D]'}`}>
                              {pos.type === 'buy' ? 'BUY' : 'SELL'}
                            </span>
                          </div>
                          <button onClick={() => closePosition(bot.id, pos.id, cp)} className="text-xs px-2.5 py-1 rounded bg-[#F6465D]/10 text-[#F6465D]">Close</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                          <div><span className="text-[#848E9C]">Qty</span><p className="text-white font-mono">{pos.quantity}</p></div>
                          <div><span className="text-[#848E9C]">Entry</span><p className="text-white font-mono">${pos.entryPrice.toFixed(2)}</p></div>
                          <div><span className="text-[#848E9C]">Mark</span><p className="text-white font-mono">${cp.toFixed(2)}</p></div>
                          <div><span className="text-[#848E9C]">PNL</span><p className={`font-mono ${pnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</p></div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <div>
                            <span className="text-[#848E9C] mr-1">SL</span>
                            {pos.stopLoss ? <span className="text-[#F6465D] font-mono">{pos.stopLoss}%</span> : <span className="text-[#848E9C]">--</span>}
                          </div>
                          <div>
                            <span className="text-[#848E9C] mr-1">TP</span>
                            {pos.takeProfit ? <span className="text-[#0ECB81] font-mono">{pos.takeProfit}%</span> : <span className="text-[#848E9C]">--</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {bot.closedPositions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#2B3139] flex items-center justify-center mx-auto mb-3">
                  <History className="w-5 h-5 text-[#848E9C]" />
                </div>
                <p className="text-sm text-[#848E9C]">No trading history</p>
                <p className="text-xs text-[#848E9C] mt-1">Closed positions will appear here</p>
              </div>
            ) : (
              <>
                {/* Desktop Position History Table */}
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-[#848E9C] border-b border-[#2B3139]">
                        <th className="text-left p-4 font-medium">Time</th>
                        <th className="text-left p-4 font-medium">Pair</th>
                        <th className="text-left p-4 font-medium">Type</th>
                        <th className="text-right p-4 font-medium">Qty</th>
                        <th className="text-right p-4 font-medium">Entry</th>
                        <th className="text-right p-4 font-medium">Exit</th>
                        <th className="text-right p-4 font-medium">SL</th>
                        <th className="text-right p-4 font-medium">TP</th>
                        <th className="text-right p-4 font-medium">PNL</th>
                        <th className="text-right p-4 font-medium">Fee</th>
                        <th className="text-right p-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...bot.closedPositions].reverse().map(cp => (
                        <tr key={cp.id} className="border-b border-[#2B3139] hover:bg-[#2B3139]/50">
                          <td className="p-4 text-xs text-[#848E9C] font-mono">{new Date(cp.closedAt).toLocaleString()}</td>
                          <td className="p-4">
                            <span className="text-sm font-medium text-white">{PAIR_NAMES[cp.symbol] || cp.symbol.replace('USDT', '')}/USDT</span>
                          </td>
                          <td className="p-4">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${cp.type === 'buy' ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#F6465D]/10 text-[#F6465D]'}`}>
                              {cp.type === 'buy' ? 'BUY' : 'SELL'}
                            </span>
                          </td>
                          <td className="p-4 text-right text-sm font-mono text-white">{cp.quantity}</td>
                          <td className="p-4 text-right text-sm font-mono text-white">${cp.entryPrice.toFixed(2)}</td>
                          <td className="p-4 text-right text-sm font-mono text-white">${cp.exitPrice.toFixed(2)}</td>
                          <td className="p-4 text-right text-xs font-mono">{cp.stopLoss ? <span className="text-[#F6465D]">{cp.stopLoss}%</span> : <span className="text-[#848E9C]">--</span>}</td>
                          <td className="p-4 text-right text-xs font-mono">{cp.takeProfit ? <span className="text-[#0ECB81]">{cp.takeProfit}%</span> : <span className="text-[#848E9C]">--</span>}</td>
                          <td className={`p-4 text-right text-sm font-mono ${cp.pnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                            {cp.pnl >= 0 ? '+' : ''}${cp.pnl.toFixed(2)}
                            <span className="text-xs ml-1">({cp.pnlPct >= 0 ? '+' : ''}{cp.pnlPct.toFixed(2)}%)</span>
                          </td>
                          <td className="p-4 text-right text-sm font-mono text-[#848E9C]">${cp.fee.toFixed(2)}</td>
                          <td className="p-4 text-right">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              cp.status === 'closed' ? 'bg-[#2B3139] text-[#848E9C]' :
                              cp.status === 'sl' ? 'bg-[#F6465D]/10 text-[#F6465D]' :
                              cp.status === 'tp' ? 'bg-[#0ECB81]/10 text-[#0ECB81]' :
                              'bg-[#F0B90B]/10 text-[#F0B90B]'
                            }`}>
                              {cp.status === 'closed' ? 'Closed' : cp.status === 'sl' ? 'SL Hit' : cp.status === 'tp' ? 'TP Hit' : 'Stopped'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Position History Cards */}
                <div className="md:hidden space-y-2 p-3">
                  {[...bot.closedPositions].reverse().map(cp => (
                    <div key={cp.id} className="bg-[#0B0E11] border border-[#2B3139] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{PAIR_NAMES[cp.symbol] || cp.symbol.replace('USDT', '')}/USDT</span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cp.type === 'buy' ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#F6465D]/10 text-[#F6465D]'}`}>
                            {cp.type === 'buy' ? 'BUY' : 'SELL'}
                          </span>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          cp.status === 'closed' ? 'bg-[#2B3139] text-[#848E9C]' :
                          cp.status === 'sl' ? 'bg-[#F6465D]/10 text-[#F6465D]' :
                          cp.status === 'tp' ? 'bg-[#0ECB81]/10 text-[#0ECB81]' :
                          'bg-[#F0B90B]/10 text-[#F0B90B]'
                        }`}>
                          {cp.status === 'closed' ? 'Closed' : cp.status === 'sl' ? 'SL' : cp.status === 'tp' ? 'TP' : 'Stop'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                        <div><span className="text-[#848E9C]">Qty</span><p className="text-white font-mono">{cp.quantity}</p></div>
                        <div><span className="text-[#848E9C]">Entry</span><p className="text-white font-mono">${cp.entryPrice.toFixed(2)}</p></div>
                        <div><span className="text-[#848E9C]">Exit</span><p className="text-white font-mono">${cp.exitPrice.toFixed(2)}</p></div>
                        <div><span className="text-[#848E9C]">Fee</span><p className="text-[#848E9C] font-mono">${cp.fee.toFixed(2)}</p></div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex gap-3">
                          <span><span className="text-[#848E9C]">SL </span>{cp.stopLoss ? <span className="text-[#F6465D] font-mono">{cp.stopLoss}%</span> : <span className="text-[#848E9C]">--</span>}</span>
                          <span><span className="text-[#848E9C]">TP </span>{cp.takeProfit ? <span className="text-[#0ECB81] font-mono">{cp.takeProfit}%</span> : <span className="text-[#848E9C]">--</span>}</span>
                        </div>
                        <p className={`font-mono font-semibold ${cp.pnl >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                          {cp.pnl >= 0 ? '+' : ''}${cp.pnl.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-xs text-[#848E9C] mt-2">{new Date(cp.closedAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Bot Config Summary (read-only) */}
      <div className="bg-[#1E2329] border border-[#2B3139] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Bot Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-[#848E9C]">Total Trades</p>
            <p className="text-white font-mono">{bot.closedTrades}</p>
          </div>
          <div>
            <p className="text-xs text-[#848E9C]">Winning Trades</p>
            <p className="text-[#0ECB81] font-mono">{bot.winningTrades}</p>
          </div>
          <div>
            <p className="text-xs text-[#848E9C]">Losing Trades</p>
            <p className="text-[#F6465D] font-mono">{bot.closedTrades - bot.winningTrades}</p>
          </div>
          <div>
            <p className="text-xs text-[#848E9C]">Win Rate</p>
            <p className={`font-mono ${bot.closedTrades > 0 && (bot.winningTrades / bot.closedTrades) >= 0.5 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
              {bot.closedTrades > 0 ? ((bot.winningTrades / bot.closedTrades) * 100).toFixed(1) : '0.0'}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
