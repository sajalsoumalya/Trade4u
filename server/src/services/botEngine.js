import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

const processes = new Map();

function loadLlmConfig() {
  const configPath = path.join(PROJECT_ROOT, 'server', 'data', 'llm-config.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {}
  }
  return {};
}

export function startAIEngine(bot, io) {
  if (processes.has(bot.id)) return false;

  const config = loadLlmConfig();

  const scriptPath = path.join(PROJECT_ROOT, 'server', 'bot_signal.py');
  const args = [
    scriptPath,
    '--symbols', ...bot.symbols,
    '--interval', '15',
    '--provider', config.provider || 'opencode',
    '--deep-model', config.deepModel || 'minimax-m2.5-free',
    '--quick-model', config.quickModel || 'minimax-m2.5-free',
    '--stop-loss', String(bot.stopLoss || 2),
    '--take-profit', String(bot.takeProfit || 5),
  ];

  if (config.apiKey) {
    args.push('--api-key', config.apiKey);
  }

  const proc = spawn('python3', args, {
    env: {
      ...process.env,
      PYTHONPATH: `${PROJECT_ROOT}:${process.env.PYTHONPATH || ''}`,
      OPENCODE_API_KEY: process.env.OPENCODE_API_KEY || config.apiKey || '',
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
        // Forward every JSON line as a signal
        io.emit(`bot:${bot.id}:signal`, signal);
        // Emit log events for analysis logs
        if (signal.type === 'log') {
          io.emit(`bot:${bot.id}:log`, signal);
        }
        // Emit trade events for buy/sell actions
        if (signal.type === 'signal' && (signal.action === 'buy' || signal.action === 'sell') && signal.symbol) {
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
