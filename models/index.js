const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

// PlantData Model
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

module.exports = {
  User,
  Ontology,
  Alert,
  SensorData,
  ChatMessage,
  PlantData,
};
