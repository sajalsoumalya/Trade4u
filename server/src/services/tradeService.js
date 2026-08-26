/**
 * Server-side owner of all trading state.
 *
 * Positions, balances and bot bookkeeping used to be computed twice — once here
 * against SQLite and once in the browser's Zustand store — which meant the UI
 * and the database drifted apart permanently. Everything now lands in SQLite via
 * this module, and the client reads it back over the API.
 *
 * Money model
 *   balances.balance  — free wallet cash
 *   bots.frozen_amount — capital committed to a bot for as long as it runs
 *   A position's principal is drawn from its bot's frozen amount (so a bot can
 *   never trade more than it was allocated) and returns there when it closes.
 *   Realised P&L settles to the wallet, matching what the UI has always shown.
 */
import db from './db.js';
import { logger } from './logger.js';

const FEE_RATE = 0.001; // 0.1% taken on close, as the UI has always assumed
const DEFAULT_BALANCE = 100000.0;

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const nowIso = () => new Date().toISOString();

const round2 = (n) => Math.round(n * 100) / 100;

export function ensureUser(uid) {
  db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(uid);
  db.prepare('INSERT OR IGNORE INTO balances (uid, balance) VALUES (?, ?)').run(uid, DEFAULT_BALANCE);
}

export function getWallet(uid) {
  ensureUser(uid);
  const row = db.prepare('SELECT balance FROM balances WHERE uid = ?').get(uid);
  return row ? row.balance : DEFAULT_BALANCE;
}

export function setWallet(uid, balance) {
  ensureUser(uid);
  db.prepare('UPDATE balances SET balance = ?, updated_at = ? WHERE uid = ?').run(balance, nowIso(), uid);
  return balance;
}

const addToWallet = (uid, delta) =>
  db.prepare('UPDATE balances SET balance = balance + ?, updated_at = ? WHERE uid = ?').run(delta, nowIso(), uid);

/** Capital a bot should commit, given the wallet it draws from. */
export function calcFrozen(wallet, allocationType, allocationValue) {
  const value = Number(allocationValue) || 0;
  if (allocationType === 'percentage') return Math.round(wallet * (value / 100));
  return Math.min(value, wallet);
}

/** P&L on a position, signed for its direction. Excludes fees. */
const grossPnl = (type, entry, exit, qty) =>
  type === 'sell' ? (entry - exit) * qty : (exit - entry) * qty;

const feeFor = (entry, qty) => round2(entry * qty * FEE_RATE);

// ---------------------------------------------------------------- row mapping

const mapPosition = (p) => ({
  id: p.id,
  botId: p.bot_id,
  symbol: p.symbol,
  type: p.type,
  quantity: p.quantity,
  entryPrice: p.entry_price,
  stopLoss: p.stop_loss ?? undefined,
  takeProfit: p.take_profit ?? undefined,
  openedAt: p.opened_at,
});

const mapClosedPosition = (c) => ({
  id: c.id,
  botId: c.bot_id,
  symbol: c.symbol,
  type: c.type,
  quantity: c.quantity,
  entryPrice: c.entry_price,
  exitPrice: c.exit_price,
  stopLoss: c.stop_loss ?? undefined,
  takeProfit: c.take_profit ?? undefined,
  pnl: c.pnl,
  pnlPct: c.pnl_pct,
  fee: c.fee,
  status: c.status,
  openedAt: c.opened_at,
  closedAt: c.closed_at,
});

/**
 * Every bot for a user, shaped exactly like the client's `Bot` interface so the
 * UI components need no translation layer.
 */
