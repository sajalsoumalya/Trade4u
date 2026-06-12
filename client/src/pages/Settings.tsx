import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { Save, Check, Brain, Cpu, Key, Wallet, Sparkles, RefreshCw, Eye, EyeOff, Wifi, WifiOff, RotateCw, Pencil, X, Zap, Activity } from 'lucide-react';
import { saveLlmConfig, loadLlmConfig, fetchModelsFromProvider, testConnection, startBotEngine, stopBotEngine } from '../lib/api';

interface ModelEntry { id: string; name: string; cost: string; context: number; maxOutput: number; capabilities: string[] }

const llmProviders = [
  { id: 'opencode', name: 'OpenCode' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'nvidia_nim', name: 'NVIDIA NIM' },
  { id: 'openrouter', name: 'OpenRouter' },
];

function maskApiKey(key: string): string {
  if (!key) return 'Not set';
  if (key.includes('●')) return '••••••••••';
  if (key.length < 10) return '••••••••••';
  return `${key.slice(0, 5)}****${key.slice(-5)}`;
}

function providerLabel(id: string) {
  return llmProviders.find(p => p.id === id)?.name || id;
}

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
    fallbackProvider, fallbackApiKey, fallbackDeepModel, fallbackQuickModel,
    setLlmProvider, setApiKey, setDeepModel, setQuickModel, setWalletBalance,
    setFallbackProvider, setFallbackApiKey, setFallbackDeepModel, setFallbackQuickModel,
    bots, applyGlobalLlmToAllBots,
  } = useAppStore();

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  // Must be declared with the other hooks (before the view-mode early return) —
  // declaring it after that return changes the hook count between renders and
  // crashes the page when toggling view <-> edit (React hooks violation).
  const [editTarget, setEditTarget] = useState<'main' | 'fallback'>('main');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [balanceInput, setBalanceInput] = useState(String(walletBalance));
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [modelsSource, setModelsSource] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [providerChanged, setProviderChanged] = useState(false);
  const [showKey, setShowKey] = useState(false);
  interface ConnStatus { ok: boolean; error?: string; endpointUrl?: string; llmResponse?: string; keyOk?: boolean }
  const [connectionStatus, setConnectionStatus] = useState<ConnStatus | null>(null);
  const [testingConn, setTestingConn] = useState(false);
  const initialConfigLoaded = useRef(false);

  const [fallbackModels, setFallbackModels] = useState<ModelEntry[]>([]);
  const [fallbackModelsSource, setFallbackModelsSource] = useState<string>('');
  const [loadingFallbackModels, setLoadingFallbackModels] = useState(false);
  const [fallbackProviderChanged, setFallbackProviderChanged] = useState(false);
  const [showFallbackKey, setShowFallbackKey] = useState(false);
  const [fallbackConnectionStatus, setFallbackConnectionStatus] = useState<ConnStatus | null>(null);
  const [testingFallbackConn, setTestingFallbackConn] = useState(false);

  const hasConfig = llmProvider && quickModel && deepModel;

  useEffect(() => {
    loadLlmConfig().then(config => {
      if (config.provider && config.provider !== 'opencode') setLlmProvider(config.provider);
      if (config.apiKey && config.apiKey !== '●●●●●●●●') {
        setApiKey(config.apiKey);
        const model = config.quickModel || config.deepModel || undefined;
        testConnection(config.provider, config.apiKey, false, model)
          .then(result => setConnectionStatus(result))
          .catch(e => setConnectionStatus({ ok: false, error: e.message || 'Server unreachable' }));
      }
      if (config.quickModel && config.quickModel !== 'minimax-m2.5-free') setQuickModel(config.quickModel);
      if (config.deepModel && config.deepModel !== 'minimax-m2.5-free') setDeepModel(config.deepModel);

      if (config.fallbackProvider && config.fallbackProvider !== 'opencode') setFallbackProvider(config.fallbackProvider);
      if (config.fallbackApiKey && config.fallbackApiKey !== '●●●●●●●●') {
        setFallbackApiKey(config.fallbackApiKey);
        const model = config.fallbackQuickModel || config.fallbackDeepModel || undefined;
        testConnection(config.fallbackProvider, config.fallbackApiKey, true, model)
          .then(result => setFallbackConnectionStatus(result))
          .catch(e => setFallbackConnectionStatus({ ok: false, error: e.message || 'Server unreachable' }));
      }
      if (config.fallbackQuickModel && config.fallbackQuickModel !== 'minimax-m2.5-free') setFallbackQuickModel(config.fallbackQuickModel);
      if (config.fallbackDeepModel && config.fallbackDeepModel !== 'minimax-m2.5-free') setFallbackDeepModel(config.fallbackDeepModel);
    }).catch(() => {
      // Server unreachable — keep Zustand persisted state as-is
    }).finally(() => {
      initialConfigLoaded.current = true;
    });
  }, []);

  useEffect(() => {
    const isOpencode = llmProvider === 'opencode';
    const hasKey = apiKey && apiKey.trim() !== '' && apiKey !== 'Not set';
    if (!isOpencode && !hasKey) {
      setModels([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoadingModels(true);
      setProviderChanged(false);
      fetchModelsFromProvider(llmProvider, apiKey || undefined)
        .then(data => {
          setModels(data.models || []);
          setModelsSource(data.source || '');
          const m = data.models || [];
          if (m.length > 0 && initialConfigLoaded.current) {
            const { quickModel: qm, deepModel: dm } = useAppStore.getState();
            if (!qm || !m.some(x => x.id === qm)) setQuickModel(m[0].id);
            if (!dm || !m.some(x => x.id === dm)) setDeepModel(m.length > 1 ? m[1].id : m[0].id);
          }
        })
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    }, 500);

    return () => clearTimeout(timer);
  }, [llmProvider, apiKey]);

  useEffect(() => {
    const isOpencode = fallbackProvider === 'opencode';
    const hasKey = fallbackApiKey && fallbackApiKey.trim() !== '' && fallbackApiKey !== 'Not set';
    if (!isOpencode && !hasKey) {
      setFallbackModels([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoadingFallbackModels(true);
      setFallbackProviderChanged(false);
      fetchModelsFromProvider(fallbackProvider, fallbackApiKey || undefined)
        .then(data => {
          setFallbackModels(data.models || []);
          setFallbackModelsSource(data.source || '');
          const m = data.models || [];
          if (m.length > 0 && initialConfigLoaded.current) {
            const { fallbackQuickModel: fqm, fallbackDeepModel: fdm } = useAppStore.getState();
            if (!fqm || !m.some(x => x.id === fqm)) setFallbackQuickModel(m[0].id);
            if (!fdm || !m.some(x => x.id === fdm)) setFallbackDeepModel(m.length > 1 ? m[1].id : m[0].id);
          }
        })
        .catch(() => setFallbackModels([]))
        .finally(() => setLoadingFallbackModels(false));
    }, 500);

    return () => clearTimeout(timer);
  }, [fallbackProvider, fallbackApiKey]);

  const handleSave = async () => {
    setSaving(true);
    setConnectionStatus(null);
    setFallbackConnectionStatus(null);

    // The fallback engine is optional: only test an engine that's actually
    // configured (a no-key provider like opencode, or one that has a key). This
    // way updating just the Main engine never forces you to set up the Fallback
    // or shows a spurious "fallback key required" error.
    const isConfigured = (provider: string, key: string) =>
      provider === 'opencode' || (!!key && key.trim() !== '' && key !== 'Not set');

    if (isConfigured(llmProvider, apiKey)) {
      try {
        setConnectionStatus(await testConnection(llmProvider, apiKey, false, quickModel || deepModel || undefined));
      } catch (e: any) {
        setConnectionStatus({ ok: false, error: e.message || 'Server unreachable' });
      }
    } else {
      setConnectionStatus(null);
    }

    if (isConfigured(fallbackProvider, fallbackApiKey)) {
      try {
        setFallbackConnectionStatus(await testConnection(fallbackProvider, fallbackApiKey, true, fallbackQuickModel || fallbackDeepModel || undefined));
      } catch (e: any) {
        setFallbackConnectionStatus({ ok: false, error: e.message || 'Server unreachable' });
      }
    } else {
      setFallbackConnectionStatus(null);
    }

    const nb = parseInt(balanceInput);
    if (!isNaN(nb) && nb > 0) setWalletBalance(nb);
    try {
      await saveLlmConfig({
        provider: llmProvider,
        apiKey,
        quickModel,
        deepModel,
        fallbackProvider,
        fallbackApiKey,
        fallbackQuickModel,
        fallbackDeepModel,
      });

      // Apply the new config to every bot and restart the running ones so the
      // change takes effect at runtime. The engine reloads the key from the DB
      // (just saved) and uses the new provider/models on the next cycle.
      applyGlobalLlmToAllBots(llmProvider, quickModel, deepModel);
      for (const b of bots) {
        if (b.status === 'running') {
          try {
            await stopBotEngine(b.id);
            await startBotEngine(b.id, b.symbols, b.stopLoss, b.takeProfit, b.interval, llmProvider, quickModel, deepModel);
          } catch (_) { /* best-effort; engine status surfaces on the Trading page */ }
        }
      }
    } catch (e: any) {
      setConnectionStatus({ ok: false, error: 'Config save failed: ' + (e.message || 'Server unreachable') });
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setMode('view');
  };

  const testPrimaryConnection = async () => {
    setTestingConn(true);
    setConnectionStatus(null);
    try {
      const result = await testConnection(llmProvider, apiKey, false, quickModel || deepModel || undefined);
      setConnectionStatus(result);
    } catch (e: any) {
      setConnectionStatus({ ok: false, error: e.message || 'Server unreachable' });
    }
    setTestingConn(false);
  };

  const testFallbackConnection = async () => {
    setTestingFallbackConn(true);
    setFallbackConnectionStatus(null);
    try {
      const result = await testConnection(fallbackProvider, fallbackApiKey, true, fallbackQuickModel || fallbackDeepModel || undefined);
      setFallbackConnectionStatus(result);
    } catch (e: any) {
      setFallbackConnectionStatus({ ok: false, error: e.message || 'Server unreachable' });
    }
    setTestingFallbackConn(false);
  };

  const quickModelDetails = models.find(m => m.id === quickModel);
  const deepModelDetails = models.find(m => m.id === deepModel);
  const fallbackQuickModelDetails = fallbackModels.find(m => m.id === fallbackQuickModel);
  const fallbackDeepModelDetails = fallbackModels.find(m => m.id === fallbackDeepModel);

  // ============ VIEW MODE ============
  if (mode === 'view') {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          {hasConfig && (
            <button onClick={() => setMode('edit')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium border border-accent/30 hover:bg-accent/20 transition-all">
              <Pencil className="w-4 h-4" /> Update
            </button>
          )}
        </div>

        {!hasConfig ? (
          <>
            {/* First-time setup prompt */}
            <div className="bg-surface border border-border rounded-xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Set Your AI Engine</h2>
              <p className="text-sm text-muted max-w-md mx-auto mb-6">
                Configure your LLM provider and models to power AI trading analysis, 
                bot decision-making, and market insights.
              </p>
              <button onClick={() => setMode('edit')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary-light transition-all shadow-lg shadow-primary/10">
                <Zap className="w-4 h-4" /> Configure Now
              </button>
            </div>

            {/* Wallet card */}
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
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              {/* Primary AI Engine Card */}
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">AI Engine</h2>
                      <p className="text-xs text-muted">Primary LLM provider</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={testPrimaryConnection} disabled={testingConn}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-muted hover:text-white hover:border-gray-500 disabled:opacity-50 transition-all"
                      title="Test connection">
                      <RotateCw className={`w-3.5 h-3.5 ${testingConn ? 'animate-spin' : ''}`} />
                      <span>{testingConn ? 'Testing...' : connectionStatus?.ok ? 'Connected' : 'Test'}</span>
                    </button>
                    <button onClick={() => setMode('edit')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium border border-accent/30 hover:bg-accent/20 transition-all">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Provider</label>
                    <p className="text-sm text-white font-semibold mt-1">{providerLabel(llmProvider)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <label className="text-[10px] text-muted uppercase tracking-wider font-medium">API Key</label>
                    <p className="text-sm text-white font-mono mt-1">{maskApiKey(apiKey)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Quick Model</label>
                    <p className="text-sm text-white font-semibold mt-1">{quickModel}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Deep Model</label>
                    <p className="text-sm text-white font-semibold mt-1">{deepModel}</p>
                  </div>
                </div>

                {connectionStatus && (
                  <div className="mt-3 space-y-2">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${connectionStatus.ok ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#F6465D]/10 text-[#F6465D]'}`}>
                      {connectionStatus.ok ? <><Wifi className="w-4 h-4" /> Connected</> : <><WifiOff className="w-4 h-4" /> {connectionStatus.error || 'Connection failed'}</>}
                    </div>
                    {connectionStatus.endpointUrl && (
                      <div className="px-3 py-2 rounded-lg bg-background/50 border border-border text-xs text-muted">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500">Endpoint</span>
                        <p className="text-white font-mono mt-0.5 break-all">{connectionStatus.endpointUrl}</p>
                      </div>
                    )}
                    {connectionStatus.llmResponse && (
                      <div className="px-3 py-2 rounded-lg bg-background/50 border border-border text-xs text-muted">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500">LLM Response</span>
                        <p className="text-white font-mono mt-0.5 break-all">{connectionStatus.llmResponse}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fallback AI Engine Card */}
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">Fallback AI Engine</h2>
                      <p className="text-xs text-muted">Backup LLM when primary is unavailable</p>
                    </div>
                  </div>
                  <button onClick={testFallbackConnection} disabled={testingFallbackConn}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-muted hover:text-white hover:border-gray-500 disabled:opacity-50 transition-all"
                    title="Test fallback connection">
                    <RotateCw className={`w-3.5 h-3.5 ${testingFallbackConn ? 'animate-spin' : ''}`} />
                    <span>{testingFallbackConn ? 'Testing...' : fallbackConnectionStatus?.ok ? 'Connected' : 'Test'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Provider</label>
                    <p className="text-sm text-white font-semibold mt-1">{providerLabel(fallbackProvider)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <label className="text-[10px] text-muted uppercase tracking-wider font-medium">API Key</label>
                    <p className="text-sm text-white font-mono mt-1">{maskApiKey(fallbackApiKey)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Quick Model</label>
                    <p className="text-sm text-white font-semibold mt-1">{fallbackQuickModel || 'Not configured'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-border">
                    <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Deep Model</label>
                    <p className="text-sm text-white font-semibold mt-1">{fallbackDeepModel || 'Not configured'}</p>
                  </div>
                </div>

                {fallbackConnectionStatus && (
                  <div className="mt-3 space-y-2">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${fallbackConnectionStatus.ok ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#F6465D]/10 text-[#F6465D]'}`}>
                      {fallbackConnectionStatus.ok ? <><Wifi className="w-4 h-4" /> Connected</> : <><WifiOff className="w-4 h-4" /> {fallbackConnectionStatus.error || 'Connection failed'}</>}
                    </div>
                    {fallbackConnectionStatus.endpointUrl && (
                      <div className="px-3 py-2 rounded-lg bg-background/50 border border-border text-xs text-muted">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500">Endpoint</span>
                        <p className="text-white font-mono mt-0.5 break-all">{fallbackConnectionStatus.endpointUrl}</p>
                      </div>
                    )}
                    {fallbackConnectionStatus.llmResponse && (
                      <div className="px-3 py-2 rounded-lg bg-background/50 border border-border text-xs text-muted">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500">LLM Response</span>
                        <p className="text-white font-mono mt-0.5 break-all">{fallbackConnectionStatus.llmResponse}</p>
                      </div>
                    )}
                  </div>
                )}
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
                <h3 className="text-sm font-semibold text-white mb-4">System Status</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Primary AI</span>
                    <span className={`flex items-center gap-1 ${connectionStatus?.ok ? 'text-[#0ECB81]' : 'text-[#848E9C]'}`}>
                      <Activity className="w-3 h-3" />
                      {connectionStatus === null ? 'Untested' : connectionStatus.ok ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Fallback AI</span>
                    <span className={`flex items-center gap-1 ${fallbackConnectionStatus?.ok ? 'text-[#0ECB81]' : 'text-[#848E9C]'}`}>
                      <Activity className="w-3 h-3" />
                      {fallbackConnectionStatus === null ? 'Untested' : fallbackConnectionStatus.ok ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="h-px bg-border/40 my-1.5" />
                  <div className="flex justify-between">
                    <span className="text-muted">Wallet</span>
                    <span className="text-white font-mono">${walletBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ EDIT MODE ============
  const isMain = editTarget === 'main';
  const activeProvider = isMain ? llmProvider : fallbackProvider;
  const activeApiKey = isMain ? apiKey : fallbackApiKey;
  const activeQuickModel = isMain ? quickModel : fallbackQuickModel;
  const activeDeepModel = isMain ? deepModel : fallbackDeepModel;
  const activeModels = isMain ? models : fallbackModels;
  const activeModelsSource = isMain ? modelsSource : fallbackModelsSource;
  const activeLoadingModels = isMain ? loadingModels : loadingFallbackModels;
  const activeProviderChanged = isMain ? providerChanged : fallbackProviderChanged;
  const activeConnectionStatus = isMain ? connectionStatus : fallbackConnectionStatus;
  const activeShowKey = isMain ? showKey : showFallbackKey;
  const activeQuickModelDetails = isMain ? quickModelDetails : fallbackQuickModelDetails;
  const activeDeepModelDetails = isMain ? deepModelDetails : fallbackDeepModelDetails;

  const setActiveProvider = isMain ? setLlmProvider : setFallbackProvider;
  const setActiveApiKey = isMain ? setApiKey : setFallbackApiKey;
  const setActiveQuickModel = isMain ? setQuickModel : setFallbackQuickModel;
  const setActiveDeepModel = isMain ? setDeepModel : setFallbackDeepModel;
  const setActiveModels = isMain ? setModels : setFallbackModels;
  const setActiveProviderChanged = isMain ? setProviderChanged : setFallbackProviderChanged;
  const setActiveConnectionStatus = isMain ? setConnectionStatus : setFallbackConnectionStatus;
  const setActiveShowKey = isMain ? setShowKey : setShowFallbackKey;
  const setActiveLoadingModels = isMain ? setLoadingModels : setLoadingFallbackModels;

  const handleActiveProviderChange = (id: string) => {
    // Re-clicking the already-selected provider must NOT wipe the saved API key
    // / models — only reset when actually switching to a different provider.
    if (id === activeProvider) return;
    setActiveProvider(id);
    setActiveProviderChanged(true);
    setActiveModels([]);
    setActiveApiKey('');
    setActiveQuickModel('');
    setActiveDeepModel('');
    setActiveConnectionStatus(null);
  };

  const fetchActiveModels = () => {
    setActiveLoadingModels(true);
    setActiveProviderChanged(false);
    setActiveConnectionStatus(null);
    fetchModelsFromProvider(activeProvider, activeApiKey || undefined)
      .then(data => {
        setActiveModels(data.models || []);
        const m = data.models || [];
        if (m.length > 0) {
          const st = useAppStore.getState();
          const curQuick = isMain ? st.quickModel : st.fallbackQuickModel;
          const curDeep = isMain ? st.deepModel : st.fallbackDeepModel;
          if (!curQuick || !m.some(x => x.id === curQuick)) setActiveQuickModel(m[0].id);
          if (!curDeep || !m.some(x => x.id === curDeep)) setActiveDeepModel(m.length > 1 ? m[1].id : m[0].id);
        }
      })
      .catch(() => setActiveModels([]))
      .finally(() => setActiveLoadingModels(false));
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Configure AI Engine</h1>
        <button onClick={() => {
          // Restore Zustand from server so stray edits are discarded
          loadLlmConfig().then(config => {
            if (config.provider) setLlmProvider(config.provider);
            if (config.apiKey && config.apiKey !== '●●●●●●●●') setApiKey(config.apiKey);
            if (config.quickModel && config.quickModel !== 'minimax-m2.5-free') setQuickModel(config.quickModel);
            if (config.deepModel && config.deepModel !== 'minimax-m2.5-free') setDeepModel(config.deepModel);
            if (config.fallbackProvider) setFallbackProvider(config.fallbackProvider);
            if (config.fallbackApiKey && config.fallbackApiKey !== '●●●●●●●●') setFallbackApiKey(config.fallbackApiKey);
            if (config.fallbackQuickModel && config.fallbackQuickModel !== 'minimax-m2.5-free') setFallbackQuickModel(config.fallbackQuickModel);
            if (config.fallbackDeepModel && config.fallbackDeepModel !== 'minimax-m2.5-free') setFallbackDeepModel(config.fallbackDeepModel);
          }).catch(() => {
            // Server unreachable — keep Zustand as-is (don't wipe on network error)
          });
          setMode('view');
        }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-background border border-border text-sm text-muted hover:text-white hover:border-gray-500 transition-all">
          <X className="w-4 h-4" /> Cancel
        </button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="bg-surface border border-border rounded-xl p-5">
        {/* Target selector */}
        <div className="flex items-center gap-2 mb-6 p-1 bg-background rounded-lg w-fit border border-border">
          <button type="button" onClick={() => setEditTarget('main')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${editTarget === 'main' ? 'bg-accent/20 text-accent border border-accent/30' : 'text-muted hover:text-white'}`}>
            <Sparkles className="w-4 h-4" /> Main AI Engine
          </button>
          <button type="button" onClick={() => setEditTarget('fallback')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${editTarget === 'fallback' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-muted hover:text-white'}`}>
            <Brain className="w-4 h-4" /> Fallback AI Engine
          </button>
        </div>

        <div className="mb-5">
          <label className="block text-xs text-muted mb-2 font-medium">Provider</label>
          <div className="flex gap-2 flex-wrap">
            {llmProviders.map(p => (
              <button type="button" key={p.id} onClick={() => handleActiveProviderChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activeProvider === p.id ? (isMain ? 'border-accent bg-accent/10 text-white' : 'border-primary bg-primary/10 text-white') : 'border-border text-muted hover:text-white'}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-muted mb-1.5 font-medium">API Key</label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type={activeShowKey ? 'text' : 'password'} value={activeApiKey} onChange={(e) => setActiveApiKey(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-10 py-2.5 text-white text-sm focus:outline-none focus:border-primary" placeholder={`Enter ${isMain ? '' : 'fallback '}API key`} />
            <button type="button" onClick={() => setActiveShowKey(!activeShowKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
              {activeShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button type="button" onClick={fetchActiveModels} disabled={activeLoadingModels}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium border border-accent/30 hover:bg-accent/20 disabled:opacity-50 transition-all">
            <RefreshCw className={`w-3 h-3 ${activeLoadingModels ? 'animate-spin' : ''}`} /> {activeLoadingModels ? 'Loading...' : 'Fetch Models'}
          </button>
          {activeProviderChanged && (
            <span className="text-[10px] text-[#F0B90B]">Provider changed — click Fetch Models</span>
          )}
        </div>

        {activeModelsSource === 'fallback' && activeProvider !== 'opencode' && activeProvider !== 'openrouter' && (
          <p className="text-[10px] text-[#F0B90B] mb-4 -mt-1">
            Showing suggested models — enter a valid {providerLabel(activeProvider)} API key, then click Fetch Models to load live ones.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="p-3 rounded-lg bg-background/50 border border-border">
              <label className="text-xs text-muted flex items-center gap-1 mb-2"><Cpu className="w-3 h-3 text-primary" /> Quick Model</label>
              <select value={activeQuickModel} onChange={(e) => setActiveQuickModel(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-white text-xs">
                {activeQuickModel && !activeModels.some(m => m.id === activeQuickModel) && (
                  <option value={activeQuickModel}>{activeQuickModel}</option>
                )}
                {activeModels.length === 0 && !activeQuickModel && <option value="">— fetch models first —</option>}
                {activeModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <ModelDetails model={activeQuickModelDetails} />
          </div>
          <div>
            <div className="p-3 rounded-lg bg-background/50 border border-border">
              <label className="text-xs text-muted flex items-center gap-1 mb-2"><Brain className="w-3 h-3 text-accent" /> Deep Model</label>
              <select value={activeDeepModel} onChange={(e) => setActiveDeepModel(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-white text-xs">
                {activeDeepModel && !activeModels.some(m => m.id === activeDeepModel) && (
                  <option value={activeDeepModel}>{activeDeepModel}</option>
                )}
                {activeModels.length === 0 && !activeDeepModel && <option value="">— fetch models first —</option>}
                {activeModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <ModelDetails model={activeDeepModelDetails} />
          </div>
        </div>

        {activeConnectionStatus && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${activeConnectionStatus.ok ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#F6465D]/10 text-[#F6465D]'}`}>
            {activeConnectionStatus.ok ? <><Wifi className="w-4 h-4" /> Connected — API key valid</> : <><WifiOff className="w-4 h-4" /> {activeConnectionStatus.error || 'Connection failed'}</>}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted">Paper Wallet Balance</p>
              <p className="text-sm text-white font-semibold">${walletBalance.toLocaleString()}</p>
            </div>
          </div>
          <button type="submit" disabled={saving || !activeQuickModel || !activeDeepModel}
            className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/80 disabled:opacity-50 transition-all flex items-center gap-2">
            {saving ? 'Saving...' : saved ? <><Check className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />Save All Changes</>}
          </button>
        </div>
      </form>
    </div>
  );
}
