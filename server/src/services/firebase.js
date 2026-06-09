import { initializeApp, cert } from 'firebase-admin/app';

let firebaseAdmin = null;

function normalizePrivateKey(key) {
  if (!key) return key;
  let normalized = key.trim();

  // Strip surrounding quotes. docker-compose env_file / some env UIs (e.g.
  // Coolify) keep the quotes from KEY="...", so the value starts with a literal
  // " before -----BEGIN and the PEM is unparseable.
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  // Convert literal \n (backslash + n) into real newlines.
  normalized = normalized.replace(/\\n/g, '\n');

  // Already a proper multi-line PEM — ensure a trailing newline and return.
  if (normalized.includes('\n')) {
    return normalized.endsWith('\n') ? normalized : normalized + '\n';
  }

  // No newlines at all — env tooling likely stripped the backslashes, turning
  // every \n into a bare 'n'. Standard PEM wraps base64 at 64 chars, so the
  // body looks like <64chars>n<64chars>n...; rebuild it by taking 64-char lines
  // and dropping the single 'n' separators between them.
  const m = normalized.match(/-----BEGIN PRIVATE KEY-----n?([A-Za-z0-9+/=]*?)n?-----END PRIVATE KEY-----/);
  if (m) {
    const raw = m[1];
    let body = '';
    let i = 0;
    while (i < raw.length) {
      body += raw.substr(i, 64);
      i += 64;
      if (raw[i] === 'n') i += 1; // drop the eaten-backslash separator
    }
    const wrapped = body.replace(/(.{1,64})/g, '$1\n');
    return `-----BEGIN PRIVATE KEY-----\n${wrapped}-----END PRIVATE KEY-----\n`;
  }

  return normalized;
}

// Prefer FIREBASE_PRIVATE_KEY_BASE64 (no quotes/backslashes/newlines for env
// tooling to mangle) when set, otherwise the plain FIREBASE_PRIVATE_KEY. Both
// are normalized, so the base64 may encode a PEM with real or literal newlines.
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
  const privateKey = resolvePrivateKey();
  try {
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
    // Safe diagnostic (NO key material) to tell apart a formatting problem from
    // a corrupted/eaten-backslash key. base64BodyDecodes=false => the key bytes
    // themselves are mangled (use FIREBASE_PRIVATE_KEY_BASE64 or paste the key
    // with real line breaks). base64BodyDecodes=true => the bytes are intact and
    // the error is likely a project/client_email mismatch.
    const bodyMatch = (privateKey || '').match(/-----BEGIN PRIVATE KEY-----\n([\s\S]*?)\n-----END PRIVATE KEY-----/);
    let base64BodyDecodes = false;
    if (bodyMatch) {
      try { base64BodyDecodes = Buffer.from(bodyMatch[1].replace(/\n/g, ''), 'base64').length > 0; } catch (_) {}
    }
    console.error(
      '[firebase] key diagnostic —',
      `source=${process.env.FIREBASE_PRIVATE_KEY_BASE64 ? 'BASE64' : 'PLAIN'}`,
      `startsWithHeader=${(privateKey || '').startsWith('-----BEGIN PRIVATE KEY-----')}`,
      `endsWithFooter=${(privateKey || '').trimEnd().endsWith('-----END PRIVATE KEY-----')}`,
      `lines=${(privateKey || '').split('\n').length}`,
      `base64BodyDecodes=${base64BodyDecodes}`
    );
  }
} else {
  console.warn('Firebase Admin credentials not found in environment. Running in development/demo mode with mock verification.');
}

export default firebaseAdmin;
