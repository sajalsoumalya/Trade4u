import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

// OpenCode free models only
const opencodeModels = {
  quick: [
    { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', cost: 'Free' },
    { id: 'ring-2.6-1t-free', name: 'Ring 2.6 1T Free', cost: 'Free' },
    { id: 'trinity-large-preview-free', name: 'Trinity Large Preview Free', cost: 'Free' },
    { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', cost: 'Free' },
  ],
  deep: [
    { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', cost: 'Free' },
    { id: 'ring-2.6-1t-free', name: 'Ring 2.6 1T Free', cost: 'Free' },
    { id: 'trinity-large-preview-free', name: 'Trinity Large Preview Free', cost: 'Free' },
    { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', cost: 'Free' },
  ]
};

// Paid models (require API key)
const openaiModels = {
  quick: [
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', cost: 'Paid' },
    { id: 'gpt-4.1', name: 'GPT-4.1', cost: 'Paid' },
  ],
  deep: [
    { id: 'gpt-5.4', name: 'GPT-5.4', cost: 'Paid' },
    { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', cost: 'Paid' },
  ]
};

const anthropicModels = {
  quick: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', cost: 'Paid' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', cost: 'Paid' },
  ],
  deep: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', cost: 'Paid' },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', cost: 'Paid' },
  ]
};

const googleModels = {
  quick: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', cost: 'Paid' },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', cost: 'Paid' },
  ],
  deep: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', cost: 'Paid' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', cost: 'Paid' },
  ]
};

const deepseekModels = {
  quick: [
    { id: 'deepseek-chat', name: 'DeepSeek V3', cost: 'Paid' },
  ],
  deep: [
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', cost: 'Paid' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', cost: 'Paid' },
  ]
};

export const modelOptions: Record<string, typeof opencodeModels> = {
  opencode: opencodeModels,
  openai: openaiModels,
  anthropic: anthropicModels,
  google: googleModels,
  deepseek: deepseekModels,
};

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;

  // Trading
  balance: number;
  tradingMode: 'paper' | 'live';
  setBalance: (balance: number) => void;
  setTradingMode: (mode: 'paper' | 'live') => void;

  // Wallet & AI Trading
  walletBalance: number;
  aiTradingEnabled: boolean;
  aiTradingPercent: number;
  aiSymbols: string[];
  aiStopLoss: number;
  aiTakeProfit: number;
  setWalletBalance: (balance: number) => void;
  setAiTradingEnabled: (enabled: boolean) => void;
  setAiTradingPercent: (percent: number) => void;
  setAiSymbols: (symbols: string[]) => void;
  setAiStopLoss: (percent: number) => void;
  setAiTakeProfit: (percent: number) => void;

  // AI Settings
  llmProvider: string;
  apiKey: string;
  deepModel: string;
  quickModel: string;
  setLlmProvider: (provider: string) => void;
  setApiKey: (key: string) => void;
  setDeepModel: (model: string) => void;
  setQuickModel: (model: string) => void;

  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),

      // Trading
      balance: 100000,
      tradingMode: 'paper',
      setBalance: (balance) => set({ balance }),
      setTradingMode: (tradingMode) => set({ tradingMode }),

      // Wallet & AI Trading
      walletBalance: 10000,
      aiTradingEnabled: false,
      aiTradingPercent: 10, // 10% of wallet for AI trading
      aiSymbols: ['BTCUSDT', 'ETHUSDT'],
      aiStopLoss: 2,
      aiTakeProfit: 5,
      setWalletBalance: (walletBalance) => set({ walletBalance }),
      setAiTradingEnabled: (aiTradingEnabled) => set({ aiTradingEnabled }),
      setAiTradingPercent: (aiTradingPercent) => set({ aiTradingPercent }),
      setAiSymbols: (aiSymbols) => set({ aiSymbols }),
      setAiStopLoss: (aiStopLoss) => set({ aiStopLoss }),
      setAiTakeProfit: (aiTakeProfit) => set({ aiTakeProfit }),

      // AI Settings
      llmProvider: 'opencode',
      apiKey: '',
      deepModel: 'minimax-m2.5-free',
      quickModel: 'minimax-m2.5-free',
      setLlmProvider: (llmProvider) => set({ llmProvider }),
      setApiKey: (apiKey) => set({ apiKey }),
      setDeepModel: (deepModel) => set({ deepModel }),
      setQuickModel: (quickModel) => set({ quickModel }),

      logout: () => {
        localStorage.removeItem('firebaseToken');
        localStorage.removeItem('userUid');
        set({
          user: null,
          balance: 100000,
          tradingMode: 'paper'
        });
      }
    }),
    {
      name: 'trade4u-settings',
      partialize: (state) => ({
        tradingMode: state.tradingMode,
        llmProvider: state.llmProvider,
        apiKey: state.apiKey,
        deepModel: state.deepModel,
        quickModel: state.quickModel,
        walletBalance: state.walletBalance,
        aiTradingEnabled: state.aiTradingEnabled,
        aiTradingPercent: state.aiTradingPercent,
        aiSymbols: state.aiSymbols,
        aiStopLoss: state.aiStopLoss,
        aiTakeProfit: state.aiTakeProfit,
      }),
    }
  )
);