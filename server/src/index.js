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
  apiKey: firebaseConfig.apiKey ? 'SET' : 'MISSING',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId
});

const staticPath = path.join(__dirname, '../../public');

app.use(cors());
app.use(express.json());
app.use(express.static(staticPath));

// Inject Firebase config into HTML
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy to Python trading agents
const PYTHON_SCRIPT = process.env.PYTHON_SCRIPT || path.join(__dirname, '../../main.py');

app.post('/api/analysis/run', async (req, res) => {
  const { symbol, date } = req.body;

  const python = spawn('python', [PYTHON_SCRIPT], {
    env: { ...process.env, TA_SYMBOL: symbol, TA_DATE: date }
  });

  let output = '';
  python.stdout.on('data', (data) => { output += data; });
  python.stderr.on('data', (data) => { console.error(data.toString()); });

  python.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Analysis failed' });
    }
    try {
      res.json({ result: JSON.parse(output) });
    } catch {
      res.json({ result: output });
    }
  });
});

// Catch-all for React SPA
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(staticPath, 'index.html'));
  }
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 8501;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});