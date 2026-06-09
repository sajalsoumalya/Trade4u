import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { decrypt } from './cryptoHelper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

const processes = new Map();

function loadLlmConfig(uid) {
  try {
    const config = db.prepare('SELECT * FROM llm_config WHERE uid = ?').get(uid || 'demo');
    if (config) {
      return {
        provider: config.provider,
        apiKey: decrypt(config.api_key),
        quickModel: config.quick_model,
        deepModel: config.deep_model,
      };
    }
  } catch (err) {
    console.error('Failed to load LLM config from DB:', err.message);
  }
  return {};
}

export function startAIEngine(bot, io) {
  if (processes.has(bot.id)) return false;

  const config = loadLlmConfig(bot.uid);

  const scriptPath = path.join(PROJECT_ROOT, 'server', 'bot_signal.py');
  const args = [
    scriptPath,
    '--symbols', ...bot.symbols,
    '--interval', String(bot.interval || 5),
    '--provider', bot.provider || config.provider || 'opencode',
    '--deep-model', bot.deepModel || config.deepModel || 'deepseek/deepseek-chat',
    '--quick-model', bot.quickModel || config.quickModel || 'deepseek/deepseek-chat',
    '--stop-loss', String(bot.stopLoss || 2),
    '--take-profit', String(bot.takeProfit || 5),
  ];

  if (config.apiKey) {
    args.push('--api-key', config.apiKey);
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
  const providerEnvVar = providerEnvMap[bot.provider || config.provider] || 'OPENAI_API_KEY';

  const proc = spawn('python3', args, {
    env: {
      ...process.env,
      PYTHONPATH: `${PROJECT_ROOT}:${process.env.PYTHONPATH || ''}`,
      [providerEnvVar]: config.apiKey || '',
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
        // Emit SL/TP updates from AI
        if (signal.type === 'update_sltp' && signal.symbol) {
          io.emit(`bot:${bot.id}:update_sltp`, signal);
        }
      } catch {
        console.log(`[AI:${bot.id}] ${trimmed}`);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    console.error(`[AI:${bot.id} Error] ${msg}`);
    // Forward engine errors to the client so they appear in the UI
    if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('401') || msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('traceback')) {
      io.emit(`bot:${bot.id}:engineError`, msg.slice(0, 300));
    }
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
