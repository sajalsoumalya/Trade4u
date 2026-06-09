import { create } from 'zustand';
import { persist } from 'zustand/middleware';


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

  walletBalance: number;
  setWalletBalance: (b: number) => void;

  bots: Bot[];
  createBot: (config: { name: string; symbols: string[]; allocationType: 'percentage' | 'fixed'; allocationValue: number; stopLoss?: number; takeProfit?: number; interval: number; botProvider?: string; botQuickModel?: string; botDeepModel?: string }) => void;
  deleteBot: (id: string) => void;
  startBot: (id: string) => void;
  stopBot: (id: string) => void;
  addPosition: (botId: string, pos: Omit<Position, 'id' | 'openedAt'>) => void;
  closePosition: (botId: string, posId: string, closePrice: number, status?: 'closed' | 'sl' | 'tp' | 'stopped') => void;
  closeAllPositions: (botId: string, prices: Record<string, number>) => void;
  updatePositionSLTP: (botId: string, posId: string, sl?: number, tp?: number) => void;
  updateBot: (id: string, changes: Partial<Bot>) => void;
  updateBotSLTP: (botId: string, sl: number, tp: number) => void;
  applyGlobalLlmToAllBots: (provider: string, quickModel: string, deepModel: string) => void;
  botLogs: Record<string, any[]>;
  addBotLog: (botId: string, log: any) => void;
}

