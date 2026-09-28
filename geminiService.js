const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Helper to check if Gemini key is set
function isGeminiConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() && key !== 'YOUR_GEMINI_API_KEY_HERE');
}

// Update key in memory and .env file
function setGeminiKey(key, model) {
  if (typeof key === 'string') process.env.GEMINI_API_KEY = key.trim();
  if (model) process.env.GEMINI_MODEL = model.trim();

  try {
    const envPath = path.resolve(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    if (envContent.includes('GEMINI_API_KEY=')) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${process.env.GEMINI_API_KEY}`);
    } else {
      envContent += `\nGEMINI_API_KEY=${process.env.GEMINI_API_KEY}`;
    }

    if (model) {
      if (envContent.includes('GEMINI_MODEL=')) {
        envContent = envContent.replace(/GEMINI_MODEL=.*/g, `GEMINI_MODEL=${process.env.GEMINI_MODEL}`);
      } else {
        envContent += `\nGEMINI_MODEL=${process.env.GEMINI_MODEL}`;
      }
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to update .env file:', err.message);
    return false;
  }
}

// Build rich context from ontology, alerts, and plant data
function buildPlantContext({ ontology, alerts = [], plantData = null, user = null }) {
  const nodes = ontology?.nodes || [];
  const edges = ontology?.edges || [];

  const processes = nodes.filter(n => n.type === 'process').map(n => {
    const p = n.data || {};
    return `- ${p.label || n.id} (Subtype: ${p.subtype || 'general'}, Dept: ${p.properties?.department || 'N/A'}, Target OEE: ${p.properties?.targetOEE || 'N/A'}%)`;
  }).join('\n');

  const sensors = nodes.filter(n => n.type === 'sensor').map(n => {
    const p = n.data || {};
    return `- ${p.label || n.id} (Type: ${p.subtype || 'sensor'}, Metric: ${p.properties?.metric || 'N/A'}, Warning Threshold: ${p.properties?.thresholdWarning || 'N/A'}, Critical: ${p.properties?.thresholdCritical || 'N/A'})`;
  }).join('\n');

  const materials = nodes.filter(n => n.type === 'material').map(n => {
    const p = n.data || {};
    return `- ${p.label || n.id} (Type: ${p.subtype || 'raw'}, Stock: ${p.properties?.currentStock || 'N/A'} ${p.properties?.unit || 'units'}, Supplier: ${p.properties?.supplier || 'N/A'})`;
  }).join('\n');

  const workers = nodes.filter(n => n.type === 'worker').map(n => {
    const p = n.data || {};
    return `- ${p.label || n.id} (Role: ${p.subtype || 'operator'}, Shift: ${p.properties?.shift || 'N/A'}, Dept: ${p.properties?.department || 'N/A'})`;
  }).join('\n');

  const products = nodes.filter(n => n.type === 'product').map(n => {
    const p = n.data || {};
    return `- ${p.label || n.id} (SKU: ${p.properties?.sku || 'N/A'}, Cycle Time: ${p.properties?.cycleTimeMinutes || 'N/A'} min)`;
  }).join('\n');

  const departments = nodes.filter(n => n.type === 'department').map(n => {
    const p = n.data || {};
    return `- ${p.label || n.id} (Head: ${p.properties?.manager || 'N/A'}, Shift Count: ${p.properties?.shifts || 'N/A'})`;
  }).join('\n');

  // Format edge relationships
  const relationships = edges.slice(0, 40).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    const tgtNode = nodes.find(n => n.id === e.target);
    const src = srcNode?.data?.label || e.source;
    const tgt = tgtNode?.data?.label || e.target;
    return `${src} ──[${e.relationship || 'connected_to'}]──> ${tgt}`;
  }).join('\n');

  // Active alerts
  const alertList = alerts.length
    ? alerts.map(a => `• [${a.severity.toUpperCase()}] ${a.title}: ${a.message} (Recommendation: ${a.recommendation || 'None'})`).join('\n')
    : 'No active critical alerts.';

  // Plant KPIs
  const kpis = plantData?.kpis;
  const kpiText = kpis
    ? `OEE: ${kpis.oee}%, Efficiency: ${kpis.productionEfficiency}%, Quality Rate: ${kpis.qualityRate}%, MTBF: ${kpis.mtbf}h, MTTR: ${kpis.mttr}h, Active Alerts: ${kpis.activeAlerts}, Energy: ${kpis.energyConsumption} kWh`
    : 'Default plant operational parameters within nominal ranges.';

  return `
SYSTEM PERSONA & INSTRUCTIONS:
You are the AI Manufacturing Copilot for "ManufactureAIP", a state-of-the-art smart factory and industrial knowledge graph analytics platform.
You are assisting ${user?.name ? `${user.name} (${user.role} in ${user.department})` : 'a plant engineer'}.

LIVE PLANT KNOWLEDGE GRAPH & TELEMETRY:
========================================
Summary: ${nodes.length} Ontology Nodes, ${edges.length} Graph Relationships.

Active Processes:
${processes || '- None defined'}

Connected Sensors:
${sensors || '- None defined'}

Materials & Inventory:
${materials || '- None defined'}

Workforce & Operators:
${workers || '- None defined'}

Products & Output:
${products || '- None defined'}

Departments:
${departments || '- None defined'}

Knowledge Graph Relationships:
${relationships || '- None mapped'}

Current Plant Operational KPIs:
${kpiText}

Active System Alerts:
${alertList}
========================================

RESPONSE GUIDELINES:
1. Provide accurate, highly practical industrial engineering insights.
2. Ground your answers directly in the plant's active ontology nodes (processes, sensors, materials, workers, products, departments) whenever applicable.
3. Suggest clear next steps (predictive maintenance scheduling, parameter adjustments, defect root cause analysis, shift reallocation).
4. Format responses cleanly using markdown (bullet points, bold highlights, concise structured sections).
5. Maintain a professional, sharp, and encouraging engineering tone.`;
}

// Generate chat response via Gemini
async function askGemini({ message, history = [], ontology, alerts = [], plantData = null, user = null }) {
  if (!isGeminiConfigured()) {
    return null;
  }

  const apiKey = process.env.GEMINI_API_KEY.trim();
  const systemInstruction = buildPlantContext({ ontology, alerts, plantData, user });
  const genAI = new GoogleGenerativeAI(apiKey);

  // Prepare multi-turn history for Gemini
  // Gemini expects alternation: user, model, user, model...
  const formattedHistory = [];
  for (const item of history) {
    if (!item.content || item.content === message) continue;
    const role = item.role === 'assistant' ? 'model' : 'user';

    // Gemini history must start with 'user'
    if (formattedHistory.length === 0 && role === 'model') {
      continue;
    }

    // Merge consecutive same-role entries if any
    if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === role) {
      formattedHistory[formattedHistory.length - 1].parts[0].text += `\n\n${item.content}`;
    } else {
      formattedHistory.push({
        role,
        parts: [{ text: item.content }],
      });
    }
  }

  // Ensure last message in history was 'model' before starting new user turn
  if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
    formattedHistory.pop();
  }

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const modelsToTry = [preferredModel, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'].filter((m, i, arr) => arr.indexOf(m) === i);

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
      });

      const chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200,
        },
      });

      const result = await chat.sendMessage(message);
      const text = result.response.text();

      // Detect basic intent from response or user query
      let intent = 'manufacturing_intelligence';
      const q = message.toLowerCase();
      if (q.includes('maintenance') || q.includes('failure') || q.includes('repair')) intent = 'predictive_maintenance';
      else if (q.includes('sensor') || q.includes('anomaly') || q.includes('temperature') || q.includes('vibration')) intent = 'sensor_telemetry';
      else if (q.includes('quality') || q.includes('defect') || q.includes('scrap')) intent = 'quality_assurance';
      else if (q.includes('efficiency') || q.includes('oee') || q.includes('bottleneck') || q.includes('production')) intent = 'production_optimization';
      else if (q.includes('alert') || q.includes('warning') || q.includes('critical')) intent = 'alert_analysis';

      return {
        content: text,
        intent,
        confidence: 98,
        model: modelName,
        source: 'gemini',
      };
    } catch (err) {
      lastError = err;
      // If error is a temporary 503 (high demand) or 404 (model not found), try next model
      if (err.message.includes('503') || err.message.includes('404')) {
        console.warn(`[Gemini AI] Model ${modelName} returned 503/404, attempting fallback model...`);
        continue;
      }
      // For auth or billing errors (402/403), break immediately
      break;
    }
  }

  // If all attempts failed:
  let friendlyMessage = lastError ? lastError.message : 'Unknown Gemini error';
  let errorType = 'general_error';

  if (lastError?.message.includes('402')) {
    errorType = 'prepayment_depleted';
    friendlyMessage = 'Google AI Studio returned [402 Payment Required]: Prepayment credits for this Google Cloud project are depleted. To resolve this, create a free API key on a new project at https://aistudio.google.com/apikey or manage billing credits.';
  } else if (lastError?.message.includes('403')) {
    errorType = 'invalid_key';
    friendlyMessage = 'Google Gemini API key is invalid or unauthorized.';
  }

  console.error(`[Gemini AI Error - ${errorType}]:`, lastError?.message);
  return {
    error: friendlyMessage,
    errorType,
    rawError: lastError?.message,
  };
}

// Validate API Key and Model with a quick ping
async function validateGeminiKey(key, modelName = 'gemini-2.5-flash') {
  if (!key || !key.trim()) {
    return { valid: false, errorType: 'missing_key', message: 'No API key provided.' };
  }
  try {
    const genAI = new GoogleGenerativeAI(key.trim());
    const model = genAI.getGenerativeModel({ model: modelName });
    await model.generateContent('ping');
    return { valid: true, model: modelName };
  } catch (err) {
    let errorType = 'general_error';
    let message = err.message;
    if (err.message.includes('402')) {
      errorType = 'prepayment_depleted';
      message = 'Prepayment credits are depleted on this project. Create a new key in a free-tier project at https://aistudio.google.com/apikey';
    } else if (err.message.includes('403')) {
      errorType = 'invalid_key';
      message = 'API key is invalid or lacks permission.';
    }
    return { valid: false, errorType, message };
  }
}

module.exports = {
  isGeminiConfigured,
  setGeminiKey,
  buildPlantContext,
  askGemini,
  validateGeminiKey,
};
