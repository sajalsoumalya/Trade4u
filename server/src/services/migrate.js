import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

export function runMigration() {
  const usersExist = db.prepare('SELECT count(*) as count FROM users').get().count > 0;
  if (usersExist) {
    console.log('Database already initialized. Skipping migration.');
    return;
  }

  console.log('Database is empty. Starting JSON data migration to SQLite...');

  db.transaction(() => {
    // 1. Migrate Balances
    const balancesFile = path.join(DATA_DIR, 'balances.json');
    if (fs.existsSync(balancesFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(balancesFile, 'utf8'));
        for (const entry of data) {
          if (!entry.uid) continue;
          db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(entry.uid);
          db.prepare('INSERT OR IGNORE INTO balances (uid, balance) VALUES (?, ?)')
            .run(entry.uid, entry.balance);
        }
      } catch (err) {
        console.error('Failed to migrate balances:', err.message);
      }
    }

    // 2. Migrate Configs
    const configFile = path.join(DATA_DIR, 'llm-config.json');
    if (fs.existsSync(configFile)) {
      try {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        const defaultUid = 'demo';
        db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(defaultUid);
        db.prepare(`
          INSERT OR IGNORE INTO llm_config (uid, provider, api_key, quick_model, deep_model)
          VALUES (?, ?, ?, ?, ?)
        `).run(defaultUid, config.provider, config.apiKey, config.quickModel, config.deepModel);
      } catch (err) {
        console.error('Failed to migrate config:', err.message);
      }
    }

    // 3. Migrate Trades / History (Manual trading & Autotrading trades)
    const tradesFile = path.join(DATA_DIR, 'trades.json');
    if (fs.existsSync(tradesFile)) {
      try {
        const trades = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
        for (const t of trades) {
          db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(t.uid);
          
          if (t.status === 'open') {
            db.prepare(`
              INSERT OR IGNORE INTO positions (id, uid, symbol, type, quantity, entry_price, status, opened_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(t.id, t.uid, t.symbol, t.type, t.quantity, t.price, 'open', t.openedAt);
          } else if (t.status === 'closed') {
            db.prepare(`
              INSERT OR IGNORE INTO closed_positions (id, uid, symbol, type, quantity, entry_price, exit_price, pnl, status, opened_at, closed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(t.id, t.uid, t.symbol, t.type, t.quantity, t.price, t.closePrice || t.price, t.pnl || 0.0, 'closed', t.openedAt, t.closedAt);
          }

          db.prepare(`
            INSERT OR IGNORE INTO trade_history (id, uid, symbol, type, quantity, price, amount, pnl, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(t.id, t.uid, t.symbol, t.type, t.quantity, t.price, t.quantity * (t.price || 0), t.pnl || 0.0, t.status, t.openedAt || t.createdAt);
        }
      } catch (err) {
        console.error('Failed to migrate trades:', err.message);
      }
    }

    // 4. Migrate Positions (Autotrading positions)
    const positionsFile = path.join(DATA_DIR, 'positions.json');
    if (fs.existsSync(positionsFile)) {
      try {
        const positions = JSON.parse(fs.readFileSync(positionsFile, 'utf8'));
        for (const p of positions) {
          db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(p.uid);
          if (p.status === 'open') {
            db.prepare(`
              INSERT OR IGNORE INTO positions (id, uid, symbol, type, quantity, entry_price, stop_loss, take_profit, status, opened_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(p.id, p.uid, p.symbol, p.type, p.quantity, p.entryPrice, p.stopLoss, p.takeProfit, 'open', p.createdAt || p.openedAt);
          } else if (p.status === 'closed') {
            db.prepare(`
              INSERT OR IGNORE INTO closed_positions (id, uid, symbol, type, quantity, entry_price, exit_price, stop_loss, take_profit, pnl, pnl_pct, status, opened_at, closed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(p.id, p.uid, p.symbol, p.type, p.quantity, p.entryPrice, p.exitPrice, p.stopLoss, p.takeProfit, p.pnl || 0.0, 0.0, 'closed', p.createdAt || p.openedAt, p.closedAt);
          }
        }
      } catch (err) {
        console.error('Failed to migrate positions:', err.message);
      }
    }

    // 5. Migrate Analyses
    const analysesFile = path.join(DATA_DIR, 'analyses.json');
    if (fs.existsSync(analysesFile)) {
      try {
        const analyses = JSON.parse(fs.readFileSync(analysesFile, 'utf8'));
        for (const a of analyses) {
          db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(a.uid);
          db.prepare(`
            INSERT OR IGNORE INTO analyses (id, uid, symbol, date, status, decision, result, error, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(a.id, a.uid, a.symbol, a.date, a.status, a.decision, a.result, a.error, a.createdAt, a.updatedAt);
        }
      } catch (err) {
        console.error('Failed to migrate analyses:', err.message);
      }
    }
  })();

  console.log('JSON files migration transaction complete.');
}
