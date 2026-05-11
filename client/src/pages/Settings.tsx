import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  Settings as SettingsIcon,
  Coins,
  Sparkles,
  Shield,
  Info,
  Save,
  Check,
  ChevronRight,
  Globe,
  Key,
  AlertCircle,
  Zap,
  Scale,
  User,
  Bell
} from 'lucide-react';

const llmProviders = [
  { id: 'opencode', name: 'OpenCode', description: 'Free & fast AI', icon: '🤖' },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4 powered', icon: '✨' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude models', icon: '🧠' },
  { id: 'google', name: 'Google', description: 'Gemini AI', icon: '🌟' },
  { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek V3', icon: '🔮' },
];

export default function Settings() {
  const { llmProvider, apiKey, setLlmProvider, setApiKey, tradingMode, setTradingMode } = useAppStore();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
        {/* Main Settings */}
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
                    <Coins className="w-6 h-6 text-secondary" />
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
                      You're about to enable live trading. Real money will be at risk. Make sure you understand the risks involved.
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
                <p className="text-sm text-muted">Configure your AI analysis provider</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-3">LLM Provider</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {llmProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => setLlmProvider(provider.id)}
                      className={`relative p-4 rounded-xl border transition-all text-left ${
                        llmProvider === provider.id
                          ? 'border-accent bg-accent/5'
                          : 'border-border hover:border-gray-600'
                      }`}
                    >
                      {llmProvider === provider.id && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <span className="text-2xl mb-2 block">{provider.icon}</span>
                      <h4 className="font-semibold text-white">{provider.name}</h4>
                      <p className="text-xs text-muted">{provider.description}</p>
                    </button>
                  ))}
                </div>
              </div>

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
                <p className="text-sm text-muted">Platform information and credits</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Trade4u</p>
                    <p className="text-xs text-muted">AI-Powered Trading Platform</p>
                  </div>
                </div>
                <span className="badge-info">v1.0.0</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-background/50">
                  <p className="text-sm text-muted mb-1">Frontend</p>
                  <p className="font-medium text-white">React + Vite + TypeScript</p>
                </div>
                <div className="p-4 rounded-xl bg-background/50">
                  <p className="text-sm text-muted mb-1">Backend</p>
                  <p className="font-medium text-white">Node.js + Express</p>
                </div>
                <div className="p-4 rounded-xl bg-background/50">
                  <p className="text-sm text-muted mb-1">AI Engine</p>
                  <p className="font-medium text-white">TradingAgents (LangGraph)</p>
                </div>
                <div className="p-4 rounded-xl bg-background/50">
                  <p className="text-sm text-muted mb-1">Database</p>
                  <p className="font-medium text-white">Firebase Firestore</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card p-6">
            <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background transition-colors text-left">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-primary" />
                  <span className="text-sm text-white">Edit Profile</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background transition-colors text-left">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-accent" />
                  <span className="text-sm text-white">Notifications</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background transition-colors text-left">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-info" />
                  <span className="text-sm text-white">Security</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
            </div>
          </div>

          {/* Current Config */}
          <div className="card p-6 bg-gradient-to-br from-primary/5 to-accent/5">
            <h3 className="font-semibold text-white mb-4">Current Configuration</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Trading Mode</span>
                <span className={`text-sm font-medium ${tradingMode === 'paper' ? 'text-primary' : 'text-secondary'}`}>
                  {tradingMode === 'paper' ? 'Paper' : 'Live'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">AI Provider</span>
                <span className="text-sm font-medium text-white capitalize">{llmProvider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">API Key</span>
                <span className="text-sm font-medium text-white">
                  {apiKey ? '••••••••' : 'Not set'}
                </span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-5 h-5" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}