import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { decrypt } from './cryptoHelper.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

const processes = new Map();

const newId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

function loadLlmConfig(uid) {
  try {
    const config = db.prepare('SELECT * FROM llm_config WHERE uid = ?').get(uid || 'demo');
    if (config) {
      return {
        provider: config.provider,
        apiKey: config.api_key ? decrypt(config.api_key) : '',
        quickModel: config.quick_model,
        deepModel: config.deep_model,
        fallbackProvider: config.fallback_provider || 'opencode',
        fallbackApiKey: config.fallback_api_key ? decrypt(config.fallback_api_key) : '',
        fallbackQuickModel: config.fallback_quick_model || 'minimax-m2.5-free',
        fallbackDeepModel: config.fallback_deep_model || 'minimax-m2.5-free',
      };
    }
  } catch (err) {
    logger.error('botEngine', `loadLlmConfig failed — ${err.message}`);
  }
  return {};
}

async function executeTrade(bot, signal) {
  const symbol = signal.symbol;
  const action = signal.action;
  const price = signal.price || signal.aiEntryPrice;
  if (!price || price <= 0) return;

  // Don't double-up: skip if there's already an open position for this bot+symbol
  const existing = db.prepare('SELECT id FROM positions WHERE bot_id = ? AND symbol = ? AND status = "open"').get(bot.id, symbol);
  if (existing) return;

  const balanceRow = db.prepare('SELECT balance FROM balances WHERE uid = ?').get(bot.uid);
  if (!balanceRow) return;
  const balance = balanceRow.balance;

  let tradeAmount;
  if (bot.allocationType === 'percentage') {
    tradeAmount = balance * (bot.allocationValue / 100);
  } else {
    tradeAmount = Math.min(bot.allocationValue, balance);
  }
  if (tradeAmount <= 0 || balance < tradeAmount) return;

  const quantity = tradeAmount / price;
  const posId = newId();

  db.transaction(() => {
    if (action === 'buy') {
      db.prepare('UPDATE balances SET balance = balance - ? WHERE uid = ?').run(tradeAmount, bot.uid);
    } else {
      db.prepare('UPDATE balances SET balance = balance + ? WHERE uid = ?').run(tradeAmount, bot.uid);
    }
    db.prepare(`INSERT INTO positions (id, bot_id, uid, symbol, type, quantity, entry_price, stop_loss, take_profit, status, opened_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', strftime('%Y-%m-%dT%H:%M:%S.000Z','now'))`)
      .run(posId, bot.id, bot.uid, symbol, action, quantity, price, signal.stopLoss || null, signal.takeProfit || null);
    db.prepare(`INSERT INTO trade_history (id, uid, bot_id, symbol, type, quantity, price, amount, status, trading_mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'paper', strftime('%Y-%m-%dT%H:%M:%S.000Z','now'))`)
      .run(posId, bot.uid, bot.id, symbol, action, quantity, price, tradeAmount);
  })();

  logger.info('botEngine', `[${bot.id}] Auto-executed ${action.toUpperCase()} ${symbol} qty=${quantity.toFixed(6)} price=$${price}`);
}

export function startAIEngine(bot, io) {
  if (processes.has(bot.id)) return false;

  const config = loadLlmConfig(bot.uid);
  logger.info('botEngine', `[${bot.id}] Config lookup — uid=${bot.uid} cfgProvider=${config.provider} cfgApiKey=${!!config.apiKey} fbProvider=${config.fallbackProvider} fbApiKey=${!!config.fallbackApiKey} botProvider=${bot.provider}`);

  // Determine LLM provider/models: bot-specific -> primary config -> system fallback config
  const provider = bot.provider || config.provider || config.fallbackProvider || 'opencode';
  const qModel = bot.quickModel || config.quickModel || config.fallbackQuickModel || 'minimax-m2.5-free';
  const dModel = bot.deepModel || config.deepModel || config.fallbackDeepModel || 'minimax-m2.5-free';

  // Resolve the API key for the *chosen* provider.  First tries to match the
  // provider to the primary or fallback slot (avoids handing e.g. the OpenAI
  // key to a DeepSeek run).  When neither slot matches, falls back to the
  // primary key anyway — matching the behaviour of resolveStoredKey() used by
  // the Settings /test-connection endpoint so the bot and the test agree.
  let apiKey = '';
  if (provider === config.provider) {
    apiKey = config.apiKey || '';
  } else if (provider === config.fallbackProvider) {
    apiKey = config.fallbackApiKey || '';
  } else {
    apiKey = config.apiKey || '';
  }

  const scriptPath = path.join(PROJECT_ROOT, 'server', 'bot_signal.py');
  const args = [
    scriptPath,
    '--symbols', ...bot.symbols,
    '--interval', String(bot.interval || 5),
    '--provider', provider,
    '--deep-model', dModel,
    '--quick-model', qModel,
    '--stop-loss', String(bot.stopLoss || 2),
    '--take-profit', String(bot.takeProfit || 5),
  ];

  logger.info('botEngine', `[${bot.id}] Starting — provider=${provider} qModel=${qModel} dModel=${dModel} hasKey=${!!apiKey}`);

  if (apiKey) {
    args.push('--api-key', apiKey);
  }

  // Map provider to its expected API key env var
  const providerEnvMap = {
    opencode: 'OPENCODE_API_KEY',
    nvidia_nim: 'NVIDIA_NIM_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  };
  const providerEnvVar = providerEnvMap[provider] || 'OPENAI_API_KEY';

  const childEnv = {
    ...process.env,
    PYTHONPATH: `${PROJECT_ROOT}:${process.env.PYTHONPATH || ''}`,
  };
  // Only set the provider key env var when we actually have one, so an empty
  // value doesn't clobber a real key already present in the server environment.
  if (apiKey) childEnv[providerEnvVar] = apiKey;

  const proc = spawn('python3', args, {
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let buffer = '';
  const MAX_BUFFER = 1024 * 64;
  const entry = processes.get(bot.id);
  let pendingLogIds = [];
  proc.stdout.on('data', (data) => {
    buffer += data.toString();
    if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
          const signal = JSON.parse(trimmed);
        // Skip SL/TP error events — not a real analysis log
        if (signal.type === 'sl_tp_error') continue;
        // Forward every JSON line as a signal
        io.emit(`bot:${bot.id}:signal`, signal);
        // Emit log events for analysis logs
        if (signal.type === 'log') {
          io.emit(`bot:${bot.id}:log`, signal);
        }
        // Emit trade events for buy/sell actions
        if (signal.type === 'signal' && (signal.action === 'buy' || signal.action === 'sell') && signal.symbol) {
          io.emit(`bot:${bot.id}:trade`, signal);
          // Auto-execute the position on the server
          executeTrade(bot, signal).catch(err => logger.error('botEngine', `[${bot.id}] Trade execution error — ${err.message}`, err));
        }
        // Emit SL/TP updates from AI
        if (signal.type === 'update_sltp' && signal.symbol) {
          io.emit(`bot:${bot.id}:update_sltp`, signal);
        }

        // Persist each cycle decision to decision_logs
        if (signal.type === 'log' && signal.symbol) {
          const logId = newId();
          const reasonStr = signal.reasoning ? JSON.stringify(signal.reasoning).substring(0, 10000) : null;
          try {
            db.prepare(`
              INSERT INTO decision_logs (id, bot_id, uid, symbol, action, price, stop_loss, take_profit, status, reasoning, error, run_cycle, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, NULL, ?, ?)
            `).run(logId, bot.id, bot.uid, signal.symbol, signal.action || 'hold', signal.price || null, signal.stopLoss || null, signal.takeProfit || null, reasonStr, entry?.cycleCount || 0, signal.timestamp || new Date().toISOString());
          } catch (_) {}
          pendingLogIds.push(logId);
        }
        if (signal.type === 'signal' && signal.symbol && pendingLogIds.length > 0) {
          const logId = pendingLogIds.shift();
          try {
            db.prepare(`
              UPDATE decision_logs SET action = ?, price = ?, stop_loss = ?, take_profit = ?, status = 'completed', updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z','now') WHERE id = ?
            `).run(signal.action || 'hold', signal.price || null, signal.stopLoss || null, signal.takeProfit || null, logId);
          } catch (_) {}
        }
        if (signal.type === 'cycle_complete') {
          if (entry) entry.cycleCount = (entry.cycleCount || 0) + 1;
          // Mark any remaining pending logs as completed
          for (const pid of pendingLogIds) {
            try { db.prepare(`UPDATE decision_logs SET status = 'completed' WHERE id = ?`).run(pid); } catch (_) {}
          }
          pendingLogIds = [];
        }
      } catch {
        logger.info('botEngine', `[${bot.id}] stdout — ${trimmed}`);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (!msg) return;
    logger.error('botEngine', `[${bot.id}] stderr — ${msg}`);
    // Forward engine errors to the client so they appear in the UI
    if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('401') || msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('traceback')) {
      io.emit(`bot:${bot.id}:engineError`, msg.slice(0, 300));
    }
    // Log error to decision_logs
    try {
      const errId = newId();
      db.prepare(`
        INSERT INTO decision_logs (id, bot_id, uid, symbol, action, price, status, error, run_cycle, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'error', ?, ?, ?)
      `).run(errId, bot.id, bot.uid, 'SYSTEM', 'error', null, msg.slice(0, 2000), entry?.cycleCount || 0, new Date().toISOString());
    } catch (_) {}
  });

  proc.on('close', (code) => {
    logger.info('botEngine', `[${bot.id}] Process exited — code=${code}`);
    // Only clear state if the map still points to THIS process — a restart may
    // have already replaced it with a new process under the same bot id.
    if (processes.get(bot.id)?.process === proc) {
      processes.delete(bot.id);
      io.emit(`bot:${bot.id}:status`, { running: false });
    }
  });

  proc.on('error', (err) => {
    logger.error('botEngine', `[${bot.id}] Failed to start — ${err.message}`, err);
    if (processes.get(bot.id)?.process === proc) {
      processes.delete(bot.id);
      io.emit(`bot:${bot.id}:status`, { running: false, error: err.message });
    }
  });

  processes.set(bot.id, { process: proc, io, botUid: bot.uid, cycleCount: 0 });
  io.emit(`bot:${bot.id}:status`, { running: true });
  return true;
}

export function stopAIEngine(botId) {
  const entry = processes.get(botId);
  if (!entry) return false;
  // Free the id immediately so an instant restart (same bot id) isn't rejected
  // by the `processes.has(bot.id)` guard in startAIEngine.
  processes.delete(botId);
  const proc = entry.process;
  proc.kill('SIGTERM');
  // Escalate to SIGKILL for THIS specific process if it hasn't exited. We hold a
  // direct reference (not a map lookup) so a restarted same-id process is safe.
  setTimeout(() => {
    try { proc.kill('SIGKILL'); } catch (_) { /* already exited */ }
  }, 5000);
  return true;
}

export function isEngineRunning(botId) {
  return processes.has(botId);
}

export function shutdownAllEngines() {
  for (const [id, entry] of processes) {
    const proc = entry.process;
    proc.kill('SIGTERM');
    setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 3000);
  }
  processes.clear();
}
