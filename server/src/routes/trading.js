import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';

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

router.post('/order', requireAuth, async (req, res) => {
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

router.delete('/order/:id', requireAuth, async (req, res) => {
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
      ? (closePrice - trade.price) * trade.quantity
      : (trade.price - closePrice) * trade.quantity;

    trades[idx] = { ...trade, status: 'closed', closePrice, pnl, closedAt: new Date().toISOString() };
    writeData('trades', trades);

    res.json({ id, status: 'closed', pnl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/positions', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const positions = readData('trades').filter(t => t.uid === uid && t.status === 'open');
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', requireAuth, async (req, res) => {
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

router.get('/balance', requireAuth, async (req, res) => {
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

export default router;