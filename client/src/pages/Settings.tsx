import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Save, Check, Brain, Cpu, Key, Wallet, Sparkles, RefreshCw, Eye, EyeOff, Wifi, WifiOff } from 'lucide-react';
import { saveLlmConfig, loadLlmConfig, fetchModelsFromProvider, testConnection } from '../lib/api';

interface ModelEntry { id: string; name: string; cost: string; context: number; maxOutput: number; capabilities: string[] }

const llmProviders = [
  { id: 'opencode', name: 'OpenCode' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'nvidia', name: 'NVIDIA NIM' },
];

function ModelDetails({ model }: { model: ModelEntry | undefined }) {
  if (!model) return null;
  return (
    <div className="mt-2 p-2 rounded-lg bg-background/50 border border-border">
      <p className="text-xs font-medium text-white mb-1.5">{model.name}</p>
      <div className="grid grid-cols-2 gap-1 text-[10px] text-[#848E9C] mb-1.5">
        <div><span className="text-muted">Context:</span> {(model.context / 1000).toLocaleString()}K</div>
        <div><span className="text-muted">Max output:</span> {(model.maxOutput / 1000).toLocaleString()}K</div>
        <div><span className="text-muted">Cost:</span> {model.cost}</div>
      </div>
      <div className="flex flex-wrap gap-1">
        {model.capabilities.map(c => <span key={c} className="px-1.5 py-0.5 rounded bg-[#2B3139] text-[10px] text-[#848E9C]">{c}</span>)}
      </div>
    </div>
  );
}

export default function Settings() {
  const {
    llmProvider, apiKey, deepModel, quickModel, walletBalance,
    setLlmProvider, setApiKey, setDeepModel, setQuickModel, setWalletBalance,
  } = useAppStore();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [balanceInput, setBalanceInput] = useState(String(walletBalance));
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [providerChanged, setProviderChanged] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadLlmConfig().then(config => {
      if (config.provider) setLlmProvider(config.provider);
      if (config.apiKey) setApiKey(config.apiKey);
      if (config.quickModel) setQuickModel(config.quickModel);
      if (config.deepModel) setDeepModel(config.deepModel);
    });
  }, []);

  const fetchModels = (provider: string, key: string) => {
    setLoadingModels(true);
    setProviderChanged(false);
    setConnectionStatus(null);
    fetchModelsFromProvider(provider, key || undefined)
      .then(data => {
        setModels(data.models || []);
        const m = data.models || [];
        if (m.length > 0) {
          setQuickModel(m[0].id);
          setDeepModel(m.length > 1 ? m[1].id : m[0].id);
        }
      })
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  };

  const handleProviderChange = (providerId: string) => {
    setLlmProvider(providerId);
    setProviderChanged(true);
    setModels([]);
    setQuickModel('');
    setDeepModel('');
    setConnectionStatus(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setConnectionStatus(null);
    setTesting(true);

    try {
      const result = await testConnection(llmProvider, apiKey);
      setConnectionStatus(result);
    } catch (e: any) {
      setConnectionStatus({ ok: false, error: e.message || 'Server unreachable' });
    }
    setTesting(false);

    const nb = parseInt(balanceInput);
    if (!isNaN(nb) && nb > 0) setWalletBalance(nb);
    try {
      await saveLlmConfig({ provider: llmProvider, apiKey, quickModel, deepModel });
    } catch (e: any) {
      setConnectionStatus({ ok: false, error: 'Config save failed: ' + (e.message || 'Server unreachable') });
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const quickModelDetails = models.find(m => m.id === quickModel);
  const deepModelDetails = models.find(m => m.id === deepModel);

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
                <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-10 py-2.5 text-white text-sm focus:outline-none focus:border-primary" placeholder="Enter API key" />
                <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => fetchModels(llmProvider, apiKey)} disabled={loadingModels}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium border border-accent/30 hover:bg-accent/20 disabled:opacity-50 transition-all">
                <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} /> {loadingModels ? 'Loading...' : 'Fetch Models'}
              </button>
              {providerChanged && (
                <span className="text-[10px] text-[#F0B90B]">Provider changed — click Fetch Models</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <label className="text-xs text-muted flex items-center gap-1 mb-2"><Cpu className="w-3 h-3 text-primary" /> Quick Model</label>
                  <select value={quickModel} onChange={(e) => setQuickModel(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-white text-xs">
                    {models.length === 0 && <option value="">— fetch models first —</option>}
                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <ModelDetails model={quickModelDetails} />
              </div>
              <div>
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <label className="text-xs text-muted flex items-center gap-1 mb-2"><Brain className="w-3 h-3 text-accent" /> Deep Model</label>
                  <select value={deepModel} onChange={(e) => setDeepModel(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-white text-xs">
                    {models.length === 0 && <option value="">— fetch models first —</option>}
                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <ModelDetails model={deepModelDetails} />
              </div>
            </div>

            {/* Connection Status */}
            {connectionStatus && (
              <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${connectionStatus.ok ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#F6465D]/10 text-[#F6465D]'}`}>
                {connectionStatus.ok ? <><Wifi className="w-4 h-4" /> Connected — API key valid</> : <><WifiOff className="w-4 h-4" /> {connectionStatus.error || 'Connection failed'}</>}
              </div>
            )}

            <button onClick={handleSave} disabled={saving || !quickModel || !deepModel || testing}
              className="mt-4 w-full py-3 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/80 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {testing ? 'Testing connection...' : saving ? 'Saving...' : saved ? <><Check className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />Save Config</>}
            </button>
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
              <div className="flex justify-between"><span className="text-muted">Connection</span>
                <span className={connectionStatus?.ok ? 'text-[#0ECB81]' : 'text-[#848E9C]'}>
                  {connectionStatus === null ? 'Not tested' : connectionStatus.ok ? 'Connected' : 'Failed'}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-muted">Wallet</span><span className="text-white">${walletBalance.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
