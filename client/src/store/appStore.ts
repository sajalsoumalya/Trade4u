import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Client-side state is limited to UI preferences and transient engine logs.
 *
 * Bots, positions and balances are owned by the server (SQLite) and read
 * through `useTrading`. They used to be mirrored here as well, which meant the
 * numbers on screen and the numbers in the database drifted apart for good.
 */

export interface Position {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: string;
}

export interface ClosedPosition {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: string;
  closedAt: string;
  pnl: number;
  pnlPct: number;
  fee: number;
  status: 'closed' | 'sl' | 'tp' | 'stopped';
}

export interface Bot {
  id: string;
  name: string;
  createdAt: string;
  symbols: string[];
  allocationType: 'percentage' | 'fixed';
  allocationValue: number;
  frozenAmount: number;
  status: 'running' | 'stopped';
  positions: Position[];
  closedPositions: ClosedPosition[];
  totalPnl: number;
  stopLoss?: number;
  takeProfit?: number;
  interval: number;
  closedTrades: number;
  winningTrades: number;
  engineError?: string;
  botProvider?: string;
  botQuickModel?: string;
  botDeepModel?: string;
  engineRunning?: boolean;
}

interface AppState {
  llmProvider: string;
  apiKey: string;
  deepModel: string;
  quickModel: string;
  setLlmProvider: (p: string) => void;
  setApiKey: (k: string) => void;
  setDeepModel: (m: string) => void;
  setQuickModel: (m: string) => void;
  fallbackProvider: string;
  fallbackApiKey: string;
  fallbackDeepModel: string;
  fallbackQuickModel: string;
  setFallbackProvider: (p: string) => void;
  setFallbackApiKey: (k: string) => void;
  setFallbackDeepModel: (m: string) => void;
  setFallbackQuickModel: (m: string) => void;

  /** Live engine output per bot, capped and never persisted to the server. */
  botLogs: Record<string, any[]>;
  addBotLog: (botId: string, log: any) => void;
  /** Last engine error seen per bot, surfaced on the bot detail view. */
  engineErrors: Record<string, string>;
  setEngineError: (botId: string, msg: string) => void;
  clearEngineError: (botId: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      llmProvider: 'opencode',
      apiKey: '',
      deepModel: 'minimax-m2.5-free',
      quickModel: 'minimax-m2.5-free',
      setLlmProvider: (llmProvider) => set({ llmProvider }),
      setApiKey: (apiKey) => set({ apiKey }),
      setDeepModel: (deepModel) => set({ deepModel }),
      setQuickModel: (quickModel) => set({ quickModel }),
      fallbackProvider: 'opencode',
      fallbackApiKey: '',
      fallbackDeepModel: 'minimax-m2.5-free',
      fallbackQuickModel: 'minimax-m2.5-free',
      setFallbackProvider: (fallbackProvider) => set({ fallbackProvider }),
      setFallbackApiKey: (fallbackApiKey) => set({ fallbackApiKey }),
      setFallbackDeepModel: (fallbackDeepModel) => set({ fallbackDeepModel }),
      setFallbackQuickModel: (fallbackQuickModel) => set({ fallbackQuickModel }),

      botLogs: {},
      addBotLog: (botId, log) => {
        const logs = get().botLogs;
        const prev = logs[botId] || [];
        const updated = [...prev, { ...log, receivedAt: Date.now() }].slice(-200);
        set({ botLogs: { ...logs, [botId]: updated } });
      },

      engineErrors: {},
      setEngineError: (botId, msg) =>
        set({ engineErrors: { ...get().engineErrors, [botId]: msg } }),
      clearEngineError: (botId) => {
        const { [botId]: _removed, ...rest } = get().engineErrors;
        set({ engineErrors: rest });
      },
    }),
    {
      name: 'trade4u-settings',
      partialize: (state) => ({
        llmProvider: state.llmProvider,
        apiKey: state.apiKey,
        deepModel: state.deepModel,
        quickModel: state.quickModel,
        fallbackProvider: state.fallbackProvider,
        fallbackApiKey: state.fallbackApiKey,
        fallbackDeepModel: state.fallbackDeepModel,
        fallbackQuickModel: state.fallbackQuickModel,
        botLogs: state.botLogs,
      }),
    }
  )
);
