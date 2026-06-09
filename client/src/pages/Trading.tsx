import { useState, useEffect, useRef } from 'react';
import { useAppStore, Bot } from '../store/appStore';
import { fetchCryptoPrices, startBotEngine, stopBotEngine, fetchBinanceSymbols } from '../lib/api';
import { io } from 'socket.io-client';
import { useToast } from '../components/Toast';
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { TradingStats } from '../components/trading/TradingStats';
import { BotListTable } from '../components/trading/BotListTable';
import { CreateBotForm } from '../components/trading/CreateBotForm';
import { BotDetailView } from '../components/trading/BotDetailView';

const DEFAULT_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
const PAIR_NAMES: Record<string, string> = {
  BTCUSDT: 'BTC',
  ETHUSDT: 'ETH',
  SOLUSDT: 'SOL',
  BNBUSDT: 'BNB',
  XRPUSDT: 'XRP',
  ADAUSDT: 'ADA',
  DOGEUSDT: 'DOGE',
};

export default function Trading() {
  const {
    bots,
    walletBalance,
    createBot,
    deleteBot,
    startBot,
    stopBot,
    closePosition,
    closeAllPositions,
    addPosition,
    updatePositionSLTP,
    updateBotSLTP,
    updateBot,
    botLogs,
    addBotLog,
    llmProvider,
    quickModel,
    deepModel,
  } = useAppStore();

  const [prices, setPrices] = useState<Record<string, any>>({});
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  const { addToast } = useToast();
  const socketRef = useRef<any>(null);

  // Fetch full symbols list dynamically from Binance API
  const { data: allPairs = DEFAULT_PAIRS } = useQuery({
    queryKey: ['binanceSymbols'],
    queryFn: fetchBinanceSymbols,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const selectedBot = bots.find(b => b.id === selectedBotId) || null;

  // Filter prices to fetch only for active bots and default pairs to prevent API rate limits
  const activePairs = Array.from(new Set([
    ...bots.flatMap(b => b.symbols),
    ...(selectedBot ? selectedBot.symbols : []),
    ...DEFAULT_PAIRS
  ]));

  useEffect(() => {
    loadPrices();
    const interval = setInterval(loadPrices, 30000);
    return () => clearInterval(interval);
  }, [activePairs.join(',')]);

  // Re-spawn AI engine for existing running bots after page refresh exactly once on mount
  useEffect(() => {
    bots.forEach(bot => {
      if (bot.status === 'running') {
        const provider = bot.botProvider || llmProvider || 'opencode';
        const qModel = bot.botQuickModel || quickModel || 'minimax-m2.5-free';
        const dModel = bot.botDeepModel || deepModel || 'minimax-m2.5-free';
        stopBotEngine(bot.id).then(() => {
          startBotEngine(bot.id, bot.symbols, bot.stopLoss, bot.takeProfit, bot.interval, provider, qModel, dModel);
        });
      }
    });
  }, []);

  // Socket.IO for AI engine signals
  useEffect(() => {
    const socket = io({ path: '/api/socket.io' });
    socketRef.current = socket;

    bots.forEach(bot => {
      socket.on(`bot:${bot.id}:trade`, (signal: any) => {
        if (signal.action === 'buy' && signal.price) {
          addPosition(bot.id, {
            symbol: signal.symbol,
            type: 'buy',
            quantity: 0.001,
            entryPrice: signal.price,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
          });
          addToast('success', `${bot.name}: Bought ${signal.symbol} @ $${signal.price.toFixed(2)}`);
        } else if (signal.action === 'sell') {
          const liveBot = useAppStore.getState().bots.find(b => b.id === bot.id);
          const pos = liveBot?.positions.find(p => p.symbol === signal.symbol);
          if (pos) {
            closePosition(bot.id, pos.id, signal.price);
            addToast('info', `${bot.name}: Sold ${signal.symbol} @ $${signal.price.toFixed(2)}`);
          }
        }
      });

      // AI can dynamically update SL/TP per position
      socket.on(`bot:${bot.id}:update_sltp`, (data: any) => {
        const liveBot = useAppStore.getState().bots.find(b => b.id === bot.id);
        const pos = liveBot?.positions.find(p => p.symbol === data.symbol);
        if (pos && (data.stopLoss !== undefined || data.takeProfit !== undefined)) {
          updatePositionSLTP(bot.id, pos.id, data.stopLoss, data.takeProfit);
          addToast('info', `${bot.name}: SL/TP updated for ${data.symbol}`);
        }
      });

      socket.on(`bot:${bot.id}:status`, (status: any) => {
        if (status.running) {
          addToast('success', `${bot.name}: AI engine started`);
        } else if (status.error) {
          addToast('error', `${bot.name}: Engine error — ${status.error}`);
          updateBot(bot.id, { engineError: status.error });
        } else {
          addToast('warning', `${bot.name}: AI engine stopped`);
        }
      });

      // Collect decision engine logs
      socket.on(`bot:${bot.id}:log`, (log: any) => {
        addBotLog(bot.id, log);
      });

      // Forward Python stderr errors to the store
      socket.on(`bot:${bot.id}:engineError`, (msg: string) => {
        updateBot(bot.id, { engineError: msg });
        addToast('error', `${bot.name}: ${msg}`);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [bots.map(b => b.id).join(',')]);

  const loadPrices = async () => {
    try {
      const data = await fetchCryptoPrices(activePairs);
      const map: Record<string, any> = {};
      data.forEach((d: any) => {
        map[d.symbol] = d;
      });
      setPrices(map);

      // Auto-close positions when SL or TP is hit
      bots.forEach(bot => {
        if (bot.status !== 'running') return;
        bot.positions.forEach(pos => {
          const cp = map[pos.symbol]?.price;
          if (!cp) return;
          if (pos.stopLoss) {
            const slHit =
              pos.type === 'buy'
                ? cp <= pos.entryPrice * (1 - pos.stopLoss / 100)
                : cp >= pos.entryPrice * (1 + pos.stopLoss / 100);
            if (slHit) {
              closePosition(bot.id, pos.id, cp, 'sl');
              addToast('error', `${bot.name}: SL hit ${pos.symbol} @ $${cp.toFixed(2)}`);
              return;
            }
          }
          if (pos.takeProfit) {
            const tpHit =
              pos.type === 'buy'
                ? cp >= pos.entryPrice * (1 + pos.takeProfit / 100)
                : cp <= pos.entryPrice * (1 - pos.takeProfit / 100);
            if (tpHit) {
              closePosition(bot.id, pos.id, cp, 'tp');
              addToast('success', `${bot.name}: TP hit ${pos.symbol} @ $${cp.toFixed(2)}`);
              return;
            }
          }
        });
      });
    } catch {}
  };



  const totalInvested = bots.reduce((s, b) => s + b.frozenAmount, 0);
  const totalPnl = bots.reduce((s, b) => s + b.totalPnl, 0);
  const activeBots = bots.filter(b => b.status === 'running').length;
  const totalTrades = bots.reduce((s, b) => s + b.closedTrades, 0);
  const winRate =
    totalTrades > 0
      ? ((bots.reduce((s, b) => s + b.winningTrades, 0) / totalTrades) * 100).toFixed(1)
      : '0.0';

  const handleStartBotEngine = (id: string) => {
    startBot(id);
    const target = bots.find(b => b.id === id);
    if (target) {
      const provider = target.botProvider || llmProvider || 'opencode';
      const qModel = target.botQuickModel || quickModel || 'minimax-m2.5-free';
      const dModel = target.botDeepModel || deepModel || 'minimax-m2.5-free';
      startBotEngine(
        target.id,
        target.symbols,
        target.stopLoss,
        target.takeProfit,
        target.interval,
        provider,
        qModel,
        dModel
      );
    }
  };

  const handleStopBotEngine = (id: string) => {
    stopBot(id);
    stopBotEngine(id);
  };

  const handleDeleteBot = (id: string) => {
    if (confirm('Are you sure you want to delete this bot instance?')) {
      deleteBot(id);
      if (selectedBotId === id) {
        setSelectedBotId(null);
        setView('list');
      }
    }
  };

  const handleCreateBot = (config: {
    name: string;
    symbols: string[];
    allocationType: 'percentage' | 'fixed';
    allocationValue: number;
    stopLoss?: number;
    takeProfit?: number;
    interval: number;
  }) => {
    const provider = llmProvider || 'opencode';
    const qModel = quickModel || 'minimax-m2.5-free';
    const dModel = deepModel || 'minimax-m2.5-free';

    createBot({
      ...config,
      botProvider: provider,
      botQuickModel: qModel,
      botDeepModel: dModel,
    });

    const state = useAppStore.getState();
    const newBot = state.bots[state.bots.length - 1];
    if (newBot) {
      startBotEngine(
        newBot.id,
        newBot.symbols,
        newBot.stopLoss,
        newBot.takeProfit,
        newBot.interval,
        provider,
        qModel,
        dModel
      );
    }

    addToast('success', `Bot "${config.name}" successfully created.`);
    setView('list');
  };

  if (view === 'create') {
    return (
      <CreateBotForm
        allPairs={allPairs}
        pairNames={PAIR_NAMES}
        walletBalance={walletBalance}
        prices={prices}
        onCreateBot={handleCreateBot}
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'detail' && selectedBot) {
    return (
      <BotDetailView
        bot={selectedBot}
        prices={prices}
        pairNames={PAIR_NAMES}
        allPairs={allPairs}
        logs={botLogs[selectedBot.id] || []}
        walletBalance={walletBalance}
        onBack={() => {
          setSelectedBotId(null);
          setView('list');
        }}
        onStartBot={handleStartBotEngine}
        onStopBot={handleStopBotEngine}
        onDeleteBot={handleDeleteBot}
        onClosePosition={closePosition}
        onCloseAllPositions={closeAllPositions}
        onUpdatePositionSLTP={updatePositionSLTP}
        onUpdateBotSLTP={updateBotSLTP}
        onUpdateBot={updateBot}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Trading Center</h1>
        <button
          onClick={() => setView('create')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-black text-sm font-semibold hover:bg-primary-light transition-all shadow-lg shadow-primary/10"
        >
          <Plus className="w-4 h-4 text-black" /> Create Trading Bot
        </button>
      </div>

      <TradingStats
        walletBalance={walletBalance}
        activeBots={activeBots}
        totalBots={bots.length}
        totalInvested={totalInvested}
        totalPnl={totalPnl}
        winRate={winRate}
        totalTrades={totalTrades}
      />

      <BotListTable
        bots={bots}
        activeBotsCount={activeBots}
        winRate={winRate}
        totalTrades={totalTrades}
        prices={prices}
        pairNames={PAIR_NAMES}
        onSelectBot={id => {
          setSelectedBotId(id);
          setView('detail');
        }}
        onStartBot={handleStartBotEngine}
        onStopBot={handleStopBotEngine}
        onDeleteBot={handleDeleteBot}
        onNavigateToCreate={() => setView('create')}
      />
    </div>
  );
}
