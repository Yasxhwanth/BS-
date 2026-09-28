require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const { isGeminiConfigured, setGeminiKey, askGemini } = require('./geminiService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ── Suppress favicon CSP errors ──
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ─────────────────────────────────────────
// DATABASE CONNECTION (Initialized before server starts)
// ─────────────────────────────────────────
let mongodInstance = null;

// ─────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────

// User Model
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ['admin', 'engineer', 'operator', 'analyst'], default: 'operator' },
  department: { type: String, enum: ['Production', 'Maintenance', 'QA', 'Management'], default: 'Production' },
}, { timestamps: true });
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});
UserSchema.methods.matchPassword = async function (pwd) {
  return bcrypt.compare(pwd, this.password);
};
const User = mongoose.model('User', UserSchema);

// Ontology Model
const OntologySchema = new mongoose.Schema({
  name: { type: String, default: 'Manufacturing Ontology' },
  description: { type: String, default: '' },
  nodes: [{ type: mongoose.Schema.Types.Mixed }],
  edges: [{ type: mongoose.Schema.Types.Mixed }],
  generatedOntology: { type: mongoose.Schema.Types.Mixed, default: {} },
  version: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
const Ontology = mongoose.model('Ontology', OntologySchema);

// Alert Model
const AlertSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'], default: 'info' },
  category: { type: String, enum: ['predictive_maintenance', 'quality', 'safety', 'production', 'sensor', 'supply_chain'], default: 'production' },
  source: { nodeId: String, nodeLabel: String, nodeType: String },
  status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
  aiConfidence: { type: Number, default: 85 },
  recommendation: { type: String, default: '' },
}, { timestamps: true });
const Alert = mongoose.model('Alert', AlertSchema);

// SensorData Model
const SensorDataSchema = new mongoose.Schema({
  sensorId: { type: String, required: true },
  sensorLabel: String,
  sensorType: { type: String, enum: ['temperature', 'vibration', 'pressure', 'speed', 'humidity', 'power', 'flow'], default: 'temperature' },
  linkedNodeId: String,
  linkedNodeLabel: String,
  unit: String,
  readings: [{ timestamp: { type: Date, default: Date.now }, value: Number, isAnomaly: Boolean, anomalyScore: Number }],
  stats: { min: Number, max: Number, avg: Number, anomalyCount: { type: Number, default: 0 } },
  threshold: { warning: Number, critical: Number },
  status: { type: String, enum: ['normal', 'warning', 'critical', 'offline'], default: 'normal' },
}, { timestamps: true });
const SensorData = mongoose.model('SensorData', SensorDataSchema);

// ChatMessage Model
const ChatMessageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);

// PlantData Model (Persisted Dashboard metrics from Excel or Seed)
const PlantDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  kpis: {
    oee: { type: Number, default: 86.4 },
    productionEfficiency: { type: Number, default: 89.2 },
    qualityRate: { type: Number, default: 98.7 },
    mtbf: { type: Number, default: 164 },
    mttr: { type: Number, default: 1.8 },
    activeAlerts: { type: Number, default: 3 },
    criticalAlerts: { type: Number, default: 1 },
    ontologyNodes: { type: Number, default: 28 },
    ontologyEdges: { type: Number, default: 34 },
    energyConsumption: { type: Number, default: 385 },
    trends: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  productionTrend: [{ type: mongoose.Schema.Types.Mixed }],
  processBreakdown: [{ type: mongoose.Schema.Types.Mixed }],
  sensors: [{ type: mongoose.Schema.Types.Mixed }],
  fileName: { type: String, default: 'sample_manufacturing_data.xlsx' },
  lastImportedAt: { type: Date, default: Date.now },
}, { timestamps: true });
const PlantData = mongoose.model('PlantData', PlantDataSchema);

