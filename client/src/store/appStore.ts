import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

const openaiModels = {
  quick: [{ id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', cost: 'Paid' }, { id: 'gpt-4.1', name: 'GPT-4.1', cost: 'Paid' }],
  deep: [{ id: 'gpt-5.4', name: 'GPT-5.4', cost: 'Paid' }, { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', cost: 'Paid' }]
};

const anthropicModels = {
  quick: [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', cost: 'Paid' }, { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', cost: 'Paid' }],
  deep: [{ id: 'claude-opus-4-6', name: 'Claude Opus 4.6', cost: 'Paid' }, { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', cost: 'Paid' }]
};

const googleModels = {
  quick: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', cost: 'Paid' }, { id: 'gemini-3-flash', name: 'Gemini 3 Flash', cost: 'Paid' }],
  deep: [{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', cost: 'Paid' }, { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', cost: 'Paid' }]
};

const deepseekModels = {
  quick: [{ id: 'deepseek-chat', name: 'DeepSeek V3', cost: 'Paid' }],
  deep: [{ id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', cost: 'Paid' }, { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', cost: 'Paid' }]
};

export const modelOptions: Record<string, typeof opencodeModels> = {
  opencode: opencodeModels, openai: openaiModels, anthropic: anthropicModels, google: googleModels, deepseek: deepseekModels,
};

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
  stopLoss: number;
  takeProfit: number;
  closedTrades: number;
  winningTrades: number;
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

  walletBalance: number;
  setWalletBalance: (b: number) => void;

  bots: Bot[];
  createBot: (config: { name: string; symbols: string[]; allocationType: 'percentage' | 'fixed'; allocationValue: number; stopLoss: number; takeProfit: number }) => void;
  deleteBot: (id: string) => void;
  startBot: (id: string) => void;
  stopBot: (id: string) => void;
  addPosition: (botId: string, pos: Omit<Position, 'id' | 'openedAt'>) => void;
  closePosition: (botId: string, posId: string, closePrice: number, status?: 'closed' | 'sl' | 'tp' | 'stopped') => void;
  closeAllPositions: (botId: string, prices: Record<string, number>) => void;
  updatePositionSLTP: (botId: string, posId: string, sl?: number, tp?: number) => void;
  updateBotSLTP: (botId: string, sl: number, tp: number) => void;
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

      walletBalance: 10000,
      setWalletBalance: (walletBalance) => set({ walletBalance }),

      bots: [],

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
          status: 'stopped',
          positions: [],
          closedPositions: [],
          totalPnl: 0,
          stopLoss: config.stopLoss,
          takeProfit: config.takeProfit,
          closedTrades: 0,
          winningTrades: 0,
        };
        set({ bots: [...get().bots, bot] });
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
        const closedPos: ClosedPosition = {
          id: genId(),
          symbol: pos.symbol, type: pos.type, quantity: pos.quantity,
          entryPrice: pos.entryPrice, exitPrice: closePrice,
          stopLoss: pos.stopLoss, takeProfit: pos.takeProfit,
          openedAt: pos.openedAt, closedAt: new Date().toISOString(),
          pnl, pnlPct, fee, status,
        };
        set({
          walletBalance: state.walletBalance + pnl - fee,
          bots: state.bots.map(b => b.id === botId ? {
            ...b,
            positions: b.positions.filter(p => p.id !== posId),
            closedPositions: [...b.closedPositions, closedPos],
            totalPnl: b.totalPnl + pnl - fee,
            closedTrades: b.closedTrades + 1,
            winningTrades: b.winningTrades + (pnl - fee > 0 ? 1 : 0),
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

      updateBotSLTP: (botId, sl, tp) => {
        set({
          bots: get().bots.map(b => b.id === botId ? { ...b, stopLoss: sl, takeProfit: tp } : b),
        });
      },
    }),
    {
      name: 'trade4u-settings',
      partialize: (state) => ({
        llmProvider: state.llmProvider,
        apiKey: state.apiKey,
        deepModel: state.deepModel,
        quickModel: state.quickModel,
        walletBalance: state.walletBalance,
        bots: state.bots,
      }),
    }
  )
);
