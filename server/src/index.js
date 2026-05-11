import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Firebase config from environment
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || (process.env.FIREBASE_PROJECT_ID || 'demo') + '.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'demo',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || (process.env.FIREBASE_PROJECT_ID || 'demo') + '.appspot.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000'
};

// Log config status (without secrets)
console.log('Firebase config:', {
  apiKey: firebaseConfig.apiKey ? `SET (${firebaseConfig.apiKey.length} chars)` : 'MISSING',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId
});

const staticPath = path.join(__dirname, '../../public');

app.use(cors());
app.use(express.json());

// Import routes
import analysisRoutes from './routes/analysis.js';
import cryptoRoutes from './routes/crypto.js';
import tradingRoutes from './routes/trading.js';
import marketRoutes from './routes/market.js';

// Use routes
app.use('/api/analysis', analysisRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/market', marketRoutes);

// Inject Firebase config into HTML (before static middleware)
app.get('*', (req, res, next) => {
  if (req.path === '/index.html' || req.path === '/') {
    const indexPath = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf8');
      html = html.replace('</head>', `<script id="firebase-config" type="application/json">${JSON.stringify(firebaseConfig)}</script></head>`);
      return res.send(html);
    }
  }
  next();
});

app.use(express.static(staticPath));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all for React SPA (inject config)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf8');
      html = html.replace('</head>', `<script id="firebase-config" type="application/json">${JSON.stringify(firebaseConfig)}</script></head>`);
      return res.send(html);
    }
  }
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join symbol-specific room for crypto price updates
  socket.on('subscribe', (symbol) => {
    socket.join(`crypto:${symbol}`);
    console.log(`Client ${socket.id} subscribed to ${symbol}`);
  });

  socket.on('unsubscribe', (symbol) => {
    socket.leave(`crypto:${symbol}`);
  });

  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Start Binance WebSocket proxy (in production, use separate service)
let binanceWs = null;
if (process.env.NODE_ENV === 'production') {
  // In production, set up WebSocket to Binance
  // This is a simplified version - in production use a proper WebSocket client
}

// Broadcast to specific crypto room
export function broadcastCryptoPrice(symbol, priceData) {
  io.to(`crypto:${symbol}`).emit('crypto-price', {
    symbol,
    ...priceData,
    timestamp: Date.now()
  });
}

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 8501;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };