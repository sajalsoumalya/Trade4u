import { initializeApp, cert } from 'firebase-admin/app';

let firebaseAdmin = null;

function normalizePrivateKey(key) {
  if (!key) return key;
  // Handle literal \n sequences (backslash + n)
  let normalized = key.replace(/\\n/g, '\n');
  // If the key has actual newlines now, it's good
  if (normalized.includes('\n')) return normalized.trim();
  // No newlines — Docker likely ate the backslashes, turning \n into bare n.
  // Re-insert newlines after PEM header/footer and every ~64 base64 chars.
  normalized = normalized
    .replace(/-----BEGIN PRIVATE KEY-----n?/g, '-----BEGIN PRIVATE KEY-----\n')
    .replace(/n?-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----');
  // Insert newline every 64 chars within the base64 body
  const match = normalized.match(/-----BEGIN PRIVATE KEY-----\n([\s\S]*?)\n-----END PRIVATE KEY-----/);
  if (match) {
    const body = match[1].replace(/\n/g, '');
    const wrapped = body.replace(/(.{64})/g, '$1\n').trim();
    normalized = `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
  }
  return normalized.trim();
}

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
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
