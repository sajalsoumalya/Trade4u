import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'app.db');
const db = new Database(dbPath);

// WAL mode prevents write conflicts from concurrent readers/writers
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  -- Users Table
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now'))
  );

  -- Virtual Balances Table
  CREATE TABLE IF NOT EXISTS balances (
    uid TEXT PRIMARY KEY,
    balance REAL NOT NULL DEFAULT 100000.0,
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
  );

  -- LLM Configuration Table
  CREATE TABLE IF NOT EXISTS llm_config (
    uid TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    api_key TEXT, -- Encrypted (aes-256-gcm format)
    quick_model TEXT,
    deep_model TEXT,
    fallback_provider TEXT DEFAULT 'opencode',
    fallback_api_key TEXT,
    fallback_quick_model TEXT DEFAULT 'minimax-m2.5-free',
    fallback_deep_model TEXT DEFAULT 'minimax-m2.5-free',
    custom_base_url TEXT,           -- used when provider = 'custom'
    fallback_custom_base_url TEXT,  -- used when fallback_provider = 'custom'
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
  );

  -- Bots Instance Persistence Table
  CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    name TEXT NOT NULL,
    symbols TEXT NOT NULL, -- JSON-serialized array of strings, e.g. '["BTCUSDT"]'
    allocation_type TEXT NOT NULL,
    allocation_value REAL NOT NULL,
    frozen_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'stopped',
    stop_loss REAL,
    take_profit REAL,
    interval INTEGER NOT NULL DEFAULT 5,
    bot_provider TEXT,
    bot_quick_model TEXT,
    bot_deep_model TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
  );

  -- Unified Active Positions Table
  CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    bot_id TEXT, -- NULL if manual order
    uid TEXT NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL, -- 'buy' or 'sell'
    quantity REAL NOT NULL,
    entry_price REAL NOT NULL,
    stop_loss REAL,
    take_profit REAL,
    status TEXT NOT NULL DEFAULT 'open',
    opened_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL
  );

  -- Closed Positions Table
  CREATE TABLE IF NOT EXISTS closed_positions (
    id TEXT PRIMARY KEY,
    bot_id TEXT,
    uid TEXT NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    entry_price REAL NOT NULL,
    exit_price REAL NOT NULL,
    stop_loss REAL,
    take_profit REAL,
    pnl REAL NOT NULL,
    pnl_pct REAL NOT NULL,
    fee REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL, -- 'closed', 'sl', 'tp', 'stopped'
    opened_at TEXT NOT NULL,
    closed_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL
  );

  -- Comprehensive Trade/Order History Logger
  CREATE TABLE IF NOT EXISTS trade_history (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    bot_id TEXT,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL, -- 'buy' or 'sell'
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    amount REAL NOT NULL,
    pnl REAL DEFAULT 0.0,
    status TEXT NOT NULL, -- 'open', 'closed', 'executed'
    trading_mode TEXT NOT NULL DEFAULT 'paper',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL
  );

  -- AI Analyses Table
  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    decision TEXT, -- 'BUY', 'SELL', 'HOLD'
    result TEXT, -- Raw text output
    error TEXT, -- Stderr output
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
  );

  -- Bot Decision Logs Table
  CREATE TABLE IF NOT EXISTS decision_logs (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    uid TEXT NOT NULL,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL, -- 'buy', 'sell', 'hold', 'error'
    price REAL,
    stop_loss REAL,
    take_profit REAL,
    status TEXT NOT NULL DEFAULT 'completed', -- 'running', 'completed', 'failed', 'error'
    reasoning TEXT, -- JSON-serialized reasoning log
    error TEXT,
    run_cycle INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
  );
`);

// Add fallback columns to existing DB if they don't exist
try {
  db.exec("ALTER TABLE llm_config ADD COLUMN fallback_provider TEXT DEFAULT 'opencode';");
} catch (_) {}
try {
  db.exec("ALTER TABLE llm_config ADD COLUMN fallback_api_key TEXT;");
} catch (_) {}
try {
  db.exec("ALTER TABLE llm_config ADD COLUMN fallback_quick_model TEXT DEFAULT 'minimax-m2.5-free';");
} catch (_) {}
try {
  db.exec("ALTER TABLE llm_config ADD COLUMN fallback_deep_model TEXT DEFAULT 'minimax-m2.5-free';");
} catch (_) {}

// Add stages column to analyses table if it doesn't exist
try {
  db.exec("ALTER TABLE analyses ADD COLUMN stages TEXT;");
} catch (_) {}

// Add provider_keys column — JSON map of provider -> encrypted api_key
try {
  db.exec("ALTER TABLE llm_config ADD COLUMN provider_keys TEXT DEFAULT '{}';");
} catch (_) {}

// Base URL for the 'custom' provider — an arbitrary OpenAI-compatible endpoint.
// Stored per slot, mirroring how the primary/fallback engines are kept apart.
try {
  db.exec('ALTER TABLE llm_config ADD COLUMN custom_base_url TEXT;');
} catch (_) {}
try {
  db.exec('ALTER TABLE llm_config ADD COLUMN fallback_custom_base_url TEXT;');
} catch (_) {}

// decision_logs.updated_at was written by botEngine before it existed in the
// schema, so the UPDATE that marks a cycle 'completed' failed silently and
// every log stayed 'running' until a reboot flipped it to 'error'.
try {
  db.exec("ALTER TABLE decision_logs ADD COLUMN updated_at TEXT;");
} catch (_) {}

// Recover logs stranded by that bug: anything still 'running' from a previous
// process cannot be in flight now, and anything wrongly marked 'error' by the
// boot cleanup carries that exact message.
try {
  db.prepare(`
    UPDATE decision_logs SET status = 'completed', error = NULL
    WHERE status = 'running' OR error = 'Bot engine restarted — cycle was interrupted.'
  `).run();
} catch (_) {}

// Migrate existing keys into provider_keys so per-provider lookup works
try {
  const rows = db.prepare("SELECT uid, provider, api_key, fallback_provider, fallback_api_key FROM llm_config WHERE provider_keys IS NULL OR provider_keys = '{}'").all();
  for (const r of rows) {
    const keys = {};
    if (r.provider && r.api_key) keys[r.provider] = r.api_key;
    if (r.fallback_provider && r.fallback_api_key) keys[r.fallback_provider] = r.fallback_api_key;
    if (Object.keys(keys).length > 0) {
      db.prepare("UPDATE llm_config SET provider_keys = ? WHERE uid = ?").run(JSON.stringify(keys), r.uid);
    }
  }
} catch (_) {}

logger.info('db', `Schema initialized — path=${dbPath}`);

export default db;
