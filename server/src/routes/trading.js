import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { startAIEngine, stopAIEngine, isEngineRunning } from '../services/botEngine.js';
import db from '../services/db.js';
import { encrypt } from '../services/cryptoHelper.js';
import { isMaskedKey, resolveStoredKey, loadRawConfig, parseProviderKeys } from '../services/llmConfig.js';
import { logger } from '../services/logger.js';
import {
  listModels as listProviderModels,
  testConnection as testProviderConnection,
} from '../services/providers.js';
import {
  getWallet, setWallet,
  listBots, createBot, updateBot, deleteBot, setBotStatus,
  listOpenPositions, closePosition, closeAllForBot, updatePositionSltp, getTradeHistory,
} from '../services/tradeService.js';

const router = Router();

// ---------------------------------------------------------------- wallet

router.get('/balance', optionalAuth, (req, res) => {
  try {
    res.json({ balance: getWallet(req.uid), tradingMode: 'paper' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/balance', optionalAuth, (req, res) => {
  try {
    const balance = Number(req.body.balance);
    if (!Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({ error: 'balance must be a non-negative number' });
    }
    res.json({ balance: setWallet(req.uid, balance) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------------ bots

router.get('/bots', optionalAuth, (req, res) => {
  try {
    // Reconcile the reported status with the processes actually alive, so a
    // container restart can't leave a bot showing "running" with no engine.
    const bots = listBots(req.uid).map((b) => ({ ...b, engineRunning: isEngineRunning(b.id) }));
    res.json(bots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bots', optionalAuth, (req, res) => {
  try {
    const { name, symbols, allocationType, allocationValue, stopLoss, takeProfit, interval,
            botProvider, botQuickModel, botDeepModel, start } = req.body;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'At least one symbol is required' });
    }

    let bot = createBot(req.uid, {
      name, symbols, allocationType, allocationValue, stopLoss, takeProfit, interval,
      botProvider, botQuickModel, botDeepModel,
    });

    if (start) bot = startBot(req.uid, bot.id, req.app.get('io'));
    res.json(bot);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/bots/:id', optionalAuth, (req, res) => {
  try {
    const bot = updateBot(req.uid, req.params.id, req.body);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    res.json(bot);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/bots/:id', optionalAuth, (req, res) => {
  try {
    stopAIEngine(req.params.id);
    if (!deleteBot(req.uid, req.params.id)) return res.status(404).json({ error: 'Bot not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Spawn the Python engine for a bot that is already persisted, resolving its
// LLM settings from the bot row so a restart uses the same models.
function startBot(uid, id, io) {
  const bot = setBotStatus(uid, id, 'running');
  if (!bot) return null;
  startAIEngine({
    id: bot.id,
    uid,
    symbols: bot.symbols,
    stopLoss: bot.stopLoss,
    takeProfit: bot.takeProfit,
    interval: bot.interval,
    provider: bot.botProvider,
    quickModel: bot.botQuickModel,
    deepModel: bot.botDeepModel,
  }, io);
  return bot;
}

router.post('/bots/:id/start', optionalAuth, (req, res) => {
  try {
    const bot = startBot(req.uid, req.params.id, req.app.get('io'));
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    res.json({ success: true, running: true, bot });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bots/:id/stop', optionalAuth, (req, res) => {
  try {
    stopAIEngine(req.params.id);
    const bot = setBotStatus(req.uid, req.params.id, 'stopped');
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    res.json({ success: true, running: false, bot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/bots/:id/status', optionalAuth, (req, res) => {
  res.json({ running: isEngineRunning(req.params.id) });
});

router.post('/bots/:id/close-all', optionalAuth, (req, res) => {
  try {
    const closed = closeAllForBot(req.uid, req.params.id, req.body.prices || {});
    res.json({ closed: closed.length, positions: closed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * One-time adoption of bots that were created before the server owned this
 * state (they lived only in the browser's localStorage). Ignores bots whose id
 * is already present so a repeated call is harmless.
 */
router.post('/bots/import', optionalAuth, (req, res) => {
  try {
    const incoming = Array.isArray(req.body.bots) ? req.body.bots : [];
    const existing = new Set(listBots(req.uid).map((b) => b.name));
    const imported = [];
    for (const b of incoming) {
      if (!Array.isArray(b.symbols) || b.symbols.length === 0) continue;
      if (existing.has(b.name)) continue;
      try {
        imported.push(createBot(req.uid, b));
        existing.add(b.name);
      } catch (err) {
        logger.warn('trading', `Bot import skipped "${b.name}" — ${err.message}`);
      }
    }
    res.json({ imported: imported.length, bots: listBots(req.uid) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------- positions

router.get('/positions', optionalAuth, (req, res) => {
  try {
    res.json(listOpenPositions(req.uid));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/positions/:id/close', optionalAuth, (req, res) => {
  try {
    const result = closePosition(req.uid, req.params.id, req.body.price, req.body.status || 'closed');
    if (!result) return res.status(404).json({ error: 'Open position not found' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/positions/:id/sltp', optionalAuth, (req, res) => {
  try {
    const { stopLoss, takeProfit } = req.body;
    const pos = updatePositionSltp(req.uid, req.params.id, stopLoss, takeProfit);
    if (!pos) return res.status(404).json({ error: 'Open position not found' });
    res.json(pos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', optionalAuth, (req, res) => {
  try {
    res.json(getTradeHistory(req.uid, parseInt(req.query.limit ?? 50, 10)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- LLM Config persistence ---
router.get('/config', optionalAuth, async (req, res) => {
  try {
    const config = loadRawConfig(req.uid);
    if (!config) {
      // Return empty values — the client's Zustand persisted state
      // (localStorage) holds the user's actual config, and we must not
      // overwrite it with server-side defaults on a fresh/empty DB.
      return res.json({});
    }
    const pk = parseProviderKeys(config);
    const providerKeys = {};
    for (const prov of Object.keys(pk)) {
      providerKeys[prov] = true;
    }
    res.json({
      provider: config.provider,
      apiKey: config.api_key ? '●●●●●●●●' : '',
      quickModel: config.quick_model,
      deepModel: config.deep_model,
      fallbackProvider: config.fallback_provider || '',
      fallbackApiKey: config.fallback_api_key ? '●●●●●●●●' : '',
      fallbackQuickModel: config.fallback_quick_model || '',
      fallbackDeepModel: config.fallback_deep_model || '',
      providerKeys,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/config', optionalAuth, async (req, res) => {
  try {
    const {
      provider,
      apiKey,
      quickModel,
      deepModel,
      fallbackProvider,
      fallbackApiKey,
      fallbackQuickModel,
      fallbackDeepModel,
    } = req.body;
    const uid = req.uid;

    db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(uid);

    const existing = db.prepare('SELECT api_key, fallback_api_key, provider_keys FROM llm_config WHERE uid = ?').get(uid);
    let finalKey = existing ? existing.api_key : '';
    let finalFallbackKey = existing ? existing.fallback_api_key : '';

    if (apiKey && apiKey !== '●●●●●●●●' && !apiKey.includes('●')) {
      finalKey = encrypt(apiKey);
    } else if (apiKey === '') {
      finalKey = '';
    }

    if (fallbackApiKey && fallbackApiKey !== '●●●●●●●●' && !fallbackApiKey.includes('●')) {
      finalFallbackKey = encrypt(fallbackApiKey);
    } else if (fallbackApiKey === '') {
      finalFallbackKey = '';
    }

    // Update per-provider key store
    const pk = parseProviderKeys(existing || { provider_keys: '{}' });
    if (apiKey && apiKey !== '●●●●●●●●' && !apiKey.includes('●')) {
      pk[provider] = encrypt(apiKey);
    } else if (apiKey === '') {
      delete pk[provider];
    }
    if (fallbackProvider) {
      if (fallbackApiKey && fallbackApiKey !== '●●●●●●●●' && !fallbackApiKey.includes('●')) {
        pk[fallbackProvider] = encrypt(fallbackApiKey);
      } else if (fallbackApiKey === '') {
        delete pk[fallbackProvider];
      }
    }
    const providerKeysJson = JSON.stringify(pk);

    db.prepare(`
      INSERT INTO llm_config (
        uid, provider, api_key, quick_model, deep_model,
        fallback_provider, fallback_api_key, fallback_quick_model, fallback_deep_model,
        provider_keys, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(uid) DO UPDATE SET
        provider = excluded.provider,
        api_key = excluded.api_key,
        quick_model = excluded.quick_model,
        deep_model = excluded.deep_model,
        fallback_provider = excluded.fallback_provider,
        fallback_api_key = excluded.fallback_api_key,
        fallback_quick_model = excluded.fallback_quick_model,
        fallback_deep_model = excluded.fallback_deep_model,
        provider_keys = excluded.provider_keys,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      uid,
      provider,
      finalKey,
      quickModel,
      deepModel,
      fallbackProvider || 'opencode',
      finalFallbackKey,
      fallbackQuickModel || 'minimax-m2.5-free',
      fallbackDeepModel || 'minimax-m2.5-free',
      providerKeysJson
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Test API connection ---
router.post('/test-connection', optionalAuth, async (req, res) => {
  try {
    let { provider, apiKey, model, isFallback } = req.body;
    if (!provider) return res.status(400).json({ ok: false, error: 'provider required' });

    if (isMaskedKey(apiKey)) {
      apiKey = resolveStoredKey(req.uid, provider, isFallback);
    }

    res.json(await testProviderConnection(provider, apiKey, model));
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// --- Dynamic model fetch from provider ---
router.post('/models/fetch', optionalAuth, async (req, res) => {
  try {
    let { provider, apiKey } = req.body;
    if (!provider) return res.status(400).json({ error: 'provider required' });

    if (isMaskedKey(apiKey)) {
      apiKey = resolveStoredKey(req.uid, provider);
    }

    res.json(await listProviderModels(provider, apiKey));
  } catch (error) {
    logger.error('trading', `Model fetch error — ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get bot decision logs (per-cycle results)
router.get('/bots/:id/logs', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    const logs = db.prepare(`
      SELECT * FROM decision_logs WHERE bot_id = ? AND uid = ? ORDER BY created_at DESC LIMIT ?
    `).all(id, req.uid, parseInt(limit, 10));
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;