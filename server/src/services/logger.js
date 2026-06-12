const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const PAD = 5;

const ctx = (label) => `[${label}]`;

function ts() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function log(level, tag, message, ...meta) {
  const lvl = level.padEnd(PAD);
  const extra = meta.length ? ' ' + meta.map(m => {
    if (m instanceof Error) return m.stack || m.message;
    try { return JSON.stringify(m); } catch { return String(m); }
  }).join(' ') : '';
  console.log(`${ts()} ${lvl} ${ctx(tag)} ${message}${extra}`);
}

export const logger = {
  debug: (tag, msg, ...m) => log('DEBUG', tag, msg, ...m),
  info:  (tag, msg, ...m) => log('INFO',  tag, msg, ...m),
  warn:  (tag, msg, ...m) => log('WARN',  tag, msg, ...m),
  error: (tag, msg, ...m) => log('ERROR', tag, msg, ...m),
};

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    log(level, 'HTTP', `${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
}
