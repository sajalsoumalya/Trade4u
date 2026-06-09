import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { optionalAuth } from '../middleware/auth.js';
import { startAIEngine, stopAIEngine, isEngineRunning } from '../services/botEngine.js';
import db from '../services/db.js';
import { encrypt, decrypt } from '../services/cryptoHelper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const getFile = (name) => path.join(DATA_DIR, `${name}.json`);
const readData = (name) => {
  const f = getFile(name);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
};
const readJsonData = (name) => {
  const f = getFile(name);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
};
const writeData = (name, data) => fs.writeFileSync(getFile(name), JSON.stringify(data, null, 2));

const router = Router();

router.post('/order', optionalAuth, async (req, res) => {
  try {
    const { symbol, type, quantity, price } = req.body;
    const uid = req.uid;

    if (!symbol || !type || !quantity) {
      return res.status(400).json({ error: 'symbol, type, quantity required' });
    }

    if (!['buy', 'sell'].includes(type.toLowerCase())) {
      return res.status(400).json({ error: 'type must be buy or sell' });
    }

    db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(uid);

    let balanceRow = db.prepare('SELECT balance FROM balances WHERE uid = ?').get(uid);
    if (!balanceRow) {
      db.prepare('INSERT INTO balances (uid, balance) VALUES (?, 100000.0)').run(uid);
      balanceRow = { balance: 100000.0 };
    }

    const tradePrice = price || 0;
    const orderCost = tradePrice * parseFloat(quantity);

    if (type.toLowerCase() === 'buy' && balanceRow.balance < orderCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const tradingMode = 'paper';

    db.transaction(() => {
      if (type.toLowerCase() === 'buy') {
        db.prepare('UPDATE balances SET balance = balance - ? WHERE uid = ?').run(orderCost, uid);
      } else {
        db.prepare('UPDATE balances SET balance = balance + ? WHERE uid = ?').run(orderCost, uid);
      }

      db.prepare(`
        INSERT INTO positions (id, uid, symbol, type, quantity, entry_price, status, opened_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, uid, symbol.toUpperCase(), type.toLowerCase(), parseFloat(quantity), tradePrice, 'open');

      db.prepare(`
        INSERT INTO trade_history (id, uid, symbol, type, quantity, price, amount, status, trading_mode, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, uid, symbol.toUpperCase(), type.toLowerCase(), parseFloat(quantity), tradePrice, orderCost, 'open', tradingMode);
    })();

    res.json({ id, symbol: symbol.toUpperCase(), type: type.toLowerCase(), quantity, price: tradePrice, status: 'open', tradingMode });
  } catch (error) {
    console.error('Order error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/order/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    const uid = req.uid;

    const pos = db.prepare('SELECT * FROM positions WHERE id = ? AND uid = ? AND status = "open"').get(id, uid);
    if (!pos) return res.status(404).json({ error: 'Trade not found' });

    const closePrice = price || pos.entry_price || 0;
    const pnl = pos.type === 'sell'
      ? (pos.entry_price - closePrice) * pos.quantity
      : (closePrice - pos.entry_price) * pos.quantity;

    db.transaction(() => {
      if (pos.type === 'buy') {
        db.prepare('UPDATE balances SET balance = balance + ? WHERE uid = ?').run(pos.quantity * closePrice, uid);
      } else {
        db.prepare('UPDATE balances SET balance = balance - ? WHERE uid = ?').run(pos.quantity * closePrice, uid);
      }

      db.prepare('DELETE FROM positions WHERE id = ?').run(id);

      db.prepare(`
        INSERT INTO closed_positions (id, uid, symbol, type, quantity, entry_price, exit_price, pnl, pnl_pct, status, opened_at, closed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, uid, pos.symbol, pos.type, pos.quantity, pos.entry_price, closePrice, pnl, pos.entry_price > 0 ? (pnl / (pos.entry_price * pos.quantity)) * 100 : 0.0, 'closed', pos.opened_at);

      db.prepare('UPDATE trade_history SET status = "closed", pnl = ? WHERE id = ?').run(pnl, id);
    })();

    res.json({ id, status: 'closed', pnl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/positions', optionalAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const positions = db.prepare('SELECT * FROM positions WHERE uid = ? AND status = "open"').all(uid);
    const mapped = positions.map(p => ({
      id: p.id,
      botId: p.bot_id,
      uid: p.uid,
      symbol: p.symbol,
      type: p.type,
      quantity: p.quantity,
      entryPrice: p.entry_price,
      stopLoss: p.stop_loss,
      takeProfit: p.take_profit,
      status: p.status,
      openedAt: p.opened_at
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', optionalAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { limit = 50 } = req.query;
    
    const trades = db.prepare('SELECT * FROM trade_history WHERE uid = ? ORDER BY created_at DESC LIMIT ?').all(uid, parseInt(limit));
    const mapped = trades.map(t => ({
      id: t.id,
      uid: t.uid,
      botId: t.bot_id,
      symbol: t.symbol,
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      amount: t.amount,
      pnl: t.pnl,
      status: t.status,
      tradingMode: t.trading_mode,
      createdAt: t.created_at
    }));

    const totalPnlRow = db.prepare('SELECT SUM(pnl) as total FROM closed_positions WHERE uid = ?').get(uid);
    const totalPnl = totalPnlRow ? (totalPnlRow.total || 0) : 0;

    res.json({ trades: mapped, totalPnl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/balance', optionalAuth, async (req, res) => {
  try {
    const uid = req.uid;
    db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(uid);
    let balanceRow = db.prepare('SELECT balance FROM balances WHERE uid = ?').get(uid);
    if (!balanceRow) {
      db.prepare('INSERT INTO balances (uid, balance) VALUES (?, 100000.0)').run(uid);
      balanceRow = { balance: 100000.0 };
    }
    res.json({ balance: balanceRow.balance, tradingMode: 'paper' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Engine lifecycle — managed by botEngine.js
router.post('/bots/:id/start', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { symbols, stopLoss, takeProfit, interval, provider, quickModel, deepModel } = req.body;
    const io = req.app.get('io');
    const uid = req.uid;
    const ok = startAIEngine({ id, uid, symbols: symbols || [], stopLoss, takeProfit, interval, provider, quickModel, deepModel }, io);
    res.json({ success: ok, running: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bots/:id/stop', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    stopAIEngine(id);
    res.json({ success: true, running: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/bots/:id/status', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ running: isEngineRunning(id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- LLM Config persistence ---
router.get('/config', optionalAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const config = db.prepare('SELECT * FROM llm_config WHERE uid = ?').get(uid);
    if (!config) {
      return res.json({ provider: 'opencode', apiKey: '', quickModel: 'minimax-m2.5-free', deepModel: 'minimax-m2.5-free' });
    }
    res.json({
      provider: config.provider,
      apiKey: config.api_key ? '●●●●●●●●' : '',
      quickModel: config.quick_model,
      deepModel: config.deep_model,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/config', optionalAuth, async (req, res) => {
  try {
    const { provider, apiKey, quickModel, deepModel } = req.body;
    const uid = req.uid;

    db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(uid);

    const existing = db.prepare('SELECT api_key FROM llm_config WHERE uid = ?').get(uid);
    let finalKey = existing ? existing.api_key : '';

    if (apiKey && apiKey !== '●●●●●●●●' && !apiKey.includes('●')) {
      finalKey = encrypt(apiKey);
    }

    db.prepare(`
      INSERT INTO llm_config (uid, provider, api_key, quick_model, deep_model, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(uid) DO UPDATE SET
        provider = excluded.provider,
        api_key = excluded.api_key,
        quick_model = excluded.quick_model,
        deep_model = excluded.deep_model,
        updated_at = CURRENT_TIMESTAMP
    `).run(uid, provider, finalKey, quickModel, deepModel);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Test API connection ---
router.post('/test-connection', optionalAuth, async (req, res) => {
  try {
    let { provider, apiKey } = req.body;
    if (!provider) return res.status(400).json({ ok: false, error: 'provider required' });

    const uid = req.uid;
    if (apiKey === '●●●●●●●●' || apiKey === '******' || !apiKey) {
      const config = db.prepare('SELECT api_key FROM llm_config WHERE uid = ?').get(uid);
      if (config && config.api_key) {
        apiKey = decrypt(config.api_key);
      }
    }

    let ok = false;
    let error = null;

    switch (provider) {
      case 'opencode':
        if (apiKey) {
          const r = await fetch('https://opencode.ai/zen/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          ok = r.ok;
          if (!ok) error = `HTTP ${r.status}`;
        } else {
          ok = true;
        }
        break;
      case 'openai':
        if (apiKey) {
          const r = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          ok = r.ok;
          if (!ok) error = `HTTP ${r.status}`;
        } else {
          error = 'API key required';
        }
        break;
      case 'anthropic':
        if (apiKey) {
          const r = await fetch('https://api.anthropic.com/v1/models', {
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          });
          ok = r.ok;
          if (!ok) error = `HTTP ${r.status}`;
        } else {
          error = 'API key required';
        }
        break;
      case 'google':
        if (apiKey) {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
          ok = r.ok;
          if (!ok) error = `HTTP ${r.status}`;
        } else {
          error = 'API key required';
        }
        break;
      case 'deepseek':
        if (apiKey) {
          const r = await fetch('https://api.deepseek.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          ok = r.ok;
          if (!ok) error = `HTTP ${r.status}`;
        } else {
          error = 'API key required';
        }
        break;
      case 'nvidia':
      case 'nvidia_nim':
        if (apiKey) {
          const r = await fetch('https://integrate.api.nvidia.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          ok = r.ok;
          if (!ok) error = `HTTP ${r.status}`;
        } else {
          error = 'API key required';
        }
        break;
      case 'openrouter':
        if (apiKey) {
          const r = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          ok = r.ok;
          if (!ok) error = `HTTP ${r.status}`;
        } else {
          error = 'API key required';
        }
        break;
      default:
        error = 'Unknown provider';
    }

    res.json({ ok, error });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// --- Dynamic model fetch from provider ---
router.post('/models/fetch', optionalAuth, async (req, res) => {
  try {
    let { provider, apiKey } = req.body;
    if (!provider) return res.status(400).json({ error: 'provider required' });

    const uid = req.uid;
    if (apiKey === '●●●●●●●●' || apiKey === '******' || !apiKey) {
      const config = db.prepare('SELECT api_key FROM llm_config WHERE uid = ?').get(uid);
      if (config && config.api_key) {
        apiKey = decrypt(config.api_key);
      }
    }

    let models = [];

    switch (provider) {
      case 'opencode':
        try {
          const resp = await fetch('https://opencode.ai/zen/v1/models', {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          });
          if (resp.ok) {
            const data = await resp.json();
            models = (data.data || []).map((m, i) => ({
              id: m.id,
              name: m.id,
              cost: 'Free',
              context: 256000,
              maxOutput: 16384,
              capabilities: ['reasoning', 'tools', 'vision', 'open weights'],
            }));
          }
        } catch (_) { /* fall through */ }
        if (models.length === 0) {
          models = [
            { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', cost: 'Free', context: 256000, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'vision', 'open weights'] },
            { id: 'ring-2.6-1t-free', name: 'Ring 2.6 1T Free', cost: 'Free', context: 256000, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'vision', 'open weights'] },
            { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', cost: 'Free', context: 256000, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'vision', 'open weights'] },
          ];
        }
        break;

      case 'openai':
        if (apiKey) {
          const resp = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (resp.ok) {
            const data = await resp.json();
            models = (data.data || [])
              .filter(m => m.id.startsWith('gpt-') || m.id.startsWith('o'))
              .map(m => ({
                id: m.id,
                name: m.id,
                cost: 'Paid',
                context: 128000,
                maxOutput: 16384,
                capabilities: ['reasoning', 'tools', 'vision'],
              }));
          }
        }
        // fallback
        if (models.length === 0) {
          models = [
            { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', cost: 'Paid', context: 128000, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'vision'] },
            { id: 'gpt-4.1', name: 'GPT-4.1', cost: 'Paid', context: 1048576, maxOutput: 32768, capabilities: ['reasoning', 'tools', 'vision', 'code'] },
            { id: 'gpt-5.4', name: 'GPT-5.4', cost: 'Paid', context: 256000, maxOutput: 65536, capabilities: ['reasoning', 'tools', 'vision', 'code', 'agents'] },
            { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', cost: 'Paid', context: 256000, maxOutput: 65536, capabilities: ['reasoning', 'tools', 'vision', 'code', 'agents', 'research'] },
          ];
        }
        break;

      case 'anthropic':
        if (apiKey) {
          const resp = await fetch('https://api.anthropic.com/v1/models', {
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          });
          if (resp.ok) {
            const data = await resp.json();
            models = (data.data || []).map(m => ({
              id: m.id,
              name: m.display_name || m.id,
              cost: 'Paid',
              context: 200000,
              maxOutput: 8192,
              capabilities: ['reasoning', 'tools', 'vision'],
            }));
          }
        }
        if (models.length === 0) {
          models = [
            { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', cost: 'Paid', context: 200000, maxOutput: 8192, capabilities: ['reasoning', 'tools', 'vision', 'code'] },
            { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', cost: 'Paid', context: 200000, maxOutput: 8192, capabilities: ['tools', 'vision', 'fast'] },
            { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', cost: 'Paid', context: 200000, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'vision', 'code', 'research'] },
          ];
        }
        break;

      case 'google':
        if (apiKey) {
          const resp = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
          if (resp.ok) {
            const data = await resp.json();
            models = (data.models || []).map(m => ({
              id: m.name.replace('models/', ''),
              name: m.display_name || m.name.replace('models/', ''),
              cost: 'Paid',
              context: 1048576,
              maxOutput: 8192,
              capabilities: ['reasoning', 'tools', 'vision'],
            }));
          }
        }
        if (models.length === 0) {
          models = [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', cost: 'Paid', context: 1048576, maxOutput: 8192, capabilities: ['reasoning', 'tools', 'vision', 'fast'] },
            { id: 'gemini-3-flash', name: 'Gemini 3 Flash', cost: 'Paid', context: 1048576, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'vision', 'fast'] },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', cost: 'Paid', context: 1048576, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'vision', 'code', 'research'] },
            { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', cost: 'Paid', context: 2097152, maxOutput: 32768, capabilities: ['reasoning', 'tools', 'vision', 'code', 'agents', 'research'] },
          ];
        }
        break;

      case 'deepseek':
        if (apiKey) {
          const resp = await fetch('https://api.deepseek.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (resp.ok) {
            const data = await resp.json();
            models = (data.data || []).map(m => ({
              id: m.id,
              name: m.id,
              cost: 'Paid',
              context: 262144,
              maxOutput: 16384,
              capabilities: ['reasoning', 'tools', 'code'],
            }));
          }
        }
        if (models.length === 0) {
          models = [
            { id: 'deepseek-chat', name: 'DeepSeek V3', cost: 'Paid', context: 131072, maxOutput: 8192, capabilities: ['reasoning', 'tools', 'code'] },
            { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', cost: 'Paid', context: 262144, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'vision', 'code', 'research'] },
            { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', cost: 'Paid', context: 262144, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'code'] },
          ];
        }
        break;
      case 'openrouter':
        if (apiKey) {
          try {
            const resp = await fetch('https://openrouter.ai/api/v1/models', {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (resp.ok) {
              const data = await resp.json();
              models = (data.data || []).map(m => ({
                id: m.id, name: m.name || m.id, cost: 'Paid',
                context: m.context_length || 128000, maxOutput: m.top_provider?.max_completion_tokens || 8192,
                capabilities: ['reasoning', 'tools'],
              }));
            }
          } catch (_) {}
        }
        if (models.length === 0) {
          models = [
            { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', cost: 'Paid', context: 200000, maxOutput: 8192, capabilities: ['reasoning', 'tools', 'code'] },
            { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini', cost: 'Paid', context: 128000, maxOutput: 16384, capabilities: ['reasoning', 'tools', 'fast'] },
            { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', cost: 'Paid', context: 1048576, maxOutput: 8192, capabilities: ['reasoning', 'tools', 'fast'] },
            { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', cost: 'Paid', context: 131072, maxOutput: 8192, capabilities: ['reasoning', 'tools', 'code'] },
            { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', cost: 'Paid', context: 131072, maxOutput: 8192, capabilities: ['reasoning', 'tools'] },
          ];
        }
        break;
      case 'nvidia':
      case 'nvidia_nim':
        if (apiKey) {
          const resp = await fetch('https://integrate.api.nvidia.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (resp.ok) {
            const data = await resp.json();
            models = (data.data || []).map(m => ({
              id: m.id,
              name: m.id,
              cost: 'Paid',
              context: 131072,
              maxOutput: 8192,
              capabilities: ['reasoning', 'tools', 'code'],
            }));
          }
        }
        if (models.length === 0) {
          models = [
            { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B', cost: 'Paid', context: 131072, maxOutput: 8192, capabilities: ['reasoning', 'code'] },
            { id: 'nvidia/deepseek-ai/deepseek-v3-671b', name: 'DeepSeek V3 671B', cost: 'Paid', context: 131072, maxOutput: 8192, capabilities: ['reasoning', 'code'] },
            { id: 'nvidia/meta/llama-3.2-90b-vision', name: 'Llama 3.2 90B Vision', cost: 'Paid', context: 131072, maxOutput: 8192, capabilities: ['reasoning', 'vision', 'code'] },
          ];
        }
        break;
    }

    res.json({ models });
  } catch (error) {
    console.error('Model fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});



export default router;