function calcFrozen(walletBalance: number, type: 'percentage' | 'fixed', value: number): number {
  if (type === 'percentage') return Math.round(walletBalance * (value / 100));
  return Math.min(value, walletBalance);
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
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

      walletBalance: 100000,
      setWalletBalance: (walletBalance) => set({ walletBalance }),

      bots: [],
      botLogs: {},

      createBot: (config) => {
        const frozen = calcFrozen(get().walletBalance, config.allocationType, config.allocationValue);
        if (frozen <= 0) return;
        const bot: Bot = {
          id: genId(),
          name: config.name,
          createdAt: new Date().toISOString(),
          symbols: config.symbols,
          allocationType: config.allocationType,
          allocationValue: config.allocationValue,
          frozenAmount: frozen,
          status: 'running',
          positions: [],
          closedPositions: [],
          totalPnl: 0,
          stopLoss: config.stopLoss,
          takeProfit: config.takeProfit,
          interval: config.interval || 5,
          closedTrades: 0,
          winningTrades: 0,
          botProvider: config.botProvider,
          botQuickModel: config.botQuickModel,
          botDeepModel: config.botDeepModel,
        };
        set({
          walletBalance: get().walletBalance - frozen,
          bots: [...get().bots, bot],
        });
      },

      deleteBot: (id) => {
        const bot = get().bots.find(b => b.id === id);
        if (!bot) return;
        const refund = bot.frozenAmount;
        set({
          walletBalance: get().walletBalance + refund,
          bots: get().bots.filter(b => b.id !== id),
        });
      },

      startBot: (id) => {
        const state = get();
        const bot = state.bots.find(b => b.id === id);
        if (!bot || bot.status === 'running') return;
        const frozen = calcFrozen(state.walletBalance, bot.allocationType, bot.allocationValue);
        if (frozen <= 0) return;
        set({
          walletBalance: state.walletBalance - frozen,
          bots: state.bots.map(b => b.id === id ? { ...b, status: 'running', frozenAmount: frozen } : b),
        });
      },

      stopBot: (id) => {
        const state = get();
        const bot = state.bots.find(b => b.id === id);
        if (!bot) return;
        const newClosed: ClosedPosition[] = bot.positions.map(pos => ({
          id: genId(), symbol: pos.symbol, type: pos.type, quantity: pos.quantity,
          entryPrice: pos.entryPrice, exitPrice: pos.entryPrice,
          stopLoss: pos.stopLoss, takeProfit: pos.takeProfit,
          openedAt: pos.openedAt, closedAt: new Date().toISOString(),
          pnl: 0, pnlPct: 0, fee: 0, status: 'stopped',
        }));
        set({
          walletBalance: state.walletBalance + bot.frozenAmount,
          bots: state.bots.map(b => b.id === id ? {
            ...b, status: 'stopped', frozenAmount: 0, positions: [],
            closedPositions: [...b.closedPositions, ...newClosed],
            closedTrades: b.closedTrades + newClosed.length,
          } : b),
        });
      },

      addPosition: (botId, pos) => {
        set({
          bots: get().bots.map(b => b.id === botId ? {
            ...b,
            positions: [...b.positions, { ...pos, id: genId(), openedAt: new Date().toISOString() }],
          } : b),
        });
      },

      closePosition: (botId, posId, closePrice, status) => {
        const state = get();
        const bot = state.bots.find(b => b.id === botId);
        if (!bot) return;
        const pos = bot.positions.find(p => p.id === posId);
        if (!pos) return;
        if (!status && pos.stopLoss) {
          const slPrice = pos.type === 'buy' ? pos.entryPrice * (1 - pos.stopLoss / 100) : pos.entryPrice * (1 + pos.stopLoss / 100);
          if (pos.type === 'buy' ? closePrice <= slPrice : closePrice >= slPrice) status = 'sl';
        }
        if (!status && pos.takeProfit) {
          const tpPrice = pos.type === 'buy' ? pos.entryPrice * (1 + pos.takeProfit / 100) : pos.entryPrice * (1 - pos.takeProfit / 100);
          if (pos.type === 'buy' ? closePrice >= tpPrice : closePrice <= tpPrice) status = 'tp';
        }
        status = status || 'closed';
        const pnl = pos.type === 'sell' ? (pos.entryPrice - closePrice) * pos.quantity : (closePrice - pos.entryPrice) * pos.quantity;
        const pnlPct = ((closePrice - pos.entryPrice) / pos.entryPrice) * 100 * (pos.type === 'sell' ? -1 : 1);
        const fee = Math.round(pos.quantity * pos.entryPrice * 0.001 * 100) / 100;
        const netPnl = pnl - fee;
        const closedPos: ClosedPosition = {
          id: genId(),
          symbol: pos.symbol, type: pos.type, quantity: pos.quantity,
          entryPrice: pos.entryPrice, exitPrice: closePrice,
          stopLoss: pos.stopLoss, takeProfit: pos.takeProfit,
          openedAt: pos.openedAt, closedAt: new Date().toISOString(),
          pnl: netPnl, pnlPct, fee, status,
        };
        set({
          walletBalance: state.walletBalance + netPnl,
          bots: state.bots.map(b => b.id === botId ? {
            ...b,
            positions: b.positions.filter(p => p.id !== posId),
            closedPositions: [...b.closedPositions, closedPos],
            totalPnl: b.totalPnl + netPnl,
            closedTrades: b.closedTrades + 1,
            winningTrades: b.winningTrades + (netPnl > 0 ? 1 : 0),
            frozenAmount: b.frozenAmount,
          } : b),
        });
      },

      closeAllPositions: (botId, prices) => {
        const state = get();
        const bot = state.bots.find(b => b.id === botId);
        if (!bot) return;
        let totalPnl = 0;
        const newClosed: ClosedPosition[] = [];
        bot.positions.forEach(pos => {
          const cp = prices[pos.symbol] || pos.entryPrice;
          const pnl = pos.type === 'sell' ? (pos.entryPrice - cp) * pos.quantity : (cp - pos.entryPrice) * pos.quantity;
          const pnlPct = ((cp - pos.entryPrice) / pos.entryPrice) * 100 * (pos.type === 'sell' ? -1 : 1);
          const fee = Math.round(pos.quantity * pos.entryPrice * 0.001 * 100) / 100;
          totalPnl += pnl - fee;
          newClosed.push({
            id: genId(), symbol: pos.symbol, type: pos.type, quantity: pos.quantity,
            entryPrice: pos.entryPrice, exitPrice: cp,
            stopLoss: pos.stopLoss, takeProfit: pos.takeProfit,
            openedAt: pos.openedAt, closedAt: new Date().toISOString(),
            pnl: pnl - fee, pnlPct, fee, status: 'closed',
          });
        });
        set({
          walletBalance: state.walletBalance + totalPnl,
          bots: state.bots.map(b => b.id === botId ? {
            ...b,
            positions: [],
            closedPositions: [...b.closedPositions, ...newClosed],
            totalPnl: b.totalPnl + totalPnl,
            closedTrades: b.closedTrades + bot.positions.length,
            winningTrades: b.winningTrades + newClosed.filter(c => c.pnl > 0).length,
            frozenAmount: b.frozenAmount,
          } : b),
        });
      },

      updatePositionSLTP: (botId, posId, sl, tp) => {
        set({
          bots: get().bots.map(b => b.id === botId ? {
            ...b,
            positions: b.positions.map(p => p.id === posId ? { ...p, stopLoss: sl, takeProfit: tp } : p),
          } : b),
        });
      },

      updateBot: (id, changes) => {
        set(state => {
          const bot = state.bots.find(b => b.id === id);
          if (!bot) return state;
          let updatedBot = { ...bot, ...changes };
          if (changes.allocationValue !== undefined || changes.allocationType !== undefined) {
            const newType = changes.allocationType ?? bot.allocationType;
            const newValue = changes.allocationValue ?? bot.allocationValue;
            const prevFrozen = bot.frozenAmount;
            const newFrozen = calcFrozen(state.walletBalance + prevFrozen, newType, newValue);
            updatedBot.frozenAmount = newFrozen;
            return {
              walletBalance: state.walletBalance + prevFrozen - newFrozen,
              bots: state.bots.map(b => b.id === id ? updatedBot : b),
            };
          }
          return { bots: state.bots.map(b => b.id === id ? updatedBot : b) };
        });
      },

      updateBotSLTP: (botId, sl, tp) => {
        set({
          bots: get().bots.map(b => b.id === botId ? { ...b, stopLoss: sl, takeProfit: tp } : b),
        });
      },

      applyGlobalLlmToAllBots: (provider, quickModel, deepModel) => {
        set({
          bots: get().bots.map(b => ({ ...b, botProvider: provider, botQuickModel: quickModel, botDeepModel: deepModel })),
        });
      },

      addBotLog: (botId, log) => {
        const logs = get().botLogs;
        const prev = logs[botId] || [];
        const updated = [...prev, { ...log, receivedAt: Date.now() }].slice(-200);
        set({ botLogs: { ...logs, [botId]: updated } });
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
        walletBalance: state.walletBalance,
        bots: state.bots,
        botLogs: state.botLogs,
      }),
    }
  )
);
