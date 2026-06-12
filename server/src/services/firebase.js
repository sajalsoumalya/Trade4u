import { initializeApp, cert } from 'firebase-admin/app';
import { logger } from './logger.js';

let firebaseAdmin = null;

const HEADER = '-----BEGIN PRIVATE KEY-----';
const FOOTER = '-----END PRIVATE KEY-----';

function looksLikeDerKey(b64) {
  try {
    const buf = Buffer.from(b64, 'base64');
    return buf.length > 100 && buf[0] === 0x30; // DER SEQUENCE tag
  } catch (_) {
    return false;
  }
}

// Rebuild a clean PEM from a FIREBASE_PRIVATE_KEY value that env tooling (e.g.
// Coolify / docker-compose env_file) may have mangled: surrounding/stray
// quotes, literal \n, \r line endings, trailing junk, or backslashes eaten so
// each \n became a bare 'n'. Strategy: locate the PEM markers, take the body
// between them, keep ONLY base64 characters, and re-wrap at 64 chars. Additive
// corruption (quotes, CRs, spaces, stray newlines, trailing chars) is removed;
// the actual key bytes are preserved.
function normalizePrivateKey(key) {
  if (!key) return key;
  let s = key.trim()
    .replace(/^["']+/, '')              // stray leading quote(s)
    .replace(/["']+$/, '')              // stray trailing quote(s)
    .replace(/\\r\\n|\\n|\\r/g, '\n')   // escaped newlines -> real newlines
    .replace(/\r/g, '');               // drop real carriage returns

  const start = s.indexOf(HEADER);
  const end = s.indexOf(FOOTER);
  if (start === -1 || end === -1 || end <= start) {
    return s.endsWith('\n') ? s : s + '\n'; // markers missing — best effort
  }

  const inner = s.slice(start + HEADER.length, end);
  let body;
  if (/\s/.test(inner)) {
    // Multi-line (real newlines, possibly with stray whitespace): the base64 is
    // intact and only separated — keep only base64 characters.
    body = inner.replace(/[^A-Za-z0-9+/=]/g, '');
  } else {
    // Single blob: if it decodes as-is it's clean; otherwise it's the
    // 'eaten backslash' case — 64-char base64 lines joined by a bare 'n'.
    const plain = inner.replace(/[^A-Za-z0-9+/=]/g, '');
    if (looksLikeDerKey(plain)) {
      body = plain;
    } else {
      // Strip the leading/trailing 'n' that came from the newlines adjacent to
      // the markers, then take 64-char lines and drop the 'n' separators.
      let blob = inner;
      if (blob.startsWith('n')) blob = blob.slice(1);
      if (blob.endsWith('n')) blob = blob.slice(0, -1);
      body = '';
      let i = 0;
      while (i < blob.length) {
        body += blob.substr(i, 64);
        i += 64;
        if (blob[i] === 'n') i += 1; // drop the eaten-backslash separator
      }
      body = body.replace(/[^A-Za-z0-9+/=]/g, '');
    }
  }

  const wrapped = body.replace(/(.{1,64})/g, '$1\n');
  return `${HEADER}\n${wrapped}${FOOTER}\n`;
}

// Optional: FIREBASE_PRIVATE_KEY_BASE64 takes precedence if set; otherwise the
// plain FIREBASE_PRIVATE_KEY is used. Both run through normalizePrivateKey.
function resolvePrivateKey() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (b64 && b64.trim()) {
    try {
      return normalizePrivateKey(Buffer.from(b64.trim(), 'base64').toString('utf8'));
    } catch (err) {
      logger.error('firebase', `Failed to decode FIREBASE_PRIVATE_KEY_BASE64, falling back to FIREBASE_PRIVATE_KEY: ${err.message}`);
    }
  }
  return normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
}

if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  (process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY_BASE64)
) {
  const privateKey = resolvePrivateKey();
  try {
    firebaseAdmin = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      })
    });
    logger.info('firebase', 'Admin SDK initialized successfully.');
  } catch (err) {
    logger.error('firebase', `Failed to initialize Admin SDK credential: ${err.message}`);
    // Safe diagnostic (NO key material). base64BodyDecodes=false means the key
    // bytes are mangled (chars substituted/dropped, not just reformatted);
    // base64BodyDecodes=true means the bytes are intact and the error is a
    // project/client_email mismatch or a revoked key.
    const bodyMatch = (privateKey || '').match(/-----BEGIN PRIVATE KEY-----\n([\s\S]*?)\n-----END PRIVATE KEY-----/);
    let base64BodyDecodes = false;
    if (bodyMatch) {
      try { base64BodyDecodes = Buffer.from(bodyMatch[1].replace(/\n/g, ''), 'base64').length > 100; } catch (_) {}
    }
    logger.error('firebase', `Key diagnostic — source=${process.env.FIREBASE_PRIVATE_KEY_BASE64 ? 'BASE64' : 'PLAIN'} startsWithHeader=${(privateKey || '').startsWith(HEADER)} endsWithFooter=${(privateKey || '').trimEnd().endsWith(FOOTER)} lines=${(privateKey || '').split('\n').length} base64BodyDecodes=${base64BodyDecodes}`);
  }
} else {
  logger.warn('firebase', 'Credentials not found in environment. Running in development/demo mode.');
}

export default firebaseAdmin;
