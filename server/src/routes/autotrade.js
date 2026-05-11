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

let autoTradeSettings = {
  enabled: false,
  symbols: ['BTCUSDT'],
  tradeAmount: 100,
  maxPositions: 3,
  stopLoss: 2,
  takeProfit: 5,
  analysisInterval: 15,
  riskPerTrade: 1,
};

router.get('/settings', requireAuth, (req, res) => {
  res.json(autoTradeSettings);
});

router.post('/settings', requireAuth, (req, res) => {
  const { enabled, symbols, tradeAmount, maxPositions, stopLoss, takeProfit, analysisInterval, riskPerTrade } = req.body;
  autoTradeSettings = {
    enabled: enabled ?? autoTradeSettings.enabled,
    symbols: symbols ?? autoTradeSettings.symbols,
    tradeAmount: tradeAmount ?? autoTradeSettings.tradeAmount,
    maxPositions: maxPositions ?? autoTradeSettings.maxPositions,
    stopLoss: stopLoss ?? autoTradeSettings.stopLoss,
    takeProfit: takeProfit ?? autoTradeSettings.takeProfit,
    analysisInterval: analysisInterval ?? autoTradeSettings.analysisInterval,
    riskPerTrade: riskPerTrade ?? autoTradeSettings.riskPerTrade,
  };
  res.json({ success: true, settings: autoTradeSettings });
});

router.post('/toggle', requireAuth, (req, res) => {
  const { enabled } = req.body;
  autoTradeSettings.enabled = enabled;
  const io = req.app.get('io');
  io.emit('auto-trade-status', { enabled: autoTradeSettings.enabled });
  res.json({ success: true, enabled: autoTradeSettings.enabled });
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { limit = 50 } = req.query;
    const trades = readData('trades').filter(t => t.uid === uid).slice(0, parseInt(limit));
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.get('/positions', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const positions = readData('trades').filter(t => t.uid === uid && t.status === 'open');
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

router.post('/trade', requireAuth, async (req, res) => {
  try {
    const { symbol, type, amount, price } = req.body;
    const uid = req.uid;

    const trades = readData('trades');
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const trade = { id, uid, symbol, type, amount, price, status: 'executed', createdAt: new Date().toISOString() };
    trades.unshift(trade);
    writeData('trades', trades);

    if (type === 'buy') {
      const positions = readData('positions');
      const posId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      positions.unshift({
        id: posId, uid, symbol, type: 'buy', entryPrice: price, amount,
        quantity: amount / price, status: 'open',
        stopLoss: price * 0.98, takeProfit: price * 1.05,
        createdAt: new Date().toISOString()
      });
      writeData('positions', positions);
    }

    const io = req.app.get('io');
    io.to(uid).emit('trade-executed', { id, symbol, type, amount, price });

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute trade' });
  }
});

router.post('/close-position', requireAuth, async (req, res) => {
  try {
    const { positionId, currentPrice } = req.body;
    const uid = req.uid;

    const positions = readData('positions');
    const idx = positions.findIndex(p => p.id === positionId && p.uid === uid);

    if (idx === -1) return res.status(404).json({ error: 'Position not found' });

    const position = positions[idx];
    const pnl = (currentPrice - position.entryPrice) * position.quantity * (position.type === 'buy' ? 1 : -1);
    positions[idx] = { ...position, status: 'closed', exitPrice: currentPrice, pnl, closedAt: new Date().toISOString() };
    writeData('positions', positions);

    const io = req.app.get('io');
    io.to(uid).emit('position-closed', { id: positionId, pnl, exitPrice: currentPrice });

    res.json({ success: true, pnl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/portfolio', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const positions = readData('positions').filter(p => p.uid === uid && p.status === 'open');
    const trades = readData('trades').filter(t => t.uid === uid && t.status === 'executed');

    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl < 0).length;

    res.json({
      positions, totalPositions: positions.length, totalPnL, totalTrades,
      winningTrades, losingTrades,
      winRate: totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(2) : 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;