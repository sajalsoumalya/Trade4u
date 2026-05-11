import { Router } from 'express';
import { db } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Auto-trading settings storage (in production, use database)
let autoTradeSettings = {
  enabled: false,
  symbols: ['BTCUSDT'],
  tradeAmount: 100,
  maxPositions: 3,
  stopLoss: 2, // percentage
  takeProfit: 5, // percentage
  analysisInterval: 15, // minutes
  riskPerTrade: 1, // percentage of balance
};

// Get auto-trade settings
router.get('/settings', requireAuth, (req, res) => {
  res.json(autoTradeSettings);
});

// Update auto-trade settings
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

// Enable/disable auto-trading
router.post('/toggle', requireAuth, (req, res) => {
  const { enabled } = req.body;
  autoTradeSettings.enabled = enabled;

  // Emit event via Socket.IO
  const io = req.app.get('io');
  io.emit('auto-trade-status', { enabled: autoTradeSettings.enabled });

  res.json({ success: true, enabled: autoTradeSettings.enabled });
});

// Get trading history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const uid = req.uid;

    const snapshot = await db.collection('trades')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();

    const trades = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(trades);
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get open positions
router.get('/positions', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;

    const snapshot = await db.collection('positions')
      .where('uid', '==', uid)
      .where('status', '==', 'open')
      .get();

    const positions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(positions);
  } catch (error) {
    console.error('Positions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Manual trade execution
router.post('/trade', requireAuth, async (req, res) => {
  try {
    const { symbol, type, amount, price } = req.body;
    const uid = req.uid;

    // Create trade record
    const tradeRef = db.collection('trades').doc();
    await tradeRef.set({
      uid,
      symbol,
      type, // 'buy' or 'sell'
      amount,
      price,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Emit event
    const io = req.app.get('io');
    io.to(uid).emit('trade-executed', {
      id: tradeRef.id,
      symbol,
      type,
      amount,
      price,
    });

    // Simulate trade execution (in production, connect to exchange API)
    setTimeout(async () => {
      await tradeRef.update({
        status: 'executed',
        executedAt: new Date().toISOString()
      });

      // If it's a buy, create a position
      if (type === 'buy') {
        const positionRef = db.collection('positions').doc();
        await positionRef.set({
          uid,
          symbol,
          type: 'buy',
          entryPrice: price,
          amount,
          quantity: amount / price,
          status: 'open',
          stopLoss: price * (1 - 0.02), // 2% stop loss
          takeProfit: price * (1 + 0.05), // 5% take profit
          createdAt: new Date().toISOString(),
        });
      }

      io.to(uid).emit('trade-updated', { id: tradeRef.id, status: 'executed' });
    }, 1000);

    res.json({ success: true, id: tradeRef.id });
  } catch (error) {
    console.error('Trade error:', error);
    res.status(500).json({ error: 'Failed to execute trade' });
  }
});

// Close position
router.post('/close-position', requireAuth, async (req, res) => {
  try {
    const { positionId, currentPrice } = req.body;
    const uid = req.uid;

    const positionRef = db.collection('positions').doc(positionId);
    const positionDoc = await positionRef.get();

    if (!positionDoc.exists || positionDoc.data().uid !== uid) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const position = positionDoc.data();
    const pnl = (currentPrice - position.entryPrice) * position.quantity * (position.type === 'buy' ? 1 : -1);

    await positionRef.update({
      status: 'closed',
      exitPrice: currentPrice,
      pnl,
      closedAt: new Date().toISOString(),
    });

    // Emit event
    const io = req.app.get('io');
    io.to(uid).emit('position-closed', {
      id: positionId,
      pnl,
      exitPrice: currentPrice,
    });

    res.json({ success: true, pnl });
  } catch (error) {
    console.error('Close position error:', error);
    res.status(500).json({ error: 'Failed to close position' });
  }
});

// Get portfolio summary
router.get('/portfolio', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;

    // Get open positions
    const positionsSnapshot = await db.collection('positions')
      .where('uid', '==', uid)
      .where('status', '==', 'open')
      .get();

    const positions = positionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get trade history for P&L calculation
    const tradesSnapshot = await db.collection('trades')
      .where('uid', '==', uid)
      .where('status', '==', 'executed')
      .get();

    const trades = tradesSnapshot.docs.map(doc => doc.data());

    // Calculate totals
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl < 0).length;

    res.json({
      positions,
      totalPositions: positions.length,
      totalPnL,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(2) : 0,
    });
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

export default router;