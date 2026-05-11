import { Router } from 'express';
import { spawn } from 'child_process';
import { db } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Run AI analysis using Python TradingAgents
router.post('/run', requireAuth, async (req, res) => {
  try {
    const { symbol, date, provider, deepModel, quickModel } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }

    const analysisDate = date || new Date().toISOString().split('T')[0];
    const uid = req.uid;

    // Create analysis record
    const analysisRef = db.collection('analyses').doc();
    await analysisRef.set({
      uid,
      symbol: symbol.toUpperCase(),
      date: analysisDate,
      status: 'pending',
      decision: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Emit status update
    const io = req.app.get('io');
    io.emit(`analysis:${analysisRef.id}`, { status: 'starting' });

    // Run Python analysis
    const scriptPath = process.env.PYTHON_ANALYSIS_SCRIPT ||
      '/Users/soumalya/Documents/GitHub/Trade4u/main.py';

    const args = [
      scriptPath,
      '--ticker', symbol,
      '--date', analysisDate
    ];

    if (provider) args.push('--provider', provider);
    if (deepModel) args.push('--deep-model', deepModel);
    if (quickModel) args.push('--quick-model', quickModel);

    const python = spawn('python3', args, {
      env: {
        ...process.env,
        PYTHONPATH: process.env.PYTHONPATH,
        OPENCODE_API_KEY: process.env.OPENCODE_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
      }
    });

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', async (code) => {
      let decision = null;
      let result = output;

      // Try to parse decision from output
      if (output.includes('BUY') || output.includes('Buy')) {
        decision = 'BUY';
      } else if (output.includes('SELL') || output.includes('Sell')) {
        decision = 'SELL';
      } else if (output.includes('HOLD') || output.includes('Hold')) {
        decision = 'HOLD';
      }

      await analysisRef.update({
        status: code === 0 ? 'completed' : 'failed',
        decision,
        result: output.substring(0, 10000),
        error: errorOutput.substring(0, 5000),
        updatedAt: new Date().toISOString()
      });

      io.emit(`analysis:${analysisRef.id}`, {
        status: code === 0 ? 'completed' : 'failed',
        decision,
        result: output.substring(0, 10000)
      });
    });

    res.json({
      id: analysisRef.id,
      symbol: symbol.toUpperCase(),
      date: analysisDate,
      status: 'started'
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get analysis by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('analyses').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const data = doc.data();
    if (data.uid !== req.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ id: doc.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get analysis history
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const snapshot = await db.collection('analyses')
      .where('uid', '==', req.uid)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();

    const analyses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(analyses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;