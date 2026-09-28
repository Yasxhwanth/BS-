const express = require('express');
const router = express.Router();
const { Ontology, Alert, PlantData, ChatMessage } = require('../models');
const { protect } = require('../middleware/auth');
const AIEngine = require('../services/aiEngine');
const { isGeminiConfigured, validateGeminiKey, setGeminiKey } = require('../geminiService');

router.get('/status', protect, async (req, res) => {
  res.json({
    success: true,
    data: {
      provider: 'gemini',
      configured: isGeminiConfigured(),
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    },
  });
});

router.post('/config', protect, async (req, res) => {
  try {
    const { apiKey, model } = req.body;
    const modelToUse = model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    let validation = { valid: true };
    if (apiKey) {
      validation = await validateGeminiKey(apiKey, modelToUse);
      setGeminiKey(apiKey, modelToUse);
    }

    res.json({
      success: true,
      message: validation.valid
        ? 'Gemini configuration updated and validated'
        : 'Key saved, but validation returned an issue',
      validation,
      data: {
        configured: isGeminiConfigured(),
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const convId = conversationId || `conv_${req.user._id}_${Date.now()}`;

    // 1. Fetch previous conversation history
    const history = await ChatMessage.find({ conversationId: convId })
      .sort({ createdAt: 1 })
      .limit(20);

    // 2. Save user message
    await ChatMessage.create({
      conversationId: convId,
      role: 'user',
      content: message,
      userId: req.user._id,
    });

    // 3. Get ontology and plant context
    const ontology = await Ontology.findOne({ createdBy: req.user._id });
    const alerts = await Alert.find({ status: 'active' }).limit(10);
    const plantData = await PlantData.findOne({ userId: req.user._id });

    // 4. Generate AI response (Gemini or simulated fallback)
    const aiResponse = await AIEngine.chat(message, {
      ontology,
      alerts,
      plantData,
      history,
      user: req.user,
    });

    // 5. Save assistant response with metadata
    const assistantMsg = await ChatMessage.create({
      conversationId: convId,
      role: 'assistant',
      content: aiResponse.content,
      userId: req.user._id,
      meta: {
        intent: aiResponse.intent,
        confidence: aiResponse.confidence,
        model: aiResponse.model,
        source: aiResponse.source,
      },
    });

    res.json({
      success: true,
      data: {
        conversationId: convId,
        message: assistantMsg,
        ...aiResponse,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/history/:conversationId', protect, async (req, res) => {
  try {
    const messages = await ChatMessage.find({ conversationId: req.params.conversationId }).sort({
      createdAt: 1,
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
