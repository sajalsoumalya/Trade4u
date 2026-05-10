import { Router } from 'express';
import { db } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Paper trading - place order
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

    // Get user's trading mode
    const userDoc = await db.collection('users').doc(uid).get();
    const tradingMode = userDoc.exists ? userDoc.data().tradingMode : 'paper';

    // Create trade record
    const tradeRef = db.collection('trades').doc();
    const tradePrice = price || 0;

    await tradeRef.set({
      uid,
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

    // Update user's balance (paper trading)
    if (tradingMode === 'paper') {
      const balanceRef = db.collection('users').doc(uid).collection('balance').doc('paper');
      const balanceDoc = await balanceRef.get();
      const currentBalance = balanceDoc.exists ? balanceDoc.data().balance : 100000; // $100k default

      const cost = tradePrice * quantity;
      const newBalance = type.toLowerCase() === 'buy'
        ? currentBalance - cost
        : currentBalance + cost;

      await balanceRef.set({
        balance: newBalance,
        updatedAt: new Date().toISOString()
      });
    }

    res.json({
      id: tradeRef.id,
      symbol: symbol.toUpperCase(),
      type: type.toLowerCase(),
      quantity,
      price: tradePrice,
      status: 'open',
      tradingMode
    });
  } catch (error) {
    console.error('Order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Close position
router.delete('/order/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    const uid = req.uid;

    const tradeRef = db.collection('trades').doc(id);
    const tradeDoc = await tradeRef.get();

    if (!tradeDoc.exists) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const trade = tradeDoc.data();
    if (trade.uid !== uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (trade.status === 'closed') {
      return res.status(400).json({ error: 'Trade already closed' });
    }

    const closePrice = price || trade.price || 0;
    const pnl = trade.type === 'sell'
      ? (closePrice - trade.price) * trade.quantity
      : (trade.price - closePrice) * trade.quantity;

    await tradeRef.update({
      status: 'closed',
      closePrice,
      pnl,
      closedAt: new Date().toISOString()
    });

    // Update balance (paper)
    const userDoc = await db.collection('users').doc(uid).get();
    const tradingMode = userDoc.exists ? userDoc.data().tradingMode : 'paper';

    if (tradingMode === 'paper') {
      const balanceRef = db.collection('users').doc(uid).collection('balance').doc('paper');
      const balanceDoc = await balanceRef.get();
      const currentBalance = balanceDoc.exists ? balanceDoc.data().balance : 100000;

      const cost = closePrice * trade.quantity;
      const newBalance = trade.type === 'buy'
        ? currentBalance + cost + pnl
        : currentBalance + cost;

      await balanceRef.set({
        balance: newBalance,
        updatedAt: new Date().toISOString()
      });
    }

    res.json({
      id: tradeRef.id,
      status: 'closed',
      pnl
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get open positions
router.get('/positions', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const snapshot = await db.collection('trades')
      .where('uid', '==', uid)
      .where('status', '==', 'open')
      .get();

    const positions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trade history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { limit = 50 } = req.query;

    const snapshot = await db.collection('trades')
      .where('uid', '==', uid)
      .orderBy('openedAt', 'desc')
      .limit(parseInt(limit))
      .get();

    const trades = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate P&L
    const pnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    res.json({ trades, totalPnl: pnl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user balance
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    const tradingMode = userDoc.exists ? userDoc.data().tradingMode : 'paper';

    let balance = 100000;
    if (tradingMode === 'paper') {
      const balanceDoc = await db.collection('users').doc(uid).collection('balance').doc('paper').get();
      balance = balanceDoc.exists ? balanceDoc.data().balance : 100000;
    }

    res.json({ balance, tradingMode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;