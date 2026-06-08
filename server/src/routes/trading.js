import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { optionalAuth } from '../middleware/auth.js';
import { startAIEngine, stopAIEngine, isEngineRunning } from '../services/botEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const getFile = (name) => path.join(DATA_DIR, `${name}.json`);
const readData = (name) => {
  const f = getFile(name);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
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

    const trades = readData('trades');
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const tradePrice = price || 0;
    const tradingMode = 'paper';

    trades.unshift({
      id, uid,
      symbol: symbol.toUpperCase(),
      type: type.toLowerCase(),
      quantity: parseFloat(quantity),
      price: tradePrice,
      status: 'open',
      tradingMode,
      pnl: 0,
      openedAt: new Date().toISOString(),
      closedAt: null
    });
    writeData('trades', trades);

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

    const trades = readData('trades');
    const idx = trades.findIndex(t => t.id === id && t.uid === uid);

    if (idx === -1) return res.status(404).json({ error: 'Trade not found' });
    if (trades[idx].status === 'closed') return res.status(400).json({ error: 'Trade already closed' });

    const trade = trades[idx];
    const closePrice = price || trade.price || 0;
    const pnl = trade.type === 'sell'
      ? (trade.price - closePrice) * trade.quantity
      : (closePrice - trade.price) * trade.quantity;

    trades[idx] = { ...trade, status: 'closed', closePrice, pnl, closedAt: new Date().toISOString() };
    writeData('trades', trades);

    res.json({ id, status: 'closed', pnl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/positions', optionalAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const positions = readData('trades').filter(t => t.uid === uid && t.status === 'open');
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', optionalAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { limit = 50 } = req.query;
    const trades = readData('trades').filter(t => t.uid === uid).slice(0, parseInt(limit));
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    res.json({ trades, totalPnl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/balance', optionalAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const balances = readData('balances');
    const user = balances.find(b => b.uid === uid);
    const balance = user ? user.balance : 100000;
    res.json({ balance, tradingMode: 'paper' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Engine lifecycle — managed by botEngine.js
router.post('/bots/:id/start', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { symbols, stopLoss, takeProfit } = req.body;
    const io = req.app.get('io');
    const ok = startAIEngine({ id, symbols: symbols || [], stopLoss, takeProfit }, io);
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

// Model options per provider
const MODELS = {
  opencode: {
    quick: [
      { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', cost: 'Free' },
      { id: 'ring-2.6-1t-free', name: 'Ring 2.6 1T Free', cost: 'Free' },
      { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', cost: 'Free' },
    ],
    deep: [
      { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', cost: 'Free' },
      { id: 'ring-2.6-1t-free', name: 'Ring 2.6 1T Free', cost: 'Free' },
      { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', cost: 'Free' },
    ],
  },
  openai: {
    quick: [
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', cost: 'Paid' },
      { id: 'gpt-4.1', name: 'GPT-4.1', cost: 'Paid' },
    ],
    deep: [
      { id: 'gpt-5.4', name: 'GPT-5.4', cost: 'Paid' },
      { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', cost: 'Paid' },
    ],
  },
  anthropic: {
    quick: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', cost: 'Paid' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', cost: 'Paid' },
    ],
    deep: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', cost: 'Paid' },
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', cost: 'Paid' },
    ],
  },
  google: {
    quick: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', cost: 'Paid' },
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash', cost: 'Paid' },
    ],
    deep: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', cost: 'Paid' },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', cost: 'Paid' },
    ],
  },
  deepseek: {
    quick: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', cost: 'Paid' },
    ],
    deep: [
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', cost: 'Paid' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', cost: 'Paid' },
    ],
  },
};

router.get('/models', (_req, res) => {
  res.json(MODELS);
});

export default router;