export function listBots(uid) {
  ensureUser(uid);
  const bots = db.prepare('SELECT * FROM bots WHERE uid = ? ORDER BY created_at ASC').all(uid);
  if (bots.length === 0) return [];

  const openRows = db.prepare("SELECT * FROM positions WHERE uid = ? AND status = 'open'").all(uid);
  const closedRows = db.prepare('SELECT * FROM closed_positions WHERE uid = ? ORDER BY closed_at DESC').all(uid);

  const openByBot = new Map();
  for (const p of openRows) {
    if (!openByBot.has(p.bot_id)) openByBot.set(p.bot_id, []);
    openByBot.get(p.bot_id).push(mapPosition(p));
  }
  const closedByBot = new Map();
  for (const c of closedRows) {
    if (!closedByBot.has(c.bot_id)) closedByBot.set(c.bot_id, []);
    closedByBot.get(c.bot_id).push(mapClosedPosition(c));
  }

  return bots.map((b) => {
    const closedPositions = closedByBot.get(b.id) || [];
    return {
      id: b.id,
      name: b.name,
      createdAt: b.created_at,
      symbols: JSON.parse(b.symbols || '[]'),
      allocationType: b.allocation_type,
      allocationValue: b.allocation_value,
      frozenAmount: b.frozen_amount,
      status: b.status,
      positions: openByBot.get(b.id) || [],
      closedPositions,
      totalPnl: closedPositions.reduce((s, c) => s + c.pnl, 0),
      closedTrades: closedPositions.length,
      winningTrades: closedPositions.filter((c) => c.pnl > 0).length,
      stopLoss: b.stop_loss ?? undefined,
      takeProfit: b.take_profit ?? undefined,
      interval: b.interval,
      botProvider: b.bot_provider ?? undefined,
      botQuickModel: b.bot_quick_model ?? undefined,
      botDeepModel: b.bot_deep_model ?? undefined,
    };
  });
}

export function getBot(uid, id) {
  return listBots(uid).find((b) => b.id === id) || null;
}

export function listOpenPositions(uid) {
  ensureUser(uid);
  return db
    .prepare("SELECT * FROM positions WHERE uid = ? AND status = 'open' ORDER BY opened_at DESC")
    .all(uid)
    .map(mapPosition);
}

export function getTradeHistory(uid, limit = 50) {
  ensureUser(uid);
  const trades = db
    .prepare('SELECT * FROM trade_history WHERE uid = ? ORDER BY created_at DESC LIMIT ?')
    .all(uid, Number.isFinite(limit) ? limit : 50)
    .map((t) => ({
      id: t.id,
      botId: t.bot_id,
      symbol: t.symbol,
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      amount: t.amount,
      pnl: t.pnl,
      status: t.status,
      tradingMode: t.trading_mode,
      createdAt: t.created_at,
    }));
  const row = db.prepare('SELECT SUM(pnl) AS total FROM closed_positions WHERE uid = ?').get(uid);
  return { trades, totalPnl: row?.total || 0 };
}

/** Capital a running bot still has free to open new positions with. */
function availableForBot(botId, frozenAmount) {
  const row = db
    .prepare("SELECT COALESCE(SUM(entry_price * quantity), 0) AS used FROM positions WHERE bot_id = ? AND status = 'open'")
    .get(botId);
  return frozenAmount - (row ? row.used : 0);
}

// ------------------------------------------------------------------ bot CRUD

export function createBot(uid, config) {
  ensureUser(uid);
  const wallet = getWallet(uid);
  const frozen = calcFrozen(wallet, config.allocationType, config.allocationValue);
  if (frozen <= 0) throw new Error('Allocation must be greater than zero and within your wallet balance');

  const id = newId();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO bots (id, uid, name, symbols, allocation_type, allocation_value, frozen_amount,
                        status, stop_loss, take_profit, interval, bot_provider, bot_quick_model, bot_deep_model, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'stopped', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, uid, config.name || id, JSON.stringify(config.symbols || []),
      config.allocationType || 'percentage', Number(config.allocationValue) || 0, frozen,
      config.stopLoss ?? null, config.takeProfit ?? null, config.interval ?? 5,
      config.botProvider ?? null, config.botQuickModel ?? null, config.botDeepModel ?? null, nowIso(),
    );
    addToWallet(uid, -frozen);
  })();

  logger.info('trade', `[${id}] Bot created — frozen=${frozen} uid=${uid}`);
  return getBot(uid, id);
}

export function updateBot(uid, id, changes) {
  const row = db.prepare('SELECT * FROM bots WHERE id = ? AND uid = ?').get(id, uid);
  if (!row) return null;

  db.transaction(() => {
    // Re-allocating resizes the frozen capital against the wallet the bot would
    // be drawing from, i.e. current wallet plus what it already holds.
    if (changes.allocationType !== undefined || changes.allocationValue !== undefined) {
      const type = changes.allocationType ?? row.allocation_type;
      const value = changes.allocationValue ?? row.allocation_value;
      const newFrozen = calcFrozen(getWallet(uid) + row.frozen_amount, type, value);
      const used = row.frozen_amount - availableForBot(id, row.frozen_amount);
      if (newFrozen < used) throw new Error('Allocation is below the capital currently held in open positions');
      addToWallet(uid, row.frozen_amount - newFrozen);
      db.prepare('UPDATE bots SET allocation_type = ?, allocation_value = ?, frozen_amount = ? WHERE id = ?')
        .run(type, value, newFrozen, id);
    }

    const sets = [];
    const vals = [];
    const put = (col, val) => { sets.push(`${col} = ?`); vals.push(val); };
    if (changes.name !== undefined) put('name', changes.name);
    if (changes.symbols !== undefined) put('symbols', JSON.stringify(changes.symbols));
    if (changes.stopLoss !== undefined) put('stop_loss', changes.stopLoss);
    if (changes.takeProfit !== undefined) put('take_profit', changes.takeProfit);
    if (changes.interval !== undefined) put('interval', changes.interval);
    if (changes.botProvider !== undefined) put('bot_provider', changes.botProvider);
    if (changes.botQuickModel !== undefined) put('bot_quick_model', changes.botQuickModel);
    if (changes.botDeepModel !== undefined) put('bot_deep_model', changes.botDeepModel);
    if (sets.length > 0) {
      db.prepare(`UPDATE bots SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    }
  })();

  return getBot(uid, id);
}

export function setBotStatus(uid, id, status) {
  const row = db.prepare('SELECT * FROM bots WHERE id = ? AND uid = ?').get(id, uid);
  if (!row) return null;

  db.transaction(() => {
    if (status === 'running' && row.status !== 'running') {
      // Re-freeze in case the wallet or allocation changed while stopped.
      const frozen = calcFrozen(getWallet(uid) + row.frozen_amount, row.allocation_type, row.allocation_value);
      addToWallet(uid, row.frozen_amount - frozen);
      db.prepare("UPDATE bots SET status = 'running', frozen_amount = ? WHERE id = ?").run(frozen, id);
    } else if (status === 'stopped') {
      // Idempotent by construction: once wound down there are no open positions
      // and frozen_amount is 0, so repeating this is a no-op. Gating on the
      // previous status instead would strand the capital of a bot that held an
      // allocation without ever having been started.
      // Positions are wound up at their entry price (no P&L) before the bot's
      // capital goes back to the wallet — otherwise their principal, which was
      // drawn from frozen_amount, would be released twice.
      const open = db.prepare("SELECT * FROM positions WHERE bot_id = ? AND status = 'open'").all(id);
      for (const p of open) recordClose(p, p.entry_price, 'stopped', 0, 0);
      db.prepare("DELETE FROM positions WHERE bot_id = ?").run(id);
      db.prepare("UPDATE bots SET status = 'stopped', frozen_amount = 0 WHERE id = ?").run(id);
      addToWallet(uid, row.frozen_amount);
    }
  })();

  return getBot(uid, id);
}

export function deleteBot(uid, id) {
  const row = db.prepare('SELECT * FROM bots WHERE id = ? AND uid = ?').get(id, uid);
  if (!row) return false;

  db.transaction(() => {
    // Open positions are abandoned at their entry price — no P&L, matching the
    // 'stopped' outcome the UI already renders for them.
    const open = db.prepare("SELECT * FROM positions WHERE bot_id = ? AND status = 'open'").all(id);
    for (const p of open) recordClose(p, p.entry_price, 'stopped', 0, 0);
    db.prepare("DELETE FROM positions WHERE bot_id = ?").run(id);
    db.prepare('DELETE FROM bots WHERE id = ?').run(id);
    addToWallet(uid, row.frozen_amount);
  })();

  logger.info('trade', `[${id}] Bot deleted — released=${row.frozen_amount}`);
  return true;
}

// ------------------------------------------------------------------ positions

function recordClose(p, exitPrice, status, pnl, fee) {
  const principal = p.entry_price * p.quantity;
  db.prepare(`
    INSERT INTO closed_positions (id, bot_id, uid, symbol, type, quantity, entry_price, exit_price,
                                  stop_loss, take_profit, pnl, pnl_pct, fee, status, opened_at, closed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId(), p.bot_id, p.uid, p.symbol, p.type, p.quantity, p.entry_price, exitPrice,
    p.stop_loss, p.take_profit, pnl, principal > 0 ? (pnl / principal) * 100 : 0,
    fee, status, p.opened_at, nowIso(),
  );
}

/**
 * Open a position for a bot from an engine signal.
 * Declines when the symbol is already held or the bot has no free capital.
 */
export function openPosition(bot, signal) {
  const symbol = signal.symbol;
  const action = signal.action;
  const price = signal.price || signal.aiEntryPrice;
  if (!symbol || !price || price <= 0) return null;
  if (action !== 'buy' && action !== 'sell') return null;

  const row = db.prepare('SELECT * FROM bots WHERE id = ?').get(bot.id);
  if (!row) return null;

  const held = db
    .prepare("SELECT id FROM positions WHERE bot_id = ? AND symbol = ? AND status = 'open'")
    .get(bot.id, symbol);
  if (held) return null;

  // Size each position as an equal share of the bot's capital across the
  // symbols it watches. Because only one position per symbol is ever open, a
  // fully-invested bot holds exactly its allocation — no idle capital and no
  // single symbol able to consume the lot.
  const symbolCount = Math.max(1, JSON.parse(row.symbols || '[]').length);
  const available = availableForBot(bot.id, row.frozen_amount);
  const tradeAmount = Math.min(row.frozen_amount / symbolCount, available);
  if (!Number.isFinite(tradeAmount) || tradeAmount <= 0) return null;

  const id = newId();
  const quantity = tradeAmount / price;
  db.transaction(() => {
    db.prepare(`
      INSERT INTO positions (id, bot_id, uid, symbol, type, quantity, entry_price, stop_loss, take_profit, status, opened_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `).run(id, bot.id, row.uid, symbol, action, quantity, price, signal.stopLoss ?? null, signal.takeProfit ?? null, nowIso());
    db.prepare(`
      INSERT INTO trade_history (id, uid, bot_id, symbol, type, quantity, price, amount, status, trading_mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'paper', ?)
    `).run(id, row.uid, bot.id, symbol, action, quantity, price, tradeAmount, nowIso());
  })();

  logger.info('trade', `[${bot.id}] Opened ${action.toUpperCase()} ${symbol} qty=${quantity.toFixed(6)} @ ${price}`);
  return { id, symbol, type: action, quantity, entryPrice: price };
}

/** Close one open position at `exitPrice`. Realised P&L settles to the wallet. */
export function closePosition(uid, positionId, exitPrice, status = 'closed') {
  const p = db.prepare("SELECT * FROM positions WHERE id = ? AND uid = ? AND status = 'open'").get(positionId, uid);
  if (!p) return null;

  const exit = Number(exitPrice) > 0 ? Number(exitPrice) : p.entry_price;
  const fee = feeFor(p.entry_price, p.quantity);
  const netPnl = grossPnl(p.type, p.entry_price, exit, p.quantity) - fee;

  db.transaction(() => {
    recordClose(p, exit, status, netPnl, fee);
    db.prepare('DELETE FROM positions WHERE id = ?').run(positionId);
    db.prepare("UPDATE trade_history SET status = 'closed', pnl = ? WHERE id = ?").run(netPnl, positionId);
    addToWallet(uid, netPnl);
  })();

  return { id: positionId, symbol: p.symbol, botId: p.bot_id, pnl: netPnl, exitPrice: exit, status };
}

export function closeAllForBot(uid, botId, prices = {}) {
  const open = db.prepare("SELECT * FROM positions WHERE bot_id = ? AND uid = ? AND status = 'open'").all(botId, uid);
  return open
    .map((p) => closePosition(uid, p.id, prices[p.symbol] || p.entry_price, 'closed'))
    .filter(Boolean);
}

export function updatePositionSltp(uid, positionId, stopLoss, takeProfit) {
  const p = db.prepare("SELECT * FROM positions WHERE id = ? AND uid = ? AND status = 'open'").get(positionId, uid);
  if (!p) return null;
  db.prepare('UPDATE positions SET stop_loss = ?, take_profit = ? WHERE id = ?')
    .run(stopLoss ?? p.stop_loss, takeProfit ?? p.take_profit, positionId);
  return mapPosition(db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId));
}

/** Apply AI-suggested SL/TP to every open position a bot holds in `symbol`. */
export function applySltpBySymbol(botId, symbol, stopLoss, takeProfit) {
  const rows = db
    .prepare("SELECT id FROM positions WHERE bot_id = ? AND symbol = ? AND status = 'open'")
    .all(botId, symbol);
  for (const r of rows) {
    db.prepare('UPDATE positions SET stop_loss = COALESCE(?, stop_loss), take_profit = COALESCE(?, take_profit) WHERE id = ?')
      .run(stopLoss ?? null, takeProfit ?? null, r.id);
  }
  return rows.length;
}

// --------------------------------------------------------- stop/target sweeps

/** Price at which a percentage-distance stop or target triggers. */
const triggerPrice = (type, entry, pct, isStop) => {
  const away = pct / 100;
  const below = isStop ? type === 'buy' : type === 'sell';
  return below ? entry * (1 - away) : entry * (1 + away);
};

/**
 * Close any open position whose stop-loss or take-profit has been reached.
 *
 * Runs on the server's price tick so stops are honoured even when no browser
 * tab is open — previously this only happened inside the Trading page.
 * `prices` maps symbol -> last price.
 */
export function sweepStopsAndTargets(prices, io) {
  if (!prices || Object.keys(prices).length === 0) return [];
  let open;
  try {
    open = db.prepare("SELECT * FROM positions WHERE status = 'open'").all();
  } catch (err) {
    logger.error('trade', `Stop sweep query failed — ${err.message}`);
    return [];
  }

  const closed = [];
  for (const p of open) {
    const price = prices[p.symbol];
    if (!price || price <= 0) continue;

    let hit = null;
    if (p.stop_loss > 0) {
      const stop = triggerPrice(p.type, p.entry_price, p.stop_loss, true);
      if (p.type === 'buy' ? price <= stop : price >= stop) hit = 'sl';
    }
    if (!hit && p.take_profit > 0) {
      const target = triggerPrice(p.type, p.entry_price, p.take_profit, false);
      if (p.type === 'buy' ? price >= target : price <= target) hit = 'tp';
    }
    if (!hit) continue;

    try {
      const result = closePosition(p.uid, p.id, price, hit);
      if (!result) continue;
      closed.push(result);
      logger.info('trade', `[${p.bot_id}] ${hit.toUpperCase()} hit ${p.symbol} @ ${price} pnl=${result.pnl.toFixed(2)}`);
      io?.emit(`user:${p.uid}:positionClosed`, { ...result, reason: hit });
    } catch (err) {
      logger.error('trade', `Auto-close failed for ${p.id} — ${err.message}`);
    }
  }
  return closed;
}
