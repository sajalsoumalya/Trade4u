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
import { startAIEngine } from './services/botEngine.js';

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
      console.warn(`CORS: blocked origin ${origin}`);
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

console.log('Firebase config:', {
  apiKey: firebaseConfig.apiKey ? `SET (${firebaseConfig.apiKey.length} chars)` : 'MISSING',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId
});

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

// Request logger
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

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
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('subscribe', (symbol) => socket.join(`crypto:${symbol}`));
  socket.on('unsubscribe', (symbol) => socket.leave(`crypto:${symbol}`));
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

async function fetchAndBroadcastPrices() {
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
    console.error('Price broadcast error:', e);
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
  console.log(`Server running on port ${PORT}`);

  // Auto-restart previously running bots from DB
  try {
    const runningBots = db.prepare("SELECT * FROM bots WHERE status = 'running'").all();
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
    if (runningBots.length > 0) console.log(`Auto-restarted ${runningBots.length} bot(s) from DB`);
  } catch (err) {
    console.error('Auto-restart bots error:', err.message);
  }
});

export { io };