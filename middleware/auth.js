const jwt = require('jsonwebtoken');
const { User } = require('../models');

const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Session expired or user not found' });
    }
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '7d' });

module.exports = {
  protect,
  generateToken,
};
