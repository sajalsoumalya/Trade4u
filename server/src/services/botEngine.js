import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { resolveEngineConfig } from './llmConfig.js';
import { logger } from './logger.js';
import { envVarFor } from './providers.js';
import { openPosition, applySltpBySymbol, newId } from './tradeService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

const processes = new Map();

export function startAIEngine(bot, io) {
  if (processes.has(bot.id)) return false;

  // A bot's own pinned provider/models win; otherwise fall back to the user's
  // saved config. Shared with the analysis route and the Settings connection
  // test so all three resolve the same key for the same provider.
  const { provider, quickModel: qModel, deepModel: dModel, apiKey } = resolveEngineConfig(bot.uid, {
    provider: bot.provider,
    quickModel: bot.quickModel,
    deepModel: bot.deepModel,
  });

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

  const providerEnvVar = envVarFor(provider);

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
  // Register before wiring handlers: startAIEngine bails out early when the id
  // is already present, so reading it back here would always yield undefined
  // and run_cycle would be stuck at 0.
  const entry = { process: proc, io, botUid: bot.uid, cycleCount: 0 };
  processes.set(bot.id, entry);
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
        // Execute buy/sell on the server, then tell the client what actually
        // happened rather than letting it book its own version of the trade.
        if (signal.type === 'signal' && (signal.action === 'buy' || signal.action === 'sell') && signal.symbol) {
          try {
            const opened = openPosition(bot, signal);
            io.emit(`bot:${bot.id}:trade`, { ...signal, executed: !!opened, position: opened });
          } catch (err) {
            logger.error('botEngine', `[${bot.id}] Trade execution error — ${err.message}`, err);
            io.emit(`bot:${bot.id}:trade`, { ...signal, executed: false, error: err.message });
          }
        }
        // Apply AI-suggested SL/TP to the positions this bot already holds.
        if (signal.type === 'update_sltp' && signal.symbol) {
          try {
            applySltpBySymbol(bot.id, signal.symbol, signal.stopLoss, signal.takeProfit);
          } catch (err) {
            logger.error('botEngine', `[${bot.id}] SL/TP update failed — ${err.message}`);
          }
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
            `).run(logId, bot.id, bot.uid, signal.symbol, signal.action || 'hold', signal.price || null, signal.stopLoss || null, signal.takeProfit || null, reasonStr, entry.cycleCount, signal.timestamp || new Date().toISOString());
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
          entry.cycleCount += 1;
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
      `).run(errId, bot.id, bot.uid, 'SYSTEM', 'error', null, msg.slice(0, 2000), entry.cycleCount, new Date().toISOString());
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
