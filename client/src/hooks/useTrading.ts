import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBots, getWalletBalance, setWalletBalance as setWalletBalanceApi,
  createBotApi, updateBotApi, deleteBotApi,
  startBotEngine, stopBotEngine,
  closePositionApi, closeAllPositionsApi, updatePositionSltpApi, importBotsApi,
} from '../lib/api';
import { Bot, useAppStore } from '../store/appStore';

const BOTS_KEY = ['trading', 'bots'];
const BALANCE_KEY = ['trading', 'balance'];

/**
 * Bots created before the server owned this state live only in this browser's
 * localStorage. Hand them over once, then mark the key so it never runs again.
 */
const MIGRATION_FLAG = 'trade4u-bots-migrated';

/**
 * Snapshot taken at module load, before anything can overwrite it.
 *
 * The store no longer persists `bots`, so the first time Zustand writes its
 * partialized state the legacy array is dropped from localStorage. Any setter
 * firing before the import request lands — the Settings page restoring config,
 * say — would take those bots with it, so the read happens once, up front.
 */
const LEGACY_BOTS: unknown[] = readLegacyBotsFromStorage();

function readLegacyBotsFromStorage(): unknown[] {
  if (localStorage.getItem(MIGRATION_FLAG)) return [];
  try {
    const raw = localStorage.getItem('trade4u-settings');
    if (!raw) return [];
    const bots = JSON.parse(raw)?.state?.bots;
    if (!Array.isArray(bots) || bots.length === 0) return [];
    return bots.map((b: any) => ({
      name: b.name,
      symbols: b.symbols,
      allocationType: b.allocationType,
      allocationValue: b.allocationValue,
      stopLoss: b.stopLoss,
      takeProfit: b.takeProfit,
      interval: b.interval,
      botProvider: b.botProvider,
      botQuickModel: b.botQuickModel,
      botDeepModel: b.botDeepModel,
    }));
  } catch {
    return [];
  }
}

/**
 * Server-backed trading state. Returns the same `bots` / `walletBalance` shape
 * the pages consumed from the Zustand store, so the UI components are unchanged.
 */
export function useTrading() {
  const queryClient = useQueryClient();
  const engineErrors = useAppStore((s) => s.engineErrors);
  const migrated = useRef(false);

  const botsQuery = useQuery({
    queryKey: BOTS_KEY,
    queryFn: getBots,
    // The engine trades on its own schedule, so poll as a backstop for any
    // socket event that gets missed.
    refetchInterval: 15000,
  });

  const balanceQuery = useQuery({
    queryKey: BALANCE_KEY,
    queryFn: getWalletBalance,
    refetchInterval: 15000,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: BOTS_KEY });
    queryClient.invalidateQueries({ queryKey: BALANCE_KEY });
  }, [queryClient]);

  // One-shot adoption of pre-server bots.
  useEffect(() => {
    if (migrated.current || botsQuery.data === undefined) return;
    migrated.current = true;
    const legacy = LEGACY_BOTS;
    if (legacy.length === 0) {
      localStorage.setItem(MIGRATION_FLAG, '1');
      return;
    }
    importBotsApi(legacy)
      .then(() => {
        localStorage.setItem(MIGRATION_FLAG, '1');
        refresh();
      })
      .catch(() => { migrated.current = false; });
  }, [botsQuery.data, refresh]);

  const createBot = useMutation({ mutationFn: createBotApi, onSettled: refresh });
  const updateBot = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Record<string, unknown> }) =>
      updateBotApi(id, changes),
    onSettled: refresh,
  });
  const deleteBot = useMutation({ mutationFn: deleteBotApi, onSettled: refresh });
  const startBot = useMutation({ mutationFn: startBotEngine, onSettled: refresh });
  const stopBot = useMutation({ mutationFn: stopBotEngine, onSettled: refresh });
  const closePosition = useMutation({
    mutationFn: ({ id, price, status }: { id: string; price: number; status?: string }) =>
      closePositionApi(id, price, status),
    onSettled: refresh,
  });
  const closeAllPositions = useMutation({
    mutationFn: ({ botId, prices }: { botId: string; prices: Record<string, number> }) =>
      closeAllPositionsApi(botId, prices),
    onSettled: refresh,
  });
  const updatePositionSltp = useMutation({
    mutationFn: ({ id, stopLoss, takeProfit }: { id: string; stopLoss: number | null; takeProfit: number | null }) =>
      updatePositionSltpApi(id, stopLoss, takeProfit),
    onSettled: refresh,
  });
  const setWalletBalance = useMutation({ mutationFn: setWalletBalanceApi, onSettled: refresh });

  // Engine errors arrive over the socket, not the API — merge them in so the
  // detail view can show the last failure alongside server state.
  const bots: Bot[] = (botsQuery.data || []).map((b) => ({
    ...(b as unknown as Bot),
    engineError: engineErrors[b.id],
  }));

  return {
    bots,
    walletBalance: balanceQuery.data ?? 0,
    isLoading: botsQuery.isLoading || balanceQuery.isLoading,
    error: (botsQuery.error || balanceQuery.error) as Error | null,
    refresh,
    createBot,
    updateBot,
    deleteBot,
    startBot,
    stopBot,
    closePosition,
    closeAllPositions,
    updatePositionSltp,
    setWalletBalance,
  };
}
