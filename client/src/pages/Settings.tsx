import { useState, useEffect } from 'react';
import { useAppStore, modelOptions } from '../store/appStore';
import {
  Sparkles,
  Info,
  Save,
  Check,
  AlertCircle,
  Zap,
  Scale,
  User,
  Bell,
  Brain,
  Cpu,
  Loader2,
  Key,
  Globe
} from 'lucide-react';

const llmProviders = [
  { id: 'opencode', name: 'OpenCode', icon: '🤖' },
  { id: 'openai', name: 'OpenAI', icon: '✨' },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠' },
  { id: 'google', name: 'Google', icon: '🌟' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🔮' },
];

export default function Settings() {
  const {
    llmProvider, apiKey, deepModel, quickModel,
    setLlmProvider, setApiKey, setDeepModel, setQuickModel,
    tradingMode, setTradingMode
  } = useAppStore();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const models = modelOptions[llmProvider] || modelOptions.opencode;

  const handleProviderChange = (providerId: string) => {
    setLlmProvider(providerId);
    const newModels = modelOptions[providerId];
    if (newModels?.quick?.length > 0) setQuickModel(newModels.quick[0].id);
    if (newModels?.deep?.length > 0) setDeepModel(newModels.deep[0].id);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Settings</h1>
        <p className="text-muted">Configure your trading preferences and AI settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Trading Mode */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Scale className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Trading Mode</h2>
                <p className="text-sm text-muted">Choose between paper or live trading</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setTradingMode('paper')}
                className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                  tradingMode === 'paper'
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : 'border-border hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  {tradingMode === 'paper' && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Paper Trading</h3>
                <p className="text-sm text-muted mb-3">Practice with $100,000 virtual money</p>
                <div className="flex items-center gap-2">
                  <span className="badge-success">Recommended</span>
                  <span className="badge-info">Risk Free</span>
                </div>
              </button>

              <button
                onClick={() => setTradingMode('live')}
                className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                  tradingMode === 'live'
                    ? 'border-secondary bg-secondary/5 shadow-lg shadow-secondary/10'
                    : 'border-border hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <Scale className="w-6 h-6 text-secondary" />
                  </div>
                  {tradingMode === 'live' && (
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Live Trading</h3>
                <p className="text-sm text-muted mb-3">Connect to real broker accounts</p>
                <div className="flex items-center gap-2">
                  <span className="badge-danger">Real Money</span>
                  <span className="badge-warning">High Risk</span>
                </div>
              </button>
            </div>

            {tradingMode === 'live' && (
              <div className="mt-4 p-4 rounded-xl bg-secondary/5 border border-secondary/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white">Live Trading Warning</p>
                    <p className="text-xs text-muted mt-1">
                      You're about to enable live trading. Real money will be at risk.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Settings */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">AI Configuration</h2>
                <p className="text-sm text-muted">Configure your AI provider and API key</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* LLM Provider Selection */}
              <div>
                <label className="block text-sm text-muted mb-3">LLM Provider</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {llmProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => handleProviderChange(provider.id)}
                      className={`relative p-3 rounded-xl border transition-all text-center ${
                        llmProvider === provider.id
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-gray-600'
                      }`}
                    >
                      {llmProvider === provider.id && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                          <Check className="w-2 h-2 text-white" />
                        </div>
                      )}
                      <span className="text-lg mb-1 block">{provider.icon}</span>
                      <span className="text-xs font-medium text-white">{provider.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm text-muted mb-3">API Key</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="input w-full pl-12 pr-4 py-3"
                    placeholder="Enter your API key"
                  />
                </div>
                <p className="text-xs text-muted mt-2 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Get your API key from{' '}
                  <a
                    href={llmProvider === 'opencode' ? 'https://opencode.ai/settings' : 'https://platform.openai.com'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-light"
                  >
                    {llmProvider === 'opencode' ? 'opencode.ai' : 'their website'}
                  </a>
                </p>
              </div>

              {/* Model Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-background/50 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-4 h-4 text-primary" />
                    <label className="text-sm font-medium text-white">Quick Model</label>
                    <span className="text-xs text-muted">(Fast)</span>
                  </div>
                  <select
                    value={quickModel}
                    onChange={(e) => setQuickModel(e.target.value)}
                    className="input w-full"
                  >
                    {models.quick.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} {model.cost && `(${model.cost})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-background/50 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-accent" />
                    <label className="text-sm font-medium text-white">Deep Model</label>
                    <span className="text-xs text-muted">(Complex)</span>
                  </div>
                  <select
                    value={deepModel}
                    onChange={(e) => setDeepModel(e.target.value)}
                    className="input w-full"
                  >
                    {models.deep.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} {model.cost && `(${model.cost})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!apiKey && llmProvider !== 'opencode' && (
                <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white">API Key Required</p>
                      <p className="text-xs text-muted mt-1">
                        Please enter your API key to use {llmProvider}.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* About */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center">
                <Info className="w-6 h-6 text-info" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">About Trade4u</h2>
                <p className="text-sm text-muted">Platform information</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-background/50">
                <p className="text-sm text-muted mb-1">Frontend</p>
                <p className="font-medium text-white text-sm">React + Vite</p>
              </div>
              <div className="p-4 rounded-xl bg-background/50">
                <p className="text-sm text-muted mb-1">Backend</p>
                <p className="font-medium text-white text-sm">Node.js</p>
              </div>
              <div className="p-4 rounded-xl bg-background/50">
                <p className="text-sm text-muted mb-1">AI Engine</p>
                <p className="font-medium text-white text-sm">TradingAgents</p>
              </div>
              <div className="p-4 rounded-xl bg-background/50">
                <p className="text-sm text-muted mb-1">Database</p>
                <p className="font-medium text-white text-sm">Firebase</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background transition-colors text-left">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-primary" />
                  <span className="text-sm text-white">Edit Profile</span>
                </div>
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background transition-colors text-left">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-accent" />
                  <span className="text-sm text-white">Notifications</span>
                </div>
              </button>
            </div>
          </div>

          <div className="card p-6 bg-gradient-to-br from-primary/5 to-accent/5">
            <h3 className="font-semibold text-white mb-4">Current Configuration</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Trading</span>
                <span className={tradingMode === 'paper' ? 'text-primary' : 'text-secondary'}>
                  {tradingMode === 'paper' ? 'Paper' : 'Live'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Provider</span>
                <span className="text-white capitalize">{llmProvider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Quick Model</span>
                <span className="text-white text-xs">{quickModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Deep Model</span>
                <span className="text-white text-xs">{deepModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">API Key</span>
                <span className="text-white">{apiKey ? '••••••' : 'Not set'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {saving ? (
              <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : saved ? (
              <><Check className="w-5 h-5" />Saved!</>
            ) : (
              <><Save className="w-5 h-5" />Save Settings</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}