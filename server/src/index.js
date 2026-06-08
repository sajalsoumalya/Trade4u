import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import analysisRoutes from './routes/analysis.js';
import cryptoRoutes from './routes/crypto.js';
import tradingRoutes from './routes/trading.js';
import autotradeRoutes from './routes/autotrade.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
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

app.use(cors());
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
});

export { io };