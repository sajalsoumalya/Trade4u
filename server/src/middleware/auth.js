export const requireAuth = (req, res, next) => {
  const uid = req.headers['x-uid'] || req.body.uid;
  if (!uid) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.uid = uid;
  next();
};