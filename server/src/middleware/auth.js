import firebaseAdmin from '../services/firebase.js';
import { getAuth } from 'firebase-admin/auth';

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
    const decodedToken = await getAuth(firebaseAdmin).verifyIdToken(token);
    req.uid = decodedToken.uid;
  } catch (error) {
    req.uid = req.headers['x-uid'] || req.body.uid || req.query.uid || 'demo';
  }
  next();
};