import { Router } from 'express';

const router = Router();

// Common crypto trading pairs
const CRYPTO_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'SOLUSDT',
  'ADAUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT',
  'SHIBUSDT', 'AVAXUSDT', 'LINKUSDT', 'ATOMUSDT', 'UNIUSDT'
];

const POPULAR_PAIRS = [
  { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', name: 'Ethereum' },
  { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT', name: 'BNB' },
  { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', name: 'Solana' },
  { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT', name: 'Ripple' },
];

// Get all available trading pairs
router.get('/pairs', (req, res) => {
  res.json(POPULAR_PAIRS);
});

// Get current price for a symbol
router.get('/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);

    if (!response.ok) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    const data = await response.json();

    res.json({
      symbol: data.symbol,
      price: parseFloat(data.lastPrice),
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      volume: parseFloat(data.volume),
      quoteVolume: parseFloat(data.quoteVolume),
      bidPrice: parseFloat(data.bidPrice),
      askPrice: parseFloat(data.askPrice),
    });
  } catch (error) {
    console.error('Price fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch price' });
  }
});

// Get multiple prices
router.post('/prices', async (req, res) => {
  try {
    const { symbols } = req.body;

    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');

    if (!response.ok) {
      throw new Error('Failed to fetch prices');
    }

    const allData = await response.json();
    const prices = allData
      .filter(t => symbols.includes(t.symbol))
      .map(t => ({
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        priceChange: parseFloat(t.priceChange),
        priceChangePercent: parseFloat(t.priceChangePercent),
        high24h: parseFloat(t.highPrice),
        low24h: parseFloat(t.lowPrice),
        volume: parseFloat(t.volume),
      }));

    res.json(prices);
  } catch (error) {
    console.error('Prices fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// Get klines/candlestick data
router.get('/klines/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = 100 } = req.query;

    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`
    );

    if (!response.ok) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    const data = await response.json();

    const klines = data.map(k => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    res.json(klines);
  } catch (error) {
    console.error('Klines fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch klines' });
  }
});

// Get order book depth
router.get('/depth/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 20 } = req.query;

    const response = await fetch(
      `https://api.binance.com/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=${limit}`
    );

    if (!response.ok) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    const data = await response.json();

    res.json({
      bids: data.bids.map(([price, qty]) => ({ price: parseFloat(price), qty: parseFloat(qty) })),
      asks: data.asks.map(([price, qty]) => ({ price: parseFloat(price), qty: parseFloat(qty) })),
    });
  } catch (error) {
    console.error('Depth fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch order book' });
  }
});

// Get recent trades
router.get('/trades/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 50 } = req.query;

    const response = await fetch(
      `https://api.binance.com/api/v3/trades?symbol=${symbol.toUpperCase()}&limit=${limit}`
    );

    if (!response.ok) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    const data = await response.json();

    const trades = data.map(t => ({
      id: t.id,
      price: parseFloat(t.price),
      qty: parseFloat(t.qty),
      time: t.time,
      isBuyerMaker: t.isBuyerMaker,
    }));

    res.json(trades);
  } catch (error) {
    console.error('Trades fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Get 24hr ticker for all symbols (for market overview)
router.get('/tickers', async (req, res) => {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');

    if (!response.ok) {
      throw new Error('Failed to fetch tickers');
    }

    const data = await response.json();

    // Filter to only include USDT pairs with significant volume
    const filtered = data
      .filter(t => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 1000000)
      .slice(0, 50)
      .map(t => ({
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        priceChange: parseFloat(t.priceChange),
        priceChangePercent: parseFloat(t.priceChangePercent),
        high24h: parseFloat(t.highPrice),
        low24h: parseFloat(t.lowPrice),
        volume: parseFloat(t.volume),
        quoteVolume: parseFloat(t.quoteVolume),
      }));

    res.json(filtered);
  } catch (error) {
    console.error('Tickers fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch tickers' });
  }
});

export default router;