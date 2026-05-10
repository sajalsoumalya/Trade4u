import { useState } from 'react';
import { useAppStore } from '../store/appStore';

export default function Settings() {
  const { llmProvider, apiKey, setLlmProvider, setApiKey, tradingMode, setTradingMode } = useAppStore();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // In a real app, save to backend/Firebase
    await new Promise(r => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Trading Mode */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Trading Mode</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setTradingMode('paper')}
            className={`flex-1 p-4 rounded-lg border ${
              tradingMode === 'paper'
                ? 'border-primary bg-primary/10'
                : 'border-border'
            }`}
          >
            <p className="font-medium">Paper Trading</p>
            <p className="text-sm text-gray-400">Practice with $100k virtual money</p>
          </button>
          <button
            onClick={() => setTradingMode('live')}
            className={`flex-1 p-4 rounded-lg border ${
              tradingMode === 'live'
                ? 'border-secondary bg-secondary/10'
                : 'border-border'
            }`}
          >
            <p className="font-medium text-secondary">Live Trading</p>
            <p className="text-sm text-gray-400">Connect to real broker</p>
          </button>
        </div>
      </div>

      {/* LLM Provider */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">AI Analysis</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">LLM Provider</label>
            <select
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              className="input w-full"
            >
              <option value="opencode">OpenCode (Free)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input w-full"
              placeholder="Enter API key"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from {llmProvider === 'opencode' ? 'https://opencode.ai/settings' : 'their website'}
            </p>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">About</h2>
        <div className="space-y-2 text-gray-400 text-sm">
          <p>Trade4u - AI-Powered Trading Platform</p>
          <p>Version: 1.0.0</p>
          <p>Powered by TradingAgents AI</p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full btn-primary"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}