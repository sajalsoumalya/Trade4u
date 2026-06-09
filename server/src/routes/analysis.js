import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { optionalAuth } from '../middleware/auth.js';
import db from '../services/db.js';
import { decrypt } from '../services/cryptoHelper.js';

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

    // Fetch user LLM config from DB to resolve credentials and fallbacks
    const config = db.prepare('SELECT * FROM llm_config WHERE uid = ?').get(uid);

    // Determine target provider, models and key based on request parameters -> user settings config -> system fallback config
    let targetProvider = provider || (config ? config.provider : '') || (config ? config.fallback_provider : '') || 'opencode';
    let targetQuickModel = quickModel || (config ? config.quick_model : '') || (config ? config.fallback_quick_model : '') || 'minimax-m2.5-free';
    let targetDeepModel = deepModel || (config ? config.deep_model : '') || (config ? config.fallback_deep_model : '') || 'minimax-m2.5-free';
    let targetApiKey = apiKey;

    if (targetApiKey === '●●●●●●●●' || targetApiKey === '******' || !targetApiKey) {
      if (config) {
        if (targetProvider === config.provider) {
          targetApiKey = config.api_key ? decrypt(config.api_key) : '';
        } else if (targetProvider === config.fallback_provider) {
          targetApiKey = config.fallback_api_key ? decrypt(config.fallback_api_key) : '';
        } else {
          targetApiKey = '';
        }
      } else {
        targetApiKey = '';
      }
    }

    // Override local variables with final resolved targets
    provider = targetProvider;
    quickModel = targetQuickModel;
    deepModel = targetDeepModel;
    apiKey = targetApiKey;

    db.prepare(`
      INSERT INTO analyses (id, uid, symbol, date, status, decision, result, error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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

    const python = spawn(process.env.PYTHON || 'python3', args, { env: { ...process.env } });

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { errorOutput += data.toString(); });

    python.on('close', async (code) => {
      let decision = null;
      const buyMatch = output.match(/\bBUY\b/);
      const sellMatch = output.match(/\bSELL\b/);
      const holdMatch = output.match(/\bHOLD\b/);
      if (buyMatch) decision = 'BUY';
      else if (sellMatch) decision = 'SELL';
      else if (holdMatch) decision = 'HOLD';

      db.prepare(`
        UPDATE analyses
        SET status = ?, decision = ?, result = ?, error = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        code === 0 ? 'completed' : 'failed',
        decision,
        output.substring(0, 10000),
        errorOutput.substring(0, 5000),
        id
      );

      io.emit(`analysis:${id}`, {
        status: code === 0 ? 'completed' : 'failed',
        decision,
        result: output.substring(0, 10000)
      });
    });

    res.json({ id, symbol: symbol.toUpperCase(), date: analysisDate, status: 'started' });
  } catch (error) {
    console.error('Analysis error:', error);
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
      error: a.error,
      createdAt: a.created_at,
      updatedAt: a.updated_at
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;