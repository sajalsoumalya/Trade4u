import { useState, useEffect, useMemo } from 'react';
import { useAppStore, Bot } from '../store/appStore';
import { fetchCryptoPrices, fetchBinanceSymbols } from '../lib/api';
import { useTrading } from '../hooks/useTrading';
import { io } from 'socket.io-client';
import { useToast } from '../components/Toast';
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { TradingStats } from '../components/trading/TradingStats';
import { BotListTable } from '../components/trading/BotListTable';
import { CreateBotForm } from '../components/trading/CreateBotForm';
import { BotDetailView } from '../components/trading/BotDetailView';

const DEFAULT_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
const QUOTE_CURRENCIES = ['USDT', 'USDC', 'BUSD', 'DAI'];

function symbolToPair(s: string): string {
  for (const q of QUOTE_CURRENCIES) {
    if (s.endsWith(q) && s.length > q.length) return `${s.slice(0, -q.length)}/${q}`;
  }
  return s;
}

function buildPairNames(symbols: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of symbols) map[s] = symbolToPair(s);
  return map;
}

export default function Trading() {
  const { llmProvider, quickModel, deepModel, botLogs, addBotLog, setEngineError } = useAppStore();
  const {
    bots,
    walletBalance,
    createBot,
    updateBot,
    deleteBot,
    startBot,
    stopBot,
    closePosition,
    closeAllPositions,
    updatePositionSltp,
    refresh,
  } = useTrading();

  const [prices, setPrices] = useState<Record<string, any>>({});
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  const { addToast } = useToast();

  // Fetch full symbols list dynamically from Binance API
  const { data: allPairs = DEFAULT_PAIRS } = useQuery({
    queryKey: ['binanceSymbols'],
    queryFn: fetchBinanceSymbols,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const pairNames = useMemo(() => buildPairNames(allPairs), [allPairs]);

  const selectedBot = bots.find(b => b.id === selectedBotId) || null;

  // Only price the pairs actually on screen, to stay clear of rate limits.
  const activePairs = useMemo(
    () => Array.from(new Set([...bots.flatMap(b => b.symbols), ...DEFAULT_PAIRS])),
    [bots]
  );
  const activePairsKey = activePairs.join(',');

  // Prices are display-only now: stop-loss and take-profit are enforced by the
  // server on its own price tick, so they no longer depend on this tab.
  useEffect(() => {
    let cancelled = false;
    const loadPrices = async () => {
      try {
        const data = await fetchCryptoPrices(activePairsKey.split(','));
        if (cancelled) return;
        const map: Record<string, any> = {};
        data.forEach((d: any) => { map[d.symbol] = d; });
        setPrices(map);
      } catch { /* transient — the next tick retries */ }
    };
    loadPrices();
    const timer = setInterval(loadPrices, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [activePairsKey]);

  // Socket.IO for AI engine signals. One connection, re-subscribed when the set
  // of bot ids changes; every handler re-reads server state rather than keeping
  // its own tally.
  const botIdsKey = bots.map(b => b.id).join(',');
  useEffect(() => {
    const socket = io({ path: '/api/socket.io' });
    const botsById = new Map(bots.map(b => [b.id, b.name] as const));

    for (const [id, name] of botsById) {
      socket.on(`bot:${id}:trade`, (signal: any) => {
        if (signal.executed) {
          const verb = signal.action === 'buy' ? 'Bought' : 'Sold';
          addToast('success', `${name}: ${verb} ${signal.symbol} @ $${Number(signal.price).toFixed(2)}`);
          refresh();
        }
      });

      socket.on(`bot:${id}:update_sltp`, () => refresh());

      socket.on(`bot:${id}:status`, (status: any) => {
        if (status.error) {
          addToast('error', `${name}: Engine error — ${status.error}`);
          setEngineError(id, status.error);
        }
        refresh();
      });

      socket.on(`bot:${id}:log`, (log: any) => addBotLog(id, log));

      socket.on(`bot:${id}:engineError`, (msg: string) => {
        setEngineError(id, msg);
        addToast('error', `${name}: ${msg}`);
        // Auth failures will fail every future cycle too — stop rather than
        // leave the bot "Running" and burning through them.
        if (msg.includes('401') || msg.includes('Authentication failed') || msg.includes('Unauthorized')) {
          stopBot.mutate(id);
        }
      });
    }

    // Server-side stop/target closes and any other position change.
    socket.on('positions-changed', () => refresh());

    return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botIdsKey]);

  const totalInvested = bots.reduce((s, b) => s + b.frozenAmount, 0);
  const totalPnl = bots.reduce((s, b) => s + b.totalPnl, 0);
  const activeBots = bots.filter(b => b.status === 'running').length;
  const totalTrades = bots.reduce((s, b) => s + b.closedTrades, 0);
  const winRate =
    totalTrades > 0
      ? ((bots.reduce((s, b) => s + b.winningTrades, 0) / totalTrades) * 100).toFixed(1)
      : '0.0';

  const handleStartBot = (id: string) => {
    startBot.mutate(id, {
      onError: (e: any) => addToast('error', `Failed to start bot: ${e.message}`),
    });
  };

  const handleStopBot = (id: string) => {
    stopBot.mutate(id, {
      onError: (e: any) => addToast('error', `Failed to stop bot: ${e.message}`),
    });
  };

  const handleDeleteBot = (id: string) => {
    if (!confirm('Are you sure you want to delete this bot instance?')) return;
    deleteBot.mutate(id, {
      onSuccess: () => {
        if (selectedBotId === id) {
          setSelectedBotId(null);
          setView('list');
        }
      },
      onError: (e: any) => addToast('error', `Failed to delete bot: ${e.message}`),
    });
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
    createBot.mutate(
      {
        ...config,
        botProvider: llmProvider || 'opencode',
        botQuickModel: quickModel || 'minimax-m2.5-free',
        botDeepModel: deepModel || 'minimax-m2.5-free',
        start: true,
      },
      {
        onSuccess: () => {
          addToast('success', `Bot "${config.name}" successfully created.`);
          setView('list');
        },
        onError: (e: any) => addToast('error', `Could not create bot: ${e.message}`),
      }
    );
  };

  const handleClosePosition = (_botId: string, posId: string, cp: number) => {
    closePosition.mutate({ id: posId, price: cp });
  };

  const handleCloseAllPositions = (botId: string, priceMap: Record<string, number>) => {
    closeAllPositions.mutate({ botId, prices: priceMap });
  };

  const handleUpdatePositionSLTP = (_botId: string, posId: string, sl?: number, tp?: number) => {
    updatePositionSltp.mutate({ id: posId, stopLoss: sl, takeProfit: tp });
  };

  const handleUpdateBotSLTP = (botId: string, sl: number, tp: number) => {
    updateBot.mutate({ id: botId, changes: { stopLoss: sl, takeProfit: tp } });
  };

  const handleUpdateBot = (botId: string, changes: Partial<Bot>) => {
    updateBot.mutate({ id: botId, changes: changes as Record<string, unknown> }, {
      onError: (e: any) => addToast('error', e.message),
    });
  };

  if (view === 'create') {
    return (
      <CreateBotForm
        allPairs={allPairs}
        pairNames={pairNames}
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
        pairNames={pairNames}
        allPairs={allPairs}
        logs={botLogs[selectedBot.id] || []}
        walletBalance={walletBalance}
        onBack={() => {
          setSelectedBotId(null);
          setView('list');
        }}
        onStartBot={handleStartBot}
        onStopBot={handleStopBot}
        onDeleteBot={handleDeleteBot}
        onClosePosition={handleClosePosition}
        onCloseAllPositions={handleCloseAllPositions}
        onUpdatePositionSLTP={handleUpdatePositionSLTP}
        onUpdateBotSLTP={handleUpdateBotSLTP}
        onUpdateBot={handleUpdateBot}
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
        pairNames={pairNames}
        onSelectBot={id => {
          setSelectedBotId(id);
          setView('detail');
        }}
        onStartBot={handleStartBot}
        onStopBot={handleStopBot}
        onDeleteBot={handleDeleteBot}
        onNavigateToCreate={() => setView('create')}
      />
    </div>
  );
}
