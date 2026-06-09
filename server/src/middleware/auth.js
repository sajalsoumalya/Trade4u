import firebaseAdmin from '../services/firebase.js';

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Fallback for local development/testing if Firebase Admin is not configured
  const isFirebaseActive = firebaseAdmin !== null;
  if (!isFirebaseActive) {
    const uid = req.headers['x-uid'] || req.body.uid || req.query.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required (Firebase not configured & no fallback UID)' });
    }
    req.uid = uid;
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required: Token missing' });
  }

  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    req.uid = decodedToken.uid;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  const isFirebaseActive = firebaseAdmin !== null;
  if (!isFirebaseActive || !token) {
    req.uid = req.headers['x-uid'] || req.body.uid || req.query.uid || 'demo';
    return next();
  }

  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    req.uid = decodedToken.uid;
  } catch (error) {
    req.uid = req.headers['x-uid'] || req.body.uid || req.query.uid || 'demo';
  }
  next();
};