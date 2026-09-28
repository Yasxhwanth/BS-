const express = require('express');
const router = express.Router();
const { Alert } = require('../models');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const { status, severity } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: alerts, count: alerts.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/acknowledge', protect, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'acknowledged', acknowledgedBy: req.user._id },
      { new: true }
    );
    const io = req.app.get('io');
    if (io) {
      io.emit('alert:updated', alert);
    }
    res.json({ success: true, data: alert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/resolve', protect, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', resolvedAt: new Date() },
      { new: true }
    );
    const io = req.app.get('io');
    if (io) {
      io.emit('alert:updated', alert);
    }
    res.json({ success: true, data: alert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
