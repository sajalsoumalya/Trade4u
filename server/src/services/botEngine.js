import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

const processes = new Map();

export function startAIEngine(bot, io) {
  if (processes.has(bot.id)) return false;

  const scriptPath = path.join(PROJECT_ROOT, 'server', 'bot_signal.py');
  const args = [
    scriptPath,
    '--symbols', ...bot.symbols,
    '--interval', '15',
    '--provider', 'opencode',
    '--stop-loss', String(bot.stopLoss || 2),
    '--take-profit', String(bot.takeProfit || 5),
  ];

  const proc = spawn('python3', args, {
    env: {
      ...process.env,
      PYTHONPATH: `${PROJECT_ROOT}:${process.env.PYTHONPATH || ''}`,
      OPENCODE_API_KEY: process.env.OPENCODE_API_KEY || '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let buffer = '';
  proc.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const signal = JSON.parse(trimmed);
        io.emit(`bot:${bot.id}:signal`, signal);
        if ((signal.action === 'buy' || signal.action === 'sell') && signal.symbol) {
          io.emit(`bot:${bot.id}:trade`, signal);
        }
      } catch {
        console.log(`[AI:${bot.id}] ${trimmed}`);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    console.error(`[AI:${bot.id} Error] ${data.toString().trim()}`);
  });

  proc.on('close', (code) => {
    console.log(`[AI:${bot.id}] Process exited with code ${code}`);
    processes.delete(bot.id);
    io.emit(`bot:${bot.id}:status`, { running: false });
  });

  proc.on('error', (err) => {
    console.error(`[AI:${bot.id}] Failed to start: ${err.message}`);
    processes.delete(bot.id);
    io.emit(`bot:${bot.id}:status`, { running: false, error: err.message });
  });

  processes.set(bot.id, { process: proc, io });
  io.emit(`bot:${bot.id}:status`, { running: true });
  return true;
}

export function stopAIEngine(botId) {
  const entry = processes.get(botId);
  if (!entry) return false;
  entry.process.kill('SIGTERM');
  setTimeout(() => {
    if (processes.has(botId)) {
      processes.get(botId).process.kill('SIGKILL');
      processes.delete(botId);
    }
  }, 5000);
  return true;
}

export function isEngineRunning(botId) {
  return processes.has(botId);
}
