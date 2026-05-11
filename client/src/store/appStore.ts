import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

const opencodeModels = {
  quick: [
    { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', cost: 'Free' },
    { id: 'big-pickle', name: 'Big Pickle', cost: 'Free' },
    { id: 'ring-2.6-1t-free', name: 'Ring 2.6 1T Free', cost: 'Free' },
    { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', cost: 'Free' },
  ],
  deep: [
    { id: 'minimax-m2.7', name: 'MiniMax M2.7', cost: 'Free' },
    { id: 'minimax-m2.5', name: 'MiniMax M2.5', cost: 'Free' },
  ]
};

const openaiModels = {
  quick: [
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', cost: 'Paid' },
    { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', cost: 'Paid' },
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
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', cost: 'Paid' },
  ],
  deep: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', cost: 'Paid' },
  ]
};

const deepseekModels = {
  quick: [
    { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', cost: 'Paid' },
    { id: 'deepseek-chat', name: 'DeepSeek V3.2', cost: 'Paid' },
  ],
  deep: [
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', cost: 'Paid' },
    { id: 'deepseek-reasoner', name: 'DeepSeek V3.2 (Reasoning)', cost: 'Paid' },
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

  // Settings
  llmProvider: string;
  apiKey: string;
  deepModel: string;
  quickModel: string;
  setLlmProvider: (provider: string) => void;
  setApiKey: (key: string) => void;
  setDeepModel: (model: string) => void;
  setQuickModel: (model: string) => void;

  // Logout
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),

      balance: 100000,
      tradingMode: 'paper',
      setBalance: (balance) => set({ balance }),
      setTradingMode: (tradingMode) => set({ tradingMode }),

      llmProvider: 'opencode',
      apiKey: '',
      deepModel: 'minimax-m2.5',
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
      }),
    }
  )
);