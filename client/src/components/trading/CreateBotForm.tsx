import React, { useState } from 'react';
import { ArrowLeft, Settings2, Zap } from 'lucide-react';

interface CreateBotFormProps {
  allPairs: string[];
  pairNames: Record<string, string>;
  walletBalance: number;
  prices: Record<string, any>;
  onCreateBot: (config: {
    name: string;
    symbols: string[];
    allocationType: 'percentage' | 'fixed';
    allocationValue: number;
    stopLoss?: number;
    takeProfit?: number;
    interval: number;
  }) => void;
  onBack: () => void;
}

export function CreateBotForm({
  allPairs,
  pairNames,
  walletBalance,
  prices,
  onCreateBot,
  onBack,
}: CreateBotFormProps) {
  const [formName, setFormName] = useState('');
  const [formSymbols, setFormSymbols] = useState<string[]>(['BTCUSDT']);
  const [formAllocType, setFormAllocType] = useState<'percentage' | 'fixed'>('percentage');
  const [formAllocValue, setFormAllocValue] = useState(10);
  const [formInterval, setFormInterval] = useState(5);
  const [formSL, setFormSL] = useState(2);
  const [formTP, setFormTP] = useState(5);
  const [formSLEnabled, setFormSLEnabled] = useState(false);
  const [formTPEnabled, setFormTPEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const calcFrozen = (type: 'percentage' | 'fixed', val: number) => {
    return type === 'percentage' ? Math.round(walletBalance * (val / 100)) : Math.min(val, walletBalance);
  };

  const frozen = calcFrozen(formAllocType, formAllocValue);

  const formatPrice = (p: number) => {
    return p > 1 ? p.toFixed(2) : p.toFixed(6);
  };

  const handleCreate = () => {
    if (!formName || formSymbols.length === 0 || frozen <= 0) return;
    onCreateBot({
      name: formName,
      symbols: formSymbols,
      allocationType: formAllocType,
      allocationValue: formAllocValue,
      interval: formInterval,
      ...(formSLEnabled ? { stopLoss: formSL } : {}),
      ...(formTPEnabled ? { takeProfit: formTP } : {}),
    });
  };

  const filteredPairs = allPairs
    .filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 15);

  return (
    <div className="space-y-4 animate-fade-in max-w-5xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Bots
      </button>
      <h1 className="text-xl font-bold text-white">Create AI Trading Bot</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Configuration Form */}
        <div className="lg:col-span-3 bg-surface border border-border rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" /> Configuration
          </h2>

          <div className="mb-5">
            <label className="block text-xs text-muted mb-1.5 font-medium uppercase tracking-wider">Bot Name</label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
              placeholder="e.g. BTC Momentum Bot"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs text-muted mb-1.5 font-medium uppercase tracking-wider">Trading Pairs</label>
            
            {/* Selected tags */}
            {formSymbols.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 p-2 bg-background/50 border border-border rounded-lg">
                {formSymbols.map(s => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 bg-primary/10 border border-primary/30 text-primary px-2.5 py-1 rounded-md text-xs font-semibold"
                  >
                    {pairNames[s] || s.replace('USDT', '/USDT')}
                    <button
                      type="button"
                      onClick={() => setFormSymbols(formSymbols.filter(x => x !== s))}
                      className="ml-1 text-muted hover:text-white font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search pairs (e.g. ETH, SOL, XRP)..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Suggestions */}
            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
              {filteredPairs.map(s => {
                const isSelected = formSymbols.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setFormSymbols(
                        isSelected ? formSymbols.filter(x => x !== s) : [...formSymbols, s]
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted hover:text-white hover:border-gray-500'
                    }`}
                  >
                    {pairNames[s] || s.replace('USDT', '/USDT')}
                  </button>
                );
              })}
              {filteredPairs.length === 0 && (
                <span className="text-xs text-muted italic p-1">No matching pairs found.</span>
              )}
            </div>
            {formSymbols.length === 0 && <p className="text-xs text-secondary mt-1.5 font-medium">Select at least one pair</p>}
          </div>

          <div className="mb-5">
            <label className="block text-xs text-muted mb-1.5 font-medium uppercase tracking-wider">Allocation Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormAllocType('percentage')}
                className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                  formAllocType === 'percentage'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted hover:text-white'
                }`}
              >
                % of Wallet Balance
              </button>
              <button
                type="button"
                onClick={() => setFormAllocType('fixed')}
                className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                  formAllocType === 'fixed'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted hover:text-white'
                }`}
              >
                Fixed Capital Amount
              </button>
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs text-muted mb-1.5 font-medium uppercase tracking-wider">
              {formAllocType === 'percentage' ? `Allocation Percentage: ${formAllocValue}%` : `Fixed Amount: $${formAllocValue}`}
            </label>
            {formAllocType === 'percentage' ? (
              <>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={formAllocValue}
                  onChange={e => setFormAllocValue(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted mt-2">
                  <span>1%</span>
                  <span className="text-primary font-medium">${frozen.toLocaleString()} will be reserved</span>
                  <span>100%</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted font-mono">$</span>
                <input
                  type="number"
                  min={10}
                  max={walletBalance}
                  value={formAllocValue}
                  onChange={e => setFormAllocValue(Math.min(walletBalance, Math.max(10, parseInt(e.target.value) || 10)))}
                  className="flex-1 bg-background border border-border rounded-lg px-3.5 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-primary"
                />
                <span className="text-xs text-primary font-medium">${frozen.toLocaleString()} reserved</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-muted font-medium uppercase tracking-wider">Stop Loss</label>
                <button
                  type="button"
                  onClick={() => setFormSLEnabled(!formSLEnabled)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                    formSLEnabled ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-white/5 text-muted'
                  }`}
                >
                  {formSLEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              {formSLEnabled ? (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={formSL}
                    onChange={e => setFormSL(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-secondary"
                  />
                  <span className="text-xs text-secondary font-mono font-semibold w-10 text-right">{formSL}%</span>
                </div>
              ) : (
                <p className="text-xs text-muted">Automatic protection disabled</p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-muted font-medium uppercase tracking-wider">Take Profit</label>
                <button
                  type="button"
                  onClick={() => setFormTPEnabled(!formTPEnabled)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                    formTPEnabled ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-muted'
                  }`}
                >
                  {formTPEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              {formTPEnabled ? (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.5"
                    max="50"
                    step="0.5"
                    value={formTP}
                    onChange={e => setFormTP(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-xs text-primary font-mono font-semibold w-10 text-right">{formTP}%</span>
                </div>
              ) : (
                <p className="text-xs text-muted">Target profit booking disabled</p>
              )}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs text-muted mb-1.5 font-medium uppercase tracking-wider">Analysis Interval</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={formInterval}
                onChange={e => setFormInterval(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-xs text-white font-mono font-semibold w-12 text-right">{formInterval} min</span>
            </div>
            <p className="text-[10px] text-muted mt-1">Defines how often the AI agent polls Binance endpoints to execute agentic debate loops.</p>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={!formName || formSymbols.length === 0 || frozen <= 0}
            className="w-full py-3 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
          >
            <Zap className="w-4 h-4 text-black" /> Create Bot & Start Engine
          </button>
        </div>

        {/* Right: Summary Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider text-xs">Allocation Preview</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Available Wallet Capital</span>
                <span className="text-white font-mono">${walletBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Reserved for Bot</span>
                <span className="text-primary font-mono">- ${frozen.toLocaleString()}</span>
              </div>
              <div className="pt-3 border-t border-border flex justify-between text-sm font-semibold">
                <span className="text-muted">Post-allocation Remaining</span>
                <span className="text-white font-mono">${(walletBalance - frozen).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider text-xs">Risk Settings</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Polling Frequency</span>
                <span className="text-white font-mono">{formInterval} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Stop Loss Protection</span>
                <span className="text-secondary font-mono">{formSLEnabled ? `${formSL}%` : 'Not configured'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Take Profit Goal</span>
                <span className="text-primary font-mono">{formTPEnabled ? `${formTP}%` : 'Not configured'}</span>
              </div>
              {formSLEnabled && formTPEnabled && (
                <div className="flex justify-between pt-2 border-t border-border/50">
                  <span className="text-muted">Risk/Reward Ratio</span>
                  <span className="text-white font-mono font-semibold">1 : {(formTP / formSL).toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider text-xs">Monitored Assets</h3>
            {formSymbols.length === 0 ? (
              <p className="text-xs text-muted">No assets selected</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {formSymbols.map(s => {
                  const p = prices[s];
                  return (
                    <div key={s} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background border border-border">
                      <span className="text-sm font-semibold text-white">{pairNames[s] || s.replace('USDT', '/USDT')}</span>
                      {p && <span className="text-xs font-mono text-muted">${formatPrice(p.price)}</span>}
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
