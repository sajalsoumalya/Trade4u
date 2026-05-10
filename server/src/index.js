import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// Serve static files from React build
const staticPath = path.join(__dirname, '../../public');
app.use(express.static(staticPath));

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
    res.sendFile(path.join(__dirname, '../../public', 'index.html'));
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