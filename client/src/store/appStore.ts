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
    { id: 'big-pickle', name: 'Big Pickle', cost: 'Free' },
    { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', cost: 'Free' },
    { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', cost: 'Free' },
    { id: 'ring-2.6-1t-free', name: 'Ring 2.6 1T Free', cost: 'Free' },
    { id: 'trinity-large-preview-free', name: 'Trinity Large Preview Free', cost: 'Free' },
  ],
  deep: [
    { id: 'minimax-m2.7', name: 'MiniMax M2.7', cost: 'Free' },
    { id: 'minimax-m2.5', name: 'MiniMax M2.5', cost: 'Free' },
    { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', cost: 'Free' },
    { id: 'big-pickle', name: 'Big Pickle', cost: 'Free' },
    { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', cost: 'Free' },
    { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', cost: 'Free' },
    { id: 'ring-2.6-1t-free', name: 'Ring 2.6 1T Free', cost: 'Free' },
    { id: 'trinity-large-preview-free', name: 'Trinity Large Preview Free', cost: 'Free' },
  ]
};

// Paid models (require API key)
const openaiModels = {
  quick: [
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', cost: 'Paid' },
  ],
  deep: [
    { id: 'gpt-5.4', name: 'GPT-5.4', cost: 'Paid' },
  ]
};

const anthropicModels = {
  quick: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', cost: 'Paid' },
  ],
  deep: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', cost: 'Paid' },
  ]
};

const googleModels = {
  quick: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', cost: 'Paid' },
  ],
  deep: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', cost: 'Paid' },
  ]
};

const deepseekModels = {
  quick: [
    { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', cost: 'Paid' },
  ],
  deep: [
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', cost: 'Paid' },
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

  balance: number;
  tradingMode: 'paper' | 'live';
  setBalance: (balance: number) => void;
  setTradingMode: (mode: 'paper' | 'live') => void;

  // Only OpenCode uses free models (configured in Coolify env vars)
  // Paid providers use server-side API keys from Coolify
  llmProvider: string;
  deepModel: string;
  quickModel: string;
  setLlmProvider: (provider: string) => void;
  setDeepModel: (model: string) => void;
  setQuickModel: (model: string) => void;

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
      deepModel: 'minimax-m2.7',
      quickModel: 'minimax-m2.5-free',
      setLlmProvider: (llmProvider) => set({ llmProvider }),
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
        deepModel: state.deepModel,
        quickModel: state.quickModel,
      }),
    }
  )
);