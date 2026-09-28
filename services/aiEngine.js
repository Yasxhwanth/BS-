const { askGemini, isGeminiConfigured } = require('../geminiService');

const AIEngine = {
  // Generate AI response based on ontology context and Gemini
  chat: async (message, context = {}) => {
    const ontology = context?.nodes ? context : (context.ontology || null);
    const alerts = context.alerts || [];
    const plantData = context.plantData || null;
    const history = context.history || [];
    const user = context.user || null;

    let geminiError = null;

    // 1. Attempt Gemini if configured
    if (isGeminiConfigured()) {
      try {
        const geminiRes = await askGemini({
          message,
          history,
          ontology,
          alerts,
          plantData,
          user,
        });
        if (geminiRes && geminiRes.content) {
          return geminiRes;
        }
        if (geminiRes && geminiRes.error) {
          geminiError = geminiRes.error;
        }
      } catch (err) {
        console.error('[Gemini AI] Call failed, using fallback:', err.message);
        geminiError = err.message;
      }
    }

    // 2. Fallback: Ontology-aware simulated engine
    const msg = message.toLowerCase();
    const nodes = ontology?.nodes || [];
    const processNodes = nodes.filter(n => n.type === 'process').map(n => n.data?.label).join(', ');
    const sensorNodes = nodes.filter(n => n.type === 'sensor').map(n => n.data?.label).join(', ');
    const workerNodes = nodes.filter(n => n.type === 'worker').map(n => n.data?.label).join(', ');

    let fallbackReply = '';
    let intent = 'general';
    let confidence = 75;

    if (msg.includes('maintenance') || msg.includes('repair')) {
      fallbackReply = `Based on your ontology, I have detected that processes (${processNodes || 'N/A'}) may require scheduled maintenance. Recommend checking vibration sensors for anomalies. Predicted next failure: 72 hours.`;
      intent = 'maintenance';
      confidence = 87;
    } else if (msg.includes('sensor') || msg.includes('temperature') || msg.includes('vibration')) {
      fallbackReply = `Current sensors in your ontology: ${sensorNodes || 'None configured'}. All readings are within acceptable thresholds. Last anomaly detected 4 hours ago on Vibration Sensor S-02.`;
      intent = 'sensor_query';
      confidence = 92;
    } else if (msg.includes('worker') || msg.includes('operator') || msg.includes('technician')) {
      fallbackReply = `Worker roles in your ontology: ${workerNodes || 'None configured'}. Current shift utilization is at 78%. Recommend reassigning 2 operators from Assembly to Quality Check.`;
      intent = 'workforce';
      confidence = 79;
    } else if (msg.includes('quality') || msg.includes('defect')) {
      fallbackReply = `Quality analysis from your ontology shows 94.2% pass rate this week. 3 defects traced back to Welding Process -> Material Feed. AI recommends adjusting weld temperature by -5 deg C.`;
      intent = 'quality';
      confidence = 91;
    } else if (msg.includes('production') || msg.includes('output') || msg.includes('efficiency')) {
      fallbackReply = `Production efficiency is at 87.3% based on current ontology data. Assembly Process is the bottleneck with 12% idle time. AI predicts 6% improvement if material supply is optimized.`;
      intent = 'production';
      confidence = 84;
    } else if (msg.includes('alert') || msg.includes('warning')) {
      fallbackReply = `There are currently 3 active alerts in the system: 1 critical (Pressure Sensor P-01 threshold exceeded), 1 high (Assembly Process downtime), 1 medium (Material stock at 15%). Immediate action required on critical alert.`;
      intent = 'alerts';
      confidence = 96;
    } else {
      fallbackReply = `I am your Manufacturing AI Assistant. Your current ontology has ${nodes.length} entities. I can help with predictive maintenance, quality analysis, sensor monitoring, workforce optimization, and production efficiency. What would you like to explore?`;
    }

    let hint = '';
    if (geminiError) {
      hint = `\n\n*(Gemini Notice: ${geminiError})*`;
    } else if (!isGeminiConfigured()) {
      hint = '\n\n*(Tip: Add your GEMINI_API_KEY to .env or in the AI Key config above to activate live Google Gemini)*';
    }

    return {
      content: fallbackReply + hint,
      intent,
      confidence,
      model: geminiError ? 'simulated-engine (fallback)' : 'simulated-engine',
      source: 'simulation',
      error: geminiError || undefined,
    };
  },

  // Predictive maintenance score
  predictMaintenance: (nodeType, sensorReadings) => {
    const recent = sensorReadings?.slice(-10) || [];
    const avgAnomaly = recent.reduce((a, r) => a + (r.anomalyScore || 0), 0) / (recent.length || 1);
    const score = Math.min(100, avgAnomaly * 10 + Math.random() * 20);
    return {
      score: Math.round(score),
      risk: score > 70 ? 'high' : score > 40 ? 'medium' : 'low',
      predictedFailureHours: Math.round(200 - score * 1.5),
      recommendation: score > 70 ? 'Immediate inspection required' : score > 40 ? 'Schedule maintenance within 48h' : 'Continue monitoring',
    };
  },

  // Detect anomalies in sensor readings
  detectAnomaly: (value, threshold) => {
    if (!threshold) return { isAnomaly: false, score: 0 };
    const deviation = Math.abs(value - (threshold.warning || 0));
    const isAnomaly = value > (threshold.critical || Infinity) || value < 0;
    return { isAnomaly, score: Math.round((deviation / (threshold.warning || 1)) * 50) };
  },
};

module.exports = AIEngine;
