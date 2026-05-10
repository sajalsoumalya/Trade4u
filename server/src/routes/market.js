import { Router } from 'express';
import yfinance from 'yfinance';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Format symbol for yfinance
const formatSymbol = (symbol) => {
  symbol = symbol.toUpperCase().trim();
  if (symbol.includes('/')) {
    const [base, quote] = symbol.split('/');
    if (['USDT', 'USD', 'USDC'].includes(quote)) {
      return `${base.trim()}-USD`;
    }
  }
  return symbol;
};

// Get live price for a symbol
router.get('/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const formatted = formatSymbol(symbol);

    const ticker = yfinance.Ticker(formatted);
    const info = ticker.fast_info;

    res.json({
      symbol: symbol.toUpperCase(),
      price: info.lastPrice || info.previousClose,
      change: info.regularMarketChange,
      changePercent: info.regularMarketChangePercent,
      high: info.dayHigh,
      low: info.dayLow,
      volume: info.volume,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Price error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get price history
router.get('/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '1mo', interval = '1d' } = req.query;
    const formatted = formatSymbol(symbol);

    const ticker = yfinance.Ticker(formatted);
    const history = ticker.history(period, interval);

    if (!history || history.length === 0) {
      return res.json({ symbol, data: [] });
    }

    const data = history.map(row => ({
      time: Math.floor(new Date(row.Date).getTime() / 1000),
      open: row.Open,
      high: row.High,
      low: row.Low,
      close: row.Close,
      volume: row.Volume
    }));

    res.json({ symbol, data });
  } catch (error) {
    console.error('History error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get multiple prices
router.post('/prices', async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'symbols array required' });
    }

    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const formatted = formatSymbol(symbol);
          const ticker = yfinance.Ticker(formatted);
          const info = ticker.fast_info;
          return {
            symbol: symbol.toUpperCase(),
            price: info.lastPrice || info.previousClose,
            change: info.regularMarketChange,
            changePercent: info.regularMarketChangePercent
          };
        } catch {
          return { symbol: symbol.toUpperCase(), error: 'Failed to fetch' };
        }
      })
    );

    res.json(results);
  } catch (error) {
    console.error('Prices error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;