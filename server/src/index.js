import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import analysisRoutes from './routes/analysis.js';
import cryptoRoutes from './routes/crypto.js';
import tradingRoutes from './routes/trading.js';
import autotradeRoutes from './routes/autotrade.js';
import db from './services/db.js';
import { runMigration } from './services/migrate.js';
import { startAIEngine, stopAIEngine, shutdownAllEngines } from './services/botEngine.js';
import { shutdownAnalyses } from './routes/analysis.js';
import { logger, requestLogger } from './services/logger.js';

dotenv.config();
runMigration();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://localhost:8501', 'http://127.0.0.1:5173', 'http://127.0.0.1:8501', 'https://trade4u.soumalya.in'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      // Deliberate (commit 9b8b913): log unknown origins instead of rejecting,
      // so deploys behind proxies / alternate domains aren't hard-blocked.
      // Auth is via Bearer token (not cookies), so reflecting origin is low-risk.
      logger.warn('cors', `Blocked origin ${origin}`);
      callback(null, origin);
    }
  },
  credentials: true
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { 
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins, 
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/api/socket.io',
});

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || (process.env.FIREBASE_PROJECT_ID || 'demo') + '.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'demo',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || (process.env.FIREBASE_PROJECT_ID || 'demo') + '.appspot.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000'
};

logger.info('firebase', `Config — apiKey=${firebaseConfig.apiKey ? 'SET' : 'MISSING'} authDomain=${firebaseConfig.authDomain} projectId=${firebaseConfig.projectId}`);

const staticPath = path.join(__dirname, '../../public');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api', apiLimiter);
app.use(cors(corsOptions));
app.use(express.json());

app.use(requestLogger);

// API routes
app.use('/api/analysis', analysisRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/autotrade', autotradeRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

function injectFirebaseConfig(html) {
  return html.replace('</head>', `<script id="firebase-config" type="application/json">${JSON.stringify(firebaseConfig)}</script></head>`);
}

function serveIndexHtml(res) {
  const indexPath = path.join(staticPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('index.html not found');
  }
  const html = fs.readFileSync(indexPath, 'utf8');
  res.type('html').send(injectFirebaseConfig(html));
}

// Serve root with Firebase config injection
app.get('/', (req, res) => serveIndexHtml(res));

// Favicon — short-circuit to avoid hitting catch-all
app.get('/favicon.ico', (_req, res) => {
  const faviconPath = path.join(staticPath, 'favicon.ico');
  if (fs.existsSync(faviconPath)) {
    return res.sendFile(faviconPath);
  }
  res.status(204).end();
});

// Serve static files (images, JS, CSS) without Firebase config
app.use(express.static(staticPath, {
  index: false,
  maxAge: '1d',
  etag: true
}));

// SPA catch-all: serve index.html with Firebase config for all non-API, non-static routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return;
  serveIndexHtml(res);
});

// Error handler — prevents 504 hangs on uncaught errors
app.use((err, _req, res, _next) => {
  logger.error('express', `Unhandled error — ${err.message}`, err);
  res.status(500).json({ error: 'Internal server error' });
});

io.on('connection', (socket) => {
  logger.info('socket', `Client connected — id=${socket.id}`);
  socket.on('subscribe', (symbol) => {
    socket.join(`crypto:${symbol}`);
    logger.info('socket', `Client ${socket.id} subscribed to ${symbol}`);
  });
  socket.on('unsubscribe', (symbol) => {
    socket.leave(`crypto:${symbol}`);
    logger.info('socket', `Client ${socket.id} unsubscribed from ${symbol}`);
  });
  socket.on('disconnect', () => logger.info('socket', `Client disconnected — id=${socket.id}`));
});

let fetchingPrices = false;
async function fetchAndBroadcastPrices() {
  if (fetchingPrices) return;
  fetchingPrices = true;
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    if (!response.ok) return;
    const allData = await response.json();
    for (const t of allData) {
      if (symbols.includes(t.symbol)) {
        broadcastCryptoPrice(t.symbol, {
          price: parseFloat(t.lastPrice),
          priceChange: parseFloat(t.priceChange),
          priceChangePercent: parseFloat(t.priceChangePercent),
          high24h: parseFloat(t.highPrice),
          low24h: parseFloat(t.lowPrice),
          volume: parseFloat(t.volume),
          quoteVolume: parseFloat(t.quoteVolume),
        });
      }
    }
  } catch (e) {
    logger.error('price-broadcast', `Failed — ${e.message}`, e);
  } finally {
    fetchingPrices = false;
  }
}

setInterval(fetchAndBroadcastPrices, 10000);
fetchAndBroadcastPrices();

export function broadcastCryptoPrice(symbol, priceData) {
  io.to(`crypto:${symbol}`).emit('crypto-price', { symbol, ...priceData, timestamp: Date.now() });
}

app.set('io', io);

const PORT = process.env.PORT || 8501;
httpServer.listen(PORT, () => {
  logger.info('server', `Listening on port ${PORT}`);

  // Auto-restart previously running bots from DB
  try {
    const runningBots = db.prepare("SELECT * FROM bots WHERE status = 'running'").all();
    logger.info('server', `Auto-restarting ${runningBots.length} bot(s) from DB`);
    for (const bot of runningBots) {
      const symbols = JSON.parse(bot.symbols || '[]');
      startAIEngine({
        id: bot.id,
        uid: bot.uid,
        symbols,
        stopLoss: bot.stop_loss,
        takeProfit: bot.take_profit,
        interval: bot.interval,
        provider: bot.bot_provider,
        quickModel: bot.bot_quick_model,
        deepModel: bot.bot_deep_model,
      }, io);
    }
  } catch (err) {
    logger.error('server', `Auto-restart bots failed — ${err.message}`, err);
  }

  // Mark in-flight analyses as failed (they died when the container stopped)
  try {
    const affected = db.prepare(`
      UPDATE analyses SET status = 'failed', error = 'Server redeployed — analysis was interrupted.', updated_at = datetime('now')
      WHERE status IN ('running', 'pending')
    `).run();
    if (affected.changes > 0) logger.info('server', `Marked ${affected.changes} interrupted analysis(es) as failed`);
  } catch (err) {
    logger.error('server', `Cleanup analyses failed — ${err.message}`, err);
  }

  // Mark in-progress decision logs as interrupted
  try {
    const affected = db.prepare(`
      UPDATE decision_logs SET status = 'error', error = 'Bot engine restarted — cycle was interrupted.'
      WHERE status = 'running'
    `).run();
    if (affected.changes > 0) logger.info('server', `Marked ${affected.changes} interrupted decision log(s) as errored`);
  } catch (err) {
    logger.error('server', `Cleanup decision logs failed — ${err.message}`, err);
  }
});

process.on('SIGTERM', () => {
  logger.info('server', 'SIGTERM received — shutting down gracefully...');
  shutdownAllEngines();
  shutdownAnalyses();
  httpServer.close(() => {
    logger.info('server', 'HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('server', 'Forced exit after timeout.');
    process.exit(1);
  }, 8000);
});

process.on('SIGINT', () => {
  logger.info('server', 'SIGINT received — shutting down...');
  process.exit(0);
});

export { io };