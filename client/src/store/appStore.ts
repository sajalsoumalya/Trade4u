import { create } from 'zustand';

interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

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
  setLlmProvider: (provider: string) => void;
  setApiKey: (key: string) => void;

  // Logout
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  balance: 100000,
  tradingMode: 'paper',
  setBalance: (balance) => set({ balance }),
  setTradingMode: (tradingMode) => set({ tradingMode }),

  llmProvider: 'opencode',
  apiKey: '',
  setLlmProvider: (llmProvider) => set({ llmProvider }),
  setApiKey: (apiKey) => set({ apiKey }),

  logout: () => {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userUid');
    set({
      user: null,
      balance: 100000,
      tradingMode: 'paper'
    });
  }
}));