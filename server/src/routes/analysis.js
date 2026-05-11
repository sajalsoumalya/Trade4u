import { Router } from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const analysesFile = path.join(DATA_DIR, 'analyses.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(analysesFile)) {
  fs.writeFileSync(analysesFile, JSON.stringify([]));
}

const readAnalyses = () => JSON.parse(fs.readFileSync(analysesFile, 'utf8'));
const writeAnalyses = (data) => fs.writeFileSync(analysesFile, JSON.stringify(data, null, 2));
const newId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const router = Router();

router.post('/run', requireAuth, async (req, res) => {
  try {
    const { symbol, date, provider, deepModel, quickModel, apiKey } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }

    const analysisDate = date || new Date().toISOString().split('T')[0];
    const uid = req.uid;
    const id = newId();

    const analyses = readAnalyses();
    const analysis = {
      id,
      uid,
      symbol: symbol.toUpperCase(),
      date: analysisDate,
      status: 'pending',
      decision: null,
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    analyses.unshift(analysis);
    writeAnalyses(analyses);

    const io = req.app.get('io');
    io.emit(`analysis:${id}`, { status: 'starting' });

    const scriptPath = process.env.PYTHON_ANALYSIS_SCRIPT ||
      '/Users/soumalya/Documents/GitHub/Trade4u/main.py';

    const args = [scriptPath, '--ticker', symbol, '--date', analysisDate];
    if (provider) args.push('--provider', provider);
    if (deepModel) args.push('--deep-model', deepModel);
    if (quickModel) args.push('--quick-model', quickModel);
    if (apiKey) args.push('--api-key', apiKey);

    const python = spawn('python3', args, { env: { ...process.env } });

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { errorOutput += data.toString(); });

    python.on('close', async (code) => {
      let decision = null;
      if (output.includes('BUY') || output.includes('Buy')) decision = 'BUY';
      else if (output.includes('SELL') || output.includes('Sell')) decision = 'SELL';
      else if (output.includes('HOLD') || output.includes('Hold')) decision = 'HOLD';

      const updated = readAnalyses().map(a => a.id === id ? {
        ...a,
        status: code === 0 ? 'completed' : 'failed',
        decision,
        result: output.substring(0, 10000),
        error: errorOutput.substring(0, 5000),
        updatedAt: new Date().toISOString()
      } : a);
      writeAnalyses(updated);

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

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const analyses = readAnalyses();
    const analysis = analyses.find(a => a.id === id);

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    if (analysis.uid !== req.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const analyses = readAnalyses().filter(a => a.uid === req.uid).slice(0, parseInt(limit));
    res.json(analyses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;