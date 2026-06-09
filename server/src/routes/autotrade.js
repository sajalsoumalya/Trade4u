import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { optionalAuth } from '../middleware/auth.js';
import db from '../services/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

const router = Router();
let botProcess = null;

function startBot(settings) {
  if (botProcess) return;
  const scriptPath = path.join(PROJECT_ROOT, 'bot.py');
  const args = [
    scriptPath,
    '--symbols', ...settings.symbols,
    '--interval', String(settings.analysisInterval),
    '--trade-amount', String(settings.tradeAmount),
    '--stop-loss', String(settings.stopLoss),
    '--take-profit', String(settings.takeProfit),
    '--max-positions', String(settings.maxPositions),
    '--provider', 'opencode',
  ];
  if (process.env.OPENCODE_API_KEY) {
    args.push('--api-key', process.env.OPENCODE_API_KEY);
  }
  const python = process.env.PYTHON || 'python3';
  botProcess = spawn(python, args, {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  botProcess.stdout.on('data', (data) => {
    console.log(`[AutoTradeBot] ${data.toString().trim()}`);
  });
  botProcess.stderr.on('data', (data) => {
    console.error(`[AutoTradeBot Error] ${data.toString().trim()}`);
  });
  botProcess.on('close', (code) => {
    console.log(`[AutoTradeBot] Process exited with code ${code}`);
    botProcess = null;
  });
  botProcess.on('error', (err) => {
    console.error(`[AutoTradeBot] Failed to start: ${err.message}`);
    botProcess = null;
  });
}

function stopBot() {
  if (!botProcess) return;
  botProcess.kill('SIGTERM');
  botProcess = null;
}

function getUserSettings(uid) {
  db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(uid);
  let settings = db.prepare('SELECT * FROM autotrade_settings WHERE uid = ?').get(uid);
  if (!settings) {
    db.prepare(`
      INSERT INTO autotrade_settings (uid, enabled, symbols, trade_amount, max_positions, stop_loss, take_profit, analysis_interval, risk_per_trade)
      VALUES (?, 0, '["BTCUSDT"]', 100.0, 3, 2.0, 5.0, 15, 1.0)
    `).run(uid);
    settings = db.prepare('SELECT * FROM autotrade_settings WHERE uid = ?').get(uid);
  }
  return {
    enabled: settings.enabled === 1,
    symbols: JSON.parse(settings.symbols),
    tradeAmount: settings.trade_amount,
    maxPositions: settings.max_positions,
    stopLoss: settings.stop_loss,
    takeProfit: settings.take_profit,
    analysisInterval: settings.analysis_interval,
    riskPerTrade: settings.risk_per_trade
  };
}

router.get('/settings', optionalAuth, (req, res) => {
  try {
    const settings = getUserSettings(req.uid);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings', optionalAuth, (req, res) => {
  try {
    const uid = req.uid;
    const current = getUserSettings(uid);
    const { enabled, symbols, tradeAmount, maxPositions, stopLoss, takeProfit, analysisInterval, riskPerTrade } = req.body;

    const newSettings = {
      enabled: enabled ?? current.enabled,
      symbols: symbols ?? current.symbols,
      tradeAmount: tradeAmount ?? current.tradeAmount,
      maxPositions: maxPositions ?? current.maxPositions,
      stopLoss: stopLoss ?? current.stopLoss,
      takeProfit: takeProfit ?? current.takeProfit,
      analysisInterval: analysisInterval ?? current.analysisInterval,
      riskPerTrade: riskPerTrade ?? current.riskPerTrade,
    };

    db.prepare(`
      UPDATE autotrade_settings
      SET enabled = ?, symbols = ?, trade_amount = ?, max_positions = ?, stop_loss = ?, take_profit = ?, analysis_interval = ?, risk_per_trade = ?, updated_at = datetime('now')
      WHERE uid = ?
    `).run(
      newSettings.enabled ? 1 : 0,
      JSON.stringify(newSettings.symbols),
      newSettings.tradeAmount,
      newSettings.maxPositions,
      newSettings.stopLoss,
      newSettings.takeProfit,
      newSettings.analysisInterval,
      newSettings.riskPerTrade,
      uid
    );

    if (newSettings.enabled) {
      stopBot();
      startBot(newSettings);
    }
    res.json({ success: true, settings: newSettings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/toggle', optionalAuth, (req, res) => {
  try {
    const uid = req.uid;
    const current = getUserSettings(uid);
    const { enabled } = req.body;
    
    db.prepare('UPDATE autotrade_settings SET enabled = ?, updated_at = datetime("now") WHERE uid = ?')
      .run(enabled ? 1 : 0, uid);
    
    current.enabled = !!enabled;

    if (enabled) {
      startBot(current);
    } else {
      stopBot();
    }
    const io = req.app.get('io');
    io.emit('auto-trade-status', { enabled: current.enabled });
    res.json({ success: true, enabled: current.enabled });
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
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
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
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

router.post('/trade', optionalAuth, async (req, res) => {
  try {
    const { symbol, type, amount, price } = req.body;
    const uid = req.uid;

    db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(uid);
    let balanceRow = db.prepare('SELECT balance FROM balances WHERE uid = ?').get(uid);
    if (!balanceRow) {
      db.prepare('INSERT INTO balances (uid, balance) VALUES (?, 100000.0)').run(uid);
      balanceRow = { balance: 100000.0 };
    }

    if (type === 'buy' && balanceRow.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const posId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const quantity = amount / price;

    db.transaction(() => {
      if (type === 'buy') {
        db.prepare('UPDATE balances SET balance = balance - ? WHERE uid = ?').run(amount, uid);
        db.prepare(`
          INSERT INTO positions (id, uid, symbol, type, quantity, entry_price, stop_loss, take_profit, status, opened_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(posId, uid, symbol, 'buy', quantity, price, price * 0.98, price * 1.05, 'open');
      }

      db.prepare(`
        INSERT INTO trade_history (id, uid, symbol, type, quantity, price, amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, uid, symbol, type, quantity, price, amount, 'executed');
    })();

    const io = req.app.get('io');
    io.to(uid).emit('trade-executed', { id, symbol, type, amount, price });

    res.json({ success: true, id });
  } catch (error) {
    console.error('AutoTrade trade error:', error);
    res.status(500).json({ error: 'Failed to execute trade' });
  }
});

router.post('/close-position', optionalAuth, async (req, res) => {
  try {
    const { positionId, currentPrice } = req.body;
    const uid = req.uid;

    const pos = db.prepare('SELECT * FROM positions WHERE id = ? AND uid = ? AND status = "open"').get(positionId, uid);
    if (!pos) return res.status(404).json({ error: 'Position not found' });

    const pnl = (currentPrice - pos.entry_price) * pos.quantity * (pos.type === 'buy' ? 1 : -1);
    const refund = pos.quantity * currentPrice;

    db.transaction(() => {
      if (pos.type === 'buy') {
        db.prepare('UPDATE balances SET balance = balance + ? WHERE uid = ?').run(refund, uid);
      }
      db.prepare('DELETE FROM positions WHERE id = ?').run(positionId);

      db.prepare(`
        INSERT INTO closed_positions (id, uid, symbol, type, quantity, entry_price, exit_price, pnl, pnl_pct, status, opened_at, closed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(positionId, uid, pos.symbol, pos.type, pos.quantity, pos.entry_price, currentPrice, pnl, ((currentPrice - pos.entry_price) / pos.entry_price) * 100, 'closed', pos.opened_at);

      db.prepare(`
        INSERT INTO trade_history (id, uid, symbol, type, quantity, price, amount, pnl, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(positionId + '_close', uid, pos.symbol, pos.type === 'buy' ? 'sell' : 'buy', pos.quantity, currentPrice, refund, pnl, 'closed');
    })();

    const io = req.app.get('io');
    io.to(uid).emit('position-closed', { id: positionId, pnl, exitPrice: currentPrice });

    res.json({ success: true, pnl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/portfolio', optionalAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const positions = db.prepare('SELECT * FROM positions WHERE uid = ? AND status = "open"').all(uid);
    const closed = db.prepare('SELECT * FROM closed_positions WHERE uid = ?').all(uid);

    const totalPnL = closed.reduce((sum, c) => sum + c.pnl, 0);
    const totalTrades = closed.length;
    const winningTrades = closed.filter(c => c.pnl > 0).length;
    const losingTrades = closed.filter(c => c.pnl < 0).length;

    const mappedPositions = positions.map(p => ({
      id: p.id,
      uid: p.uid,
      symbol: p.symbol,
      type: p.type,
      entryPrice: p.entry_price,
      amount: p.quantity * p.entry_price,
      quantity: p.quantity,
      status: p.status,
      stopLoss: p.stop_loss,
      takeProfit: p.take_profit,
      createdAt: p.opened_at
    }));

    res.json({
      positions: mappedPositions,
      totalPositions: mappedPositions.length,
      totalPnL,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(2) : 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;