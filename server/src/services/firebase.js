import { initializeApp, cert } from 'firebase-admin/app';

let firebaseAdmin = null;

function normalizePrivateKey(key) {
  if (!key) return key;
  let normalized = key.trim();

  // Strip surrounding quotes. docker-compose `env_file` and some env UIs (e.g.
  // Coolify) keep the quotes from `KEY="..."`, so the value begins with a
  // literal " before -----BEGIN, which makes the PEM unparseable ("failed to
  // parse private key").
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  // Convert literal \n (backslash + n) into real newlines.
  normalized = normalized.replace(/\\n/g, '\n');

  // Already a properly delimited multi-line PEM — ensure a trailing newline
  // (some parsers require it) and return.
  if (normalized.includes('\n')) {
    return normalized.endsWith('\n') ? normalized : normalized + '\n';
  }

  // No newlines at all — the backslashes were likely stripped, turning \n into
  // bare 'n'. Re-insert newlines around the PEM header/footer and wrap the
  // base64 body at 64 chars (best-effort).
  normalized = normalized
    .replace(/-----BEGIN PRIVATE KEY-----n?/g, '-----BEGIN PRIVATE KEY-----\n')
    .replace(/n?-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----');
  const match = normalized.match(/-----BEGIN PRIVATE KEY-----\n([\s\S]*?)\n-----END PRIVATE KEY-----/);
  if (match) {
    const body = match[1].replace(/\n/g, '');
    const wrapped = body.replace(/(.{64})/g, '$1\n').trim();
    normalized = `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----\n`;
  }
  return normalized;
}

// Resolve the private key from FIREBASE_PRIVATE_KEY_BASE64 (bulletproof: base64
// contains no quotes, backslashes, or newlines for env tooling to mangle) when
// present, otherwise the plain FIREBASE_PRIVATE_KEY. Either way it's normalized,
// so the base64 may encode a PEM with real newlines or with literal \n.
function resolvePrivateKey() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (b64 && b64.trim()) {
    try {
      return normalizePrivateKey(Buffer.from(b64.trim(), 'base64').toString('utf8'));
    } catch (err) {
      console.error('Failed to decode FIREBASE_PRIVATE_KEY_BASE64, falling back to FIREBASE_PRIVATE_KEY:', err.message);
    }
  }
  return normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
}

if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  (process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY_BASE64)
) {
  try {
    const privateKey = resolvePrivateKey();
    firebaseAdmin = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      })
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK certified credential:', err.message);
  }
} else {
  console.warn('Firebase Admin credentials not found in environment. Running in development/demo mode with mock verification.');
}

export default firebaseAdmin;
