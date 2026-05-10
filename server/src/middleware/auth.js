import { getAuth } from 'firebase-admin/auth';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAuth = (req, res, next) => {
  // Check for X-UID header from Firebase (set by client)
  const uid = req.headers['x-uid'] || req.body.uid;
  if (!uid) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.uid = uid;
  next();
};