// ─────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// AI ENGINE (Simulated)
// ─────────────────────────────────────────
const AIEngine = {
  // Generate AI response based on ontology context and Gemini
  chat: async (message, context = {}) => {
    const ontology = context?.nodes ? context : (context.ontology || null);
    const alerts = context.alerts || [];
    const plantData = context.plantData || null;
    const history = context.history || [];
    const user = context.user || null;

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
      } catch (err) {
        console.error('[Gemini AI] Call failed, using fallback:', err.message);
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
      fallbackReply = `Based on your ontology, I've detected that processes (${processNodes || 'N/A'}) may require scheduled maintenance. Recommend checking vibration sensors for anomalies. Predicted next failure: 72 hours.`;
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
      fallbackReply = `Quality analysis from your ontology shows 94.2% pass rate this week. 3 defects traced back to Welding Process → Material Feed. AI recommends adjusting weld temperature by -5°C.`;
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
      fallbackReply = `I'm your Manufacturing AI Assistant. Your current ontology has ${nodes.length} entities. I can help with predictive maintenance, quality analysis, sensor monitoring, workforce optimization, and production efficiency. What would you like to explore?`;
    }

    const hint = !isGeminiConfigured()
      ? '\n\n*(💡 Tip: Add your `GEMINI_API_KEY` to .env or in the AI Key config above to activate live Google Gemini)*'
      : '';

    return {
      content: fallbackReply + hint,
      intent,
      confidence,
      model: 'simulated-engine',
      source: 'simulation',
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

// ─────────────────────────────────────────
// ONTOLOGY GENERATOR
// ─────────────────────────────────────────
const generateOntology = (nodes, edges) => {
  // Map node types to OWL classes
  const classMap = {
    process: 'ManufacturingProcess',
    sensor: 'Sensor',
    material: 'Material',
    worker: 'Worker',
    product: 'Product',
    department: 'Department',
  };

  const classes = [...new Set(nodes.map(n => classMap[n.type] || 'Entity'))].map(cls => ({
    '@id': `mfg:${cls}`,
    '@type': 'owl:Class',
    'rdfs:label': cls,
    'rdfs:comment': `Represents a ${cls} in the manufacturing plant`,
  }));

  const individuals = nodes.map(n => ({
    '@id': `mfg:${n.id}`,
    '@type': `mfg:${classMap[n.type] || 'Entity'}`,
    'rdfs:label': n.data?.label,
    'mfg:nodeType': n.type,
    'mfg:subtype': n.data?.subtype || '',
    'mfg:description': n.data?.description || '',
    'mfg:properties': n.data?.properties || {},
  }));

  const relationshipMap = {
    monitors: { domain: 'Sensor', range: 'ManufacturingProcess', inverse: 'monitoredBy' },
    feeds_into: { domain: 'Material', range: 'ManufacturingProcess', inverse: 'consumesMaterial' },
    produces: { domain: 'ManufacturingProcess', range: 'Product', inverse: 'producedBy' },
    operated_by: { domain: 'ManufacturingProcess', range: 'Worker', inverse: 'operates' },
    belongs_to: { domain: 'ManufacturingProcess', range: 'Department', inverse: 'hasMember' },
    requires: { domain: 'ManufacturingProcess', range: 'Material', inverse: 'requiredBy' },
    part_of: { domain: 'Product', range: 'Product', inverse: 'hasPart' },
    managed_by: { domain: 'Department', range: 'Worker', inverse: 'manages' },
    inspects: { domain: 'Worker', range: 'Product', inverse: 'inspectedBy' },
    custom: { domain: 'Entity', range: 'Entity', inverse: 'relatedTo' },
  };

  const objectProperties = [...new Set(edges.map(e => e.relationship || 'custom'))].map(rel => ({
    '@id': `mfg:${rel}`,
    '@type': 'owl:ObjectProperty',
    'rdfs:label': rel.replace(/_/g, ' '),
    'rdfs:domain': `mfg:${relationshipMap[rel]?.domain || 'Entity'}`,
    'rdfs:range': `mfg:${relationshipMap[rel]?.range || 'Entity'}`,
    'owl:inverseOf': `mfg:${relationshipMap[rel]?.inverse || 'relatedTo'}`,
  }));

  const axioms = edges.map(e => {
    const src = nodes.find(n => n.id === e.source);
    const tgt = nodes.find(n => n.id === e.target);
    return {
      '@type': 'owl:ObjectPropertyAssertion',
      'owl:assertionProperty': `mfg:${e.relationship || 'custom'}`,
      'owl:sourceIndividual': `mfg:${e.source}`,
      'owl:targetIndividual': `mfg:${e.target}`,
      'mfg:label': e.label || '',
      'mfg:sourceLabel': src?.data?.label || e.source,
      'mfg:targetLabel': tgt?.data?.label || e.target,
    };
  });

  return {
    '@context': {
      mfg: 'http://manufacturing-aip.io/ontology#',
      owl: 'http://www.w3.org/2002/07/owl#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    },
    '@graph': [
      { '@id': 'mfg:ManufacturingOntology', '@type': 'owl:Ontology', 'rdfs:label': 'Manufacturing AI Platform Ontology' },
      ...classes,
      ...objectProperties,
      ...individuals,
      ...axioms,
    ],
    meta: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      classCount: classes.length,
      individualCount: individuals.length,
      axiomCount: axioms.length,
      generatedAt: new Date().toISOString(),
    },
  };
};

// ─────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });
    const user = await User.create({ name, email, password, role, department });
    res.status(201).json({ success: true, token: generateToken(user._id), user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    res.json({ success: true, token: generateToken(user._id), user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/auth/me', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ─────────────────────────────────────────
// ONTOLOGY ROUTES
// ─────────────────────────────────────────
app.get('/api/ontology', protect, async (req, res) => {
  try {
    const ontology = await Ontology.findOne({ createdBy: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, data: ontology });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/ontology/save', protect, async (req, res) => {
  try {
    const { name, description, nodes, edges } = req.body;
    const generatedOntology = generateOntology(nodes || [], edges || []);
    let ontology = await Ontology.findOne({ createdBy: req.user._id });
    if (ontology) {
      ontology.name = name || ontology.name;
      ontology.description = description || ontology.description;
      ontology.nodes = nodes || [];
      ontology.edges = edges || [];
      ontology.generatedOntology = generatedOntology;
      ontology.version += 1;
      await ontology.save();
    } else {
      ontology = await Ontology.create({ name, description, nodes: nodes || [], edges: edges || [], generatedOntology, createdBy: req.user._id });
    }
    // Emit real-time update
    io.emit('ontology:updated', { ontologyId: ontology._id, meta: generatedOntology.meta });
    // Auto-generate alerts from ontology
    await autoGenerateAlerts(nodes || [], edges || []);
    res.json({ success: true, data: ontology, generatedOntology });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/ontology/export', protect, async (req, res) => {
  try {
    const ontology = await Ontology.findOne({ createdBy: req.user._id });
    if (!ontology) return res.status(404).json({ success: false, message: 'No ontology found' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=manufacturing-ontology.json');
    res.json(ontology.generatedOntology);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
// ALERTS ROUTES
// ─────────────────────────────────────────
app.get('/api/alerts', protect, async (req, res) => {
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

app.patch('/api/alerts/:id/acknowledge', protect, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { status: 'acknowledged', acknowledgedBy: req.user._id }, { new: true });
    io.emit('alert:updated', alert);
    res.json({ success: true, data: alert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/alerts/:id/resolve', protect, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { status: 'resolved', resolvedAt: new Date() }, { new: true });
    io.emit('alert:updated', alert);
    res.json({ success: true, data: alert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
// ANALYTICS & DASHBOARD ROUTES
// ─────────────────────────────────────────
app.get('/api/analytics/dashboard', protect, async (req, res) => {
  try {
    const ontology = await Ontology.findOne({ createdBy: req.user._id });
    const alerts = await Alert.find({ status: 'active' });
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const nodes = ontology?.nodes || [];

    // Find custom uploaded or seeded plant data
    let plantData = await PlantData.findOne({ userId: req.user._id });
    if (!plantData) {
      plantData = await PlantData.findOne({}).sort({ updatedAt: -1 });
    }

    const defaultTrends = {
      oee: '↑ 3.2% vs last week',
      productionEfficiency: '↑ 1.8%',
      qualityRate: '↑ 0.4%',
      mtbf: '↑ 18hrs',
      mttr: '↓ 0.4hrs',
      activeAlerts: `${criticalAlerts} critical`,
      ontologyNodes: `${ontology?.edges?.length || 34} edges`,
      energyConsumption: '↓ 5.2% vs avg',
    };

    const kpis = {
      oee: plantData?.kpis?.oee ?? 86.4,
      productionEfficiency: plantData?.kpis?.productionEfficiency ?? 89.2,
      qualityRate: plantData?.kpis?.qualityRate ?? 98.7,
      mtbf: plantData?.kpis?.mtbf ?? 164,
      mttr: plantData?.kpis?.mttr ?? 1.8,
      energyConsumption: plantData?.kpis?.energyConsumption ?? 385,
      activeAlerts: alerts.length,
      criticalAlerts: criticalAlerts,
      ontologyNodes: nodes.length > 0 ? nodes.length : (plantData?.kpis?.ontologyNodes ?? 28),
      ontologyEdges: ontology?.edges?.length ?? (plantData?.kpis?.ontologyEdges ?? 34),
      trends: { ...defaultTrends, ...(plantData?.kpis?.trends || {}) },
    };

    const productionTrend = plantData?.productionTrend?.length > 0
      ? plantData.productionTrend
      : [
          { day: 'Mon', output: 940, target: 900, defects: 12 },
          { day: 'Tue', output: 1020, target: 950, defects: 15 },
          { day: 'Wed', output: 890, target: 950, defects: 28 },
          { day: 'Thu', output: 1150, target: 1000, defects: 9 },
          { day: 'Fri', output: 1080, target: 1000, defects: 14 },
          { day: 'Sat', output: 750, target: 700, defects: 8 },
          { day: 'Sun', output: 620, target: 600, defects: 5 },
        ];

    const processBreakdown = plantData?.processBreakdown?.length > 0
      ? plantData.processBreakdown
      : [
          { name: 'CNC Milling Cell 1', efficiency: 92, alerts: 0, cycleTimeSec: 45, status: 'Optimal' },
          { name: 'Robotic Weld Station 3', efficiency: 74, alerts: 2, cycleTimeSec: 68, status: 'Warning' },
          { name: 'Surface Paint Booth', efficiency: 88, alerts: 1, cycleTimeSec: 120, status: 'Normal' },
          { name: 'Automated Pick & Place', efficiency: 96, alerts: 0, cycleTimeSec: 18, status: 'Optimal' },
          { name: 'Final Quality Inspection', efficiency: 91, alerts: 0, cycleTimeSec: 35, status: 'Optimal' },
          { name: 'Packaging & Palletizing', efficiency: 85, alerts: 1, cycleTimeSec: 28, status: 'Normal' },
        ];

    const sensorSummary = plantData?.sensors?.length > 0
      ? plantData.sensors
      : [
          { id: 'T-01', label: 'Spindle Bearing Temp', type: 'temperature', value: 78.4, unit: '°C', status: 'normal' },
          { id: 'V-01', label: 'Motor Vibration Sensor', type: 'vibration', value: 7.82, unit: 'mm/s', status: 'critical' },
          { id: 'P-01', label: 'Hydraulic Pressure Line', type: 'pressure', value: 142.5, unit: 'kPa', status: 'normal' },
          { id: 'S-01', label: 'Tachometer Spindle', type: 'speed', value: 1450, unit: 'RPM', status: 'normal' },
          { id: 'H-01', label: 'Paint Room Humidity', type: 'humidity', value: 48.2, unit: '%', status: 'normal' },
          { id: 'E-01', label: 'Substation Power Feed', type: 'power', value: 385, unit: 'kW', status: 'normal' },
        ];

    res.json({
      success: true,
      data: {
        kpis,
        productionTrend,
        processBreakdown,
        sensorSummary,
        datasetInfo: {
          fileName: plantData?.fileName || 'sample_manufacturing_data.xlsx',
          importedAt: plantData?.lastImportedAt || plantData?.createdAt,
          isCustom: !!plantData?.userId,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
// EXCEL IMPORT & DATASET ROUTES
// ─────────────────────────────────────────
app.post('/api/upload/excel', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No Excel file provided.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    if (!sheetNames || sheetNames.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel workbook is empty.' });
    }

    const getSheetData = (pattern) => {
      const name = sheetNames.find(n => pattern.test(n));
      if (!name) return null;
      return XLSX.utils.sheet_to_json(workbook.Sheets[name]);
    };

    // 1. Parse KPIs
    const kpiRows = getSheetData(/kpi/i) || XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[0]]);
    const parsedKpis = {};
    const parsedTrends = {};

    if (Array.isArray(kpiRows)) {
      kpiRows.forEach(row => {
        const key = row.MetricKey || row.metricKey || row.key || row.Key || row.Metric || row.metric;
        const val = parseFloat(row.Value ?? row.value ?? row.Val);
        const trend = row.Trend || row.trend;
        if (key && !isNaN(val)) {
          const str = key.toString().trim().toLowerCase();
          const mappedKey =
            str.includes('oee') ? 'oee' :
            (str.includes('production') || str.includes('efficiency')) ? 'productionEfficiency' :
            (str.includes('quality') || str.includes('yield')) ? 'qualityRate' :
            str.includes('mtbf') ? 'mtbf' :
            str.includes('mttr') ? 'mttr' :
            (str.includes('energy') || str.includes('power')) ? 'energyConsumption' :
            str.includes('node') ? 'ontologyNodes' :
            str.includes('alert') ? 'activeAlerts' : key;
          parsedKpis[mappedKey] = val;
          if (trend) parsedTrends[mappedKey] = trend;
        }
      });
    }

    // 2. Parse Production Trend
    const trendRows = getSheetData(/trend|production|output/i);
    let parsedTrend = [];
    if (Array.isArray(trendRows) && trendRows.length > 0) {
      parsedTrend = trendRows.map(r => ({
        day: r.Day || r.day || r.Date || r.date || 'Day',
        output: Number(r.Output ?? r.output ?? 0),
        target: Number(r.Target ?? r.target ?? 0),
        defects: Number(r.Defects ?? r.defects ?? 0),
      }));
    }

    // 3. Parse Process Breakdown
    const processRows = getSheetData(/process/i);
    let parsedProcesses = [];
    if (Array.isArray(processRows) && processRows.length > 0) {
      parsedProcesses = processRows.map(r => ({
        name: r.ProcessName || r.processName || r.name || r.Process || 'Process',
        efficiency: Number(r.Efficiency ?? r.efficiency ?? 80),
        alerts: Number(r.Alerts ?? r.alerts ?? 0),
        cycleTimeSec: Number(r.CycleTimeSec ?? r.cycleTime ?? 30),
        status: r.Status || r.status || 'Optimal',
      }));
    }

    // 4. Parse Live Sensors
    const sensorRows = getSheetData(/sensor/i);
    let parsedSensors = [];
    if (Array.isArray(sensorRows) && sensorRows.length > 0) {
      parsedSensors = sensorRows.map(r => ({
        id: r.SensorId || r.sensorId || r.id || 'S-01',
        label: r.SensorName || r.sensorName || r.label || r.Name || 'Sensor',
        type: (r.Type || r.type || 'temperature').toString().toLowerCase(),
        value: Number(r.Value ?? r.value ?? 0),
        unit: r.Unit || r.unit || '',
        status: (r.Status || r.status || 'normal').toString().toLowerCase(),
      }));
    }

    // 5. Parse Alerts
    const alertRows = getSheetData(/alert/i);
    if (Array.isArray(alertRows) && alertRows.length > 0) {
      for (const r of alertRows) {
        if (r.Title || r.title) {
          await Alert.create({
            title: r.Title || r.title,
            message: r.Message || r.message || 'Imported alert notification',
            severity: (r.Severity || r.severity || 'medium').toString().toLowerCase(),
            category: (r.Category || r.category || 'production').toString().toLowerCase().replace(/\s+/g, '_'),
            source: {
              nodeId: `import-${Date.now()}`,
              nodeLabel: r.SourceNode || r.sourceNode || r.Source || 'Excel Source',
              nodeType: 'process',
            },
            aiConfidence: Number(r.AIConfidence ?? r.aiConfidence ?? 85),
            recommendation: r.Recommendation || r.recommendation || '',
          });
        }
      }
    }

    // Save or update PlantData
    let plantData = await PlantData.findOne({ userId: req.user._id });
    if (!plantData) {
      plantData = new PlantData({ userId: req.user._id });
    }
    plantData.kpis = { ...plantData.kpis, ...parsedKpis, trends: { ...(plantData.kpis?.trends || {}), ...parsedTrends } };
    if (parsedTrend.length > 0) plantData.productionTrend = parsedTrend;
    if (parsedProcesses.length > 0) plantData.processBreakdown = parsedProcesses;
    if (parsedSensors.length > 0) plantData.sensors = parsedSensors;
    plantData.fileName = req.file.originalname;
    plantData.lastImportedAt = new Date();
    await plantData.save();

    io.emit('dashboard:updated', { fileName: plantData.fileName, at: plantData.lastImportedAt });

    res.json({
      success: true,
      message: `Successfully imported "${req.file.originalname}"!`,
      data: plantData,
    });
  } catch (err) {
    console.error('Excel upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to parse Excel file: ' + err.message });
  }
});

// Download sample Excel file
app.get('/api/data/sample-excel', (req, res) => {
  const filePath = path.join(__dirname, 'sample_manufacturing_data.xlsx');
  res.download(filePath, 'sample_manufacturing_data.xlsx');
});

// Reset to default demo data
app.post('/api/data/reset-demo', protect, async (req, res) => {
  try {
    await PlantData.deleteMany({ userId: req.user._id });
    res.json({ success: true, message: 'Reset to demo dataset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/analytics/predict/:nodeId', protect, async (req, res) => {
  try {
    const ontology = await Ontology.findOne({ createdBy: req.user._id });
    const node = ontology?.nodes?.find(n => n.id === req.params.nodeId);
    if (!node) return res.status(404).json({ success: false, message: 'Node not found' });
    const prediction = AIEngine.predictMaintenance(node.type, []);
    res.json({ success: true, data: { node: node.data?.label, ...prediction } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
// CHAT ROUTES
// ─────────────────────────────────────────
app.get('/api/chat/status', protect, async (req, res) => {
  res.json({
    success: true,
    data: {
      provider: 'gemini',
      configured: isGeminiConfigured(),
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    },
  });
});

app.post('/api/chat/config', protect, async (req, res) => {
  try {
    const { apiKey, model } = req.body;
    if (apiKey) {
      setGeminiKey(apiKey, model);
    }
    res.json({
      success: true,
      message: 'Gemini configuration updated',
      data: {
        configured: isGeminiConfigured(),
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/chat', protect, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const convId = conversationId || `conv_${req.user._id}_${Date.now()}`;

    // 1. Fetch previous conversation history
    const history = await ChatMessage.find({ conversationId: convId })
      .sort({ createdAt: 1 })
      .limit(20);

    // 2. Save user message
    await ChatMessage.create({ conversationId: convId, role: 'user', content: message, userId: req.user._id });

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

app.get('/api/chat/history/:conversationId', protect, async (req, res) => {
  try {
    const messages = await ChatMessage.find({ conversationId: req.params.conversationId }).sort({ createdAt: 1 });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
// HELPER: Auto-generate alerts from ontology
// ─────────────────────────────────────────
const autoGenerateAlerts = async (nodes, edges) => {
  const alertTemplates = {
    sensor: { severity: 'high', category: 'sensor', recommendation: 'Check sensor calibration and connectivity' },
    process: { severity: 'medium', category: 'predictive_maintenance', recommendation: 'Schedule preventive maintenance within 48 hours' },
    material: { severity: 'low', category: 'supply_chain', recommendation: 'Monitor material stock levels and reorder if needed' },
    worker: { severity: 'info', category: 'production', recommendation: 'Review shift assignments and workload distribution' },
    product: { severity: 'medium', category: 'quality', recommendation: 'Increase quality sampling frequency for this product' },
    department: { severity: 'low', category: 'production', recommendation: 'Review department KPIs and resource allocation' },
  };

  // Randomly generate 1-2 alerts when ontology is saved (simulate AI detection)
  if (nodes.length > 0 && Math.random() > 0.5) {
    const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
    const template = alertTemplates[randomNode.type] || alertTemplates.process;
    const messages = {
      sensor: `Anomaly detected in ${randomNode.data?.label} — reading outside normal threshold`,
      process: `${randomNode.data?.label} showing signs of performance degradation`,
      material: `${randomNode.data?.label} inventory running low based on production demand`,
      worker: `${randomNode.data?.label} workload exceeding optimal capacity`,
      product: `${randomNode.data?.label} quality deviation detected`,
      department: `${randomNode.data?.label} efficiency metrics below target`,
    };
    await Alert.create({
      title: `AI Alert: ${randomNode.data?.label}`,
      message: messages[randomNode.type] || `Issue detected in ${randomNode.data?.label}`,
      ...template,
      source: { nodeId: randomNode.id, nodeLabel: randomNode.data?.label, nodeType: randomNode.type },
      aiConfidence: Math.round(75 + Math.random() * 20),
    });
  }
};

// ─────────────────────────────────────────
// SOCKET.IO — Real-time events
// ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Simulate live sensor data every 3 seconds
  const sensorInterval = setInterval(() => {
    socket.emit('sensor:live', {
      timestamp: new Date().toISOString(),
      sensors: [
        { id: 'T-01', label: 'Temperature Sensor', type: 'temperature', value: +(60 + Math.random() * 40).toFixed(1), unit: '°C', status: Math.random() > 0.85 ? 'warning' : 'normal' },
        { id: 'V-01', label: 'Vibration Sensor', type: 'vibration', value: +(2 + Math.random() * 8).toFixed(2), unit: 'mm/s', status: Math.random() > 0.9 ? 'critical' : 'normal' },
        { id: 'P-01', label: 'Pressure Sensor', type: 'pressure', value: +(100 + Math.random() * 50).toFixed(1), unit: 'kPa', status: Math.random() > 0.88 ? 'warning' : 'normal' },
        { id: 'S-01', label: 'Speed Sensor', type: 'speed', value: +(1200 + Math.random() * 300).toFixed(0), unit: 'RPM', status: 'normal' },
      ],
    });
  }, 3000);

  socket.on('disconnect', () => {
    clearInterval(sensorInterval);
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ─────────────────────────────────────────
// DATABASE SEEDING & CONNECTION
// ─────────────────────────────────────────
async function seedDemoData() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Seeding initial demo data...');
      await User.create({
        name: 'Demo Admin',
        email: 'admin@company.com',
        password: 'password123',
        role: 'admin',
        department: 'Management',
      });
      console.log('✅ Created Demo User: admin@company.com / password123');

      // Seed starter alerts
      await Alert.create([
        {
          title: 'AI Alert: Thermal Spike in CNC Machining',
          message: 'Vibration and thermal sensors detected high variance in spindle bearings (+18% above baseline).',
          severity: 'critical',
          category: 'predictive_maintenance',
          source: { nodeId: 'proc-1', nodeLabel: 'CNC Milling Cell 1', nodeType: 'process' },
          aiConfidence: 94,
          recommendation: 'Inspect spindle lubricant and check bearing vibration levels.',
        },
        {
          title: 'Quality Alert: Robotic Welding Micro-Defects',
          message: 'Minor surface weld porosity observed on batch #4829 chassis sub-assemblies.',
          severity: 'high',
          category: 'quality',
          source: { nodeId: 'proc-2', nodeLabel: 'Robotic Weld Station', nodeType: 'process' },
          aiConfidence: 89,
          recommendation: 'Verify shielding gas flow rate and recalibrate torch tip by -5°C.',
        },
        {
          title: 'Supply Chain Notice: Low Material Buffer',
          message: 'Alloy sheet inventory level dropped below safety margin (14% remaining).',
          severity: 'medium',
          category: 'supply_chain',
          source: { nodeId: 'mat-1', nodeLabel: 'Aluminium 6061 Stock', nodeType: 'material' },
          aiConfidence: 91,
          recommendation: 'Submit purchase requisition for immediate replenishment.',
        },
      ]);
      console.log('✅ Created initial starter alerts');

      // Seed initial PlantData
      await PlantData.create({
        kpis: {
          oee: 86.4,
          productionEfficiency: 89.2,
          qualityRate: 98.7,
          mtbf: 164,
          mttr: 1.8,
          activeAlerts: 3,
          criticalAlerts: 1,
          ontologyNodes: 28,
          ontologyEdges: 34,
          energyConsumption: 385,
          trends: {
            oee: '↑ 3.2% vs last week',
            productionEfficiency: '↑ 1.8%',
            qualityRate: '↑ 0.4%',
            mtbf: '↑ 18hrs',
            mttr: '↓ 0.4hrs',
            activeAlerts: '1 critical',
            ontologyNodes: '34 relationships',
            energyConsumption: '↓ 5.2% vs avg',
          },
        },
        productionTrend: [
          { day: 'Mon', output: 940, target: 900, defects: 12 },
          { day: 'Tue', output: 1020, target: 950, defects: 15 },
          { day: 'Wed', output: 890, target: 950, defects: 28 },
          { day: 'Thu', output: 1150, target: 1000, defects: 9 },
          { day: 'Fri', output: 1080, target: 1000, defects: 14 },
          { day: 'Sat', output: 750, target: 700, defects: 8 },
          { day: 'Sun', output: 620, target: 600, defects: 5 },
        ],
        processBreakdown: [
          { name: 'CNC Milling Cell 1', efficiency: 92, alerts: 0, cycleTimeSec: 45, status: 'Optimal' },
          { name: 'Robotic Weld Station 3', efficiency: 74, alerts: 2, cycleTimeSec: 68, status: 'Warning' },
          { name: 'Surface Paint Booth', efficiency: 88, alerts: 1, cycleTimeSec: 120, status: 'Normal' },
          { name: 'Automated Pick & Place', efficiency: 96, alerts: 0, cycleTimeSec: 18, status: 'Optimal' },
          { name: 'Final Quality Inspection', efficiency: 91, alerts: 0, cycleTimeSec: 35, status: 'Optimal' },
          { name: 'Packaging & Palletizing', efficiency: 85, alerts: 1, cycleTimeSec: 28, status: 'Normal' },
        ],
        sensors: [
          { id: 'T-01', label: 'Spindle Bearing Temp', type: 'temperature', value: 78.4, unit: '°C', status: 'normal' },
          { id: 'V-01', label: 'Motor Vibration Sensor', type: 'vibration', value: 7.82, unit: 'mm/s', status: 'critical' },
          { id: 'P-01', label: 'Hydraulic Pressure Line', type: 'pressure', value: 142.5, unit: 'kPa', status: 'normal' },
          { id: 'S-01', label: 'Tachometer Spindle', type: 'speed', value: 1450, unit: 'RPM', status: 'normal' },
          { id: 'H-01', label: 'Paint Room Humidity', type: 'humidity', value: 48.2, unit: '%', status: 'normal' },
          { id: 'E-01', label: 'Substation Power Feed', type: 'power', value: 385, unit: 'kW', status: 'normal' },
        ],
        fileName: 'sample_manufacturing_data.xlsx',
      });
      console.log('✅ Created initial PlantData metrics');
    }
  } catch (err) {
    console.error('⚠️ Seeding error:', err.message);
  }
}

async function connectDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/manufacturing_aip';

  // If user configured a cloud MongoDB URI (e.g. MongoDB Atlas)
  if (process.env.MONGO_URI && !process.env.MONGO_URI.includes('localhost') && !process.env.MONGO_URI.includes('127.0.0.1')) {
    try {
      await mongoose.connect(uri);
      console.log('✅ MongoDB Connected (Cloud/Atlas)');
      await seedDemoData();
      return;
    } catch (err) {
      console.error('❌ Remote MongoDB connection failed:', err.message);
    }
  }

  // Attempt local MongoDB with a short timeout
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log('✅ MongoDB Connected (Local mongod)');
    await seedDemoData();
  } catch (err) {
    console.log('ℹ️ Local MongoDB not detected. Starting in-memory MongoDB server...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongodInstance = await MongoMemoryServer.create();
    const memoryUri = mongodInstance.getUri();
    await mongoose.connect(memoryUri);
    console.log(`✅ In-memory MongoDB Connected at ${memoryUri}`);
    await seedDemoData();
  }
}

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});

// Clean up memory server on exit
process.on('SIGINT', async () => {
  await mongoose.disconnect();
  if (mongodInstance) await mongodInstance.stop();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await mongoose.disconnect();
  if (mongodInstance) await mongodInstance.stop();
  process.exit(0);
});
