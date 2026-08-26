import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { optionalAuth } from '../middleware/auth.js';

const runningAnalyses = new Set();
import db from '../services/db.js';
import { resolveEngineConfig } from '../services/llmConfig.js';
import { envVarFor } from '../services/providers.js';
import { logger } from '../services/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const newId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const router = Router();

router.post('/run', optionalAuth, async (req, res) => {
  try {
    let { symbol, date, provider, deepModel, quickModel, apiKey } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }

    const analysisDate = date || new Date().toISOString().split('T')[0];
    const uid = req.uid;
    const id = newId();

    db.prepare('INSERT OR IGNORE INTO users (uid) VALUES (?)').run(uid);

    // Request parameters win, then the user's saved config, then defaults —
    // resolved by the same helper the bot engine and Settings test use, so all
    // three agree on which key belongs to which provider.
    ({ provider, quickModel, deepModel, apiKey } = resolveEngineConfig(uid, {
      provider, quickModel, deepModel, apiKey,
    }));

    logger.info('analysis', `[${id}] Starting — provider=${provider} qModel=${quickModel} dModel=${deepModel} hasKey=${!!apiKey} uid=${uid} symbol=${symbol}`);

    db.prepare(`
      INSERT INTO analyses (id, uid, symbol, date, status, decision, result, error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%S.000Z','now'), strftime('%Y-%m-%dT%H:%M:%S.000Z','now'))
    `).run(id, uid, symbol.toUpperCase(), analysisDate, 'pending', null, null, null);

    const io = req.app.get('io');
    io.emit(`analysis:${id}`, { status: 'starting' });

    const scriptPath = process.env.PYTHON_ANALYSIS_SCRIPT ||
      path.join(PROJECT_ROOT, 'main.py');

    const args = [scriptPath, '--ticker', symbol, '--date', analysisDate];
    if (provider) args.push('--provider', provider);
    if (deepModel) args.push('--deep-model', deepModel);
    if (quickModel) args.push('--quick-model', quickModel);
    if (apiKey) args.push('--api-key', apiKey);

    // Mirror the bot engine's child environment: PYTHONPATH so `tradingagents`
    // imports regardless of the server's working directory, and the provider's
    // own key variable so main.py authenticates even if an SDK reads it from
    // the environment rather than the --api-key argument.
    const childEnv = {
      ...process.env,
      PYTHONPATH: `${PROJECT_ROOT}:${process.env.PYTHONPATH || ''}`,
    };
    if (apiKey) childEnv[envVarFor(provider)] = apiKey;

    const python = spawn(process.env.PYTHON || 'python3', args, { env: childEnv });
    runningAnalyses.add(python);

    let output = '';
    let errorOutput = '';
    let parsedDecision = null;
    const stagesOutput = {};

    // Parse JSON progress lines from stdout in real-time
    python.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'stage') {
            stagesOutput[msg.stage] = msg.output;
            output += msg.output + '\n\n';
            io.emit(`analysis:${id}`, { status: 'stage', stage: msg.stage, name: msg.name, output: msg.output });
          } else if (msg.type === 'complete') {
            parsedDecision = msg.decision;
          } else if (msg.type === 'error') {
            errorOutput += msg.message + '\n';
            io.emit(`analysis:${id}`, { status: 'error_log', error: msg.message });
          }
        } catch (_) { /* non-JSON stdout — add raw */ output += line + '\n'; }
      }
    });

    python.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'error') {
            io.emit(`analysis:${id}`, { status: 'error_log', error: msg.message });
          }
        } catch (_) {
          io.emit(`analysis:${id}`, { status: 'error_log', error: line });
        }
      }
    });

    const ANALYSIS_TIMEOUT_MS = 15 * 60 * 1000;
    const analysisTimeout = setTimeout(() => {
      python.kill('SIGTERM');
      logger.warn('analysis', `[${id}] Timed out after ${ANALYSIS_TIMEOUT_MS}ms`);
      errorOutput += `\n[TIMEOUT] Analysis exceeded ${ANALYSIS_TIMEOUT_MS / 60000} minutes and was terminated.`;
    }, ANALYSIS_TIMEOUT_MS);

    python.on('close', async (code) => {
      runningAnalyses.delete(python);
      clearTimeout(analysisTimeout);

      const decision = parsedDecision || (output.match(/\bBUY\b/) ? 'BUY' : output.match(/\bSELL\b/) ? 'SELL' : output.match(/\bHOLD\b/) ? 'HOLD' : null);

      const stagesJson = Object.keys(stagesOutput).length ? JSON.stringify(stagesOutput) : null;

      db.prepare(`
        UPDATE analyses
        SET status = ?, decision = ?, result = ?, stages = ?, error = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z','now')
        WHERE id = ?
      `).run(
        code === 0 ? 'completed' : 'failed',
        decision,
        output.substring(0, 10000),
        stagesJson,
        errorOutput.substring(0, 5000),
        id
      );

      const errorMsg = errorOutput.trim() ? errorOutput.substring(0, 5000) : null;
      io.emit(`analysis:${id}`, {
        status: code === 0 ? 'completed' : 'failed',
        decision,
        result: output.substring(0, 10000),
        stages: stagesOutput,
        error: errorMsg
      });
    });

    res.json({ id, symbol: symbol.toUpperCase(), date: analysisDate, status: 'started' });
  } catch (error) {
    logger.error('analysis', `Run error — ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id);

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    if (analysis.uid !== req.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: analysis.id,
      uid: analysis.uid,
      symbol: analysis.symbol,
      date: analysis.date,
      status: analysis.status,
      decision: analysis.decision,
      result: analysis.result,
      stages: analysis.stages ? JSON.parse(analysis.stages) : null,
      error: analysis.error,
      createdAt: analysis.created_at,
      updatedAt: analysis.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const analyses = db.prepare('SELECT * FROM analyses WHERE uid = ? ORDER BY created_at DESC LIMIT ?').all(req.uid, parseInt(limit, 10));
    const mapped = analyses.map(a => ({
      id: a.id,
      uid: a.uid,
      symbol: a.symbol,
      date: a.date,
      status: a.status,
      decision: a.decision,
      result: a.result,
      stages: a.stages ? JSON.parse(a.stages) : null,
      error: a.error,
      createdAt: a.created_at,
      updatedAt: a.updated_at
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export function shutdownAnalyses() {
  for (const proc of runningAnalyses) {
    try { proc.kill('SIGTERM'); } catch (_) {}
  }
  runningAnalyses.clear();
}

export default router;