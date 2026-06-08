import { useState } from 'react';
import { useAppStore, modelOptions } from '../store/appStore';
import { Save, Check, Brain, Cpu, Key, Wallet, Sparkles } from 'lucide-react';

const llmProviders = [
  { id: 'opencode', name: 'OpenCode' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
  { id: 'deepseek', name: 'DeepSeek' },
];

export default function Settings() {
  const {
    llmProvider, apiKey, deepModel, quickModel, walletBalance,
    setLlmProvider, setApiKey, setDeepModel, setQuickModel, setWalletBalance,
  } = useAppStore();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [balanceInput, setBalanceInput] = useState(String(walletBalance));

  const models = modelOptions[llmProvider] || modelOptions.opencode;

  const handleProviderChange = (providerId: string) => {
    setLlmProvider(providerId);
    const m = modelOptions[providerId];
    if (m?.quick?.length > 0) setQuickModel(m.quick[0].id);
    if (m?.deep?.length > 0) setDeepModel(m.deep[0].id);
  };

  const handleSave = async () => {
    setSaving(true);
    const nb = parseInt(balanceInput);
    if (!isNaN(nb) && nb > 0) setWalletBalance(nb);
    await new Promise(r => setTimeout(r, 300));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">AI Engine</h2>
                <p className="text-xs text-muted">LLM provider and model configuration</p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs text-muted mb-2">Provider</label>
              <div className="flex gap-2 flex-wrap">
                {llmProviders.map(p => (
                  <button key={p.id} onClick={() => handleProviderChange(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${llmProvider === p.id ? 'border-accent bg-accent/10 text-white' : 'border-border text-muted hover:text-white'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-muted mb-1.5">API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary" placeholder="Enter API key" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-background/50 border border-border">
                <label className="text-xs text-muted flex items-center gap-1 mb-2"><Cpu className="w-3 h-3 text-primary" /> Quick Model</label>
                <select value={quickModel} onChange={(e) => setQuickModel(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-white text-xs">
                  {models.quick.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-border">
                <label className="text-xs text-muted flex items-center gap-1 mb-2"><Brain className="w-3 h-3 text-accent" /> Deep Model</label>
                <select value={deepModel} onChange={(e) => setDeepModel(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-white text-xs">
                  {models.deep.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Paper Wallet</h3>
                <p className="text-xs text-muted">Virtual trading balance</p>
              </div>
            </div>
            <label className="block text-xs text-muted mb-1.5">Balance</label>
            <input type="number" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary mb-4" />
            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/80 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {saving ? 'Saving...' : saved ? <><Check className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />Save</>}
            </button>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Current Config</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted">Provider</span><span className="text-white">{llmProvider}</span></div>
              <div className="flex justify-between"><span className="text-muted">Quick</span><span className="text-white text-[10px]">{quickModel}</span></div>
              <div className="flex justify-between"><span className="text-muted">Deep</span><span className="text-white text-[10px]">{deepModel}</span></div>
              <div className="flex justify-between"><span className="text-muted">API Key</span><span className="text-white">{apiKey ? '••••••' : 'Not set'}</span></div>
              <div className="flex justify-between"><span className="text-muted">Wallet</span><span className="text-white">${walletBalance.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
