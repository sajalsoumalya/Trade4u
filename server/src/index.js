import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyToken } from './middleware/auth.js';
import analysisRoutes from './routes/analysis.js';
import tradingRoutes from './routes/trading.js';
import marketRoutes from './routes/market.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

try {
  initializeApp({
    credential: cert(firebaseConfig)
  });
  console.log('Firebase Admin initialized');
} catch (e) {
  console.log('Firebase already initialized or error:', e.message);
}

export const db = getFirestore();

// Make io available to routes
app.set('io', io);

// Serve static files from React build (if exists)
const staticPath = path.join(__dirname, '../public');
app.use(express.static(staticPath));

// API Routes
app.use('/api/auth', (req, res) => res.json({ status: 'ok' }));
app.use('/api/analysis', analysisRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/market', marketRoutes);

// Catch-all for React SPA
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(staticPath, 'index.html'));
  }
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket for real-time prices
const priceClients = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', (symbol) => {
    priceClients.set(socket.id, symbol);
    console.log(`Client ${socket.id} subscribed to ${symbol}`);
  });

  socket.on('unsubscribe', () => {
    priceClients.delete(socket.id);
  });

  socket.on('disconnect', () => {
    priceClients.delete(socket.id);
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 8501;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };