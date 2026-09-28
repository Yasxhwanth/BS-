const mongoose = require('mongoose');
const { User, Alert, PlantData } = require('../models');

let mongodInstance = null;

async function seedDemoData() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Seeding initial demo data...');
      await User.create({
        name: 'Demo Admin',
        email: 'admin@company.com',
        password: 'password123',
        role: 'admin',
        department: 'Management',
      });
      console.log('Created Demo User: admin@company.com / password123');

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
          recommendation: 'Verify shielding gas flow rate and recalibrate torch tip by -5 deg C.',
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
      console.log('Created initial starter alerts');

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
            oee: '+ 3.2% vs last week',
            productionEfficiency: '+ 1.8%',
            qualityRate: '+ 0.4%',
            mtbf: '+ 18hrs',
            mttr: '- 0.4hrs',
            activeAlerts: '1 critical',
            ontologyNodes: '34 relationships',
            energyConsumption: '- 5.2% vs avg',
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
          { id: 'T-01', label: 'Spindle Bearing Temp', type: 'temperature', value: 78.4, unit: 'C', status: 'normal' },
          { id: 'V-01', label: 'Motor Vibration Sensor', type: 'vibration', value: 7.82, unit: 'mm/s', status: 'critical' },
          { id: 'P-01', label: 'Hydraulic Pressure Line', type: 'pressure', value: 142.5, unit: 'kPa', status: 'normal' },
          { id: 'S-01', label: 'Tachometer Spindle', type: 'speed', value: 1450, unit: 'RPM', status: 'normal' },
          { id: 'H-01', label: 'Paint Room Humidity', type: 'humidity', value: 48.2, unit: '%', status: 'normal' },
          { id: 'E-01', label: 'Substation Power Feed', type: 'power', value: 385, unit: 'kW', status: 'normal' },
        ],
        fileName: 'sample_manufacturing_data.xlsx',
      });
      console.log('Created initial PlantData metrics');
    }
  } catch (err) {
    console.error('Seeding error:', err.message);
  }
}

async function connectDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/manufacturing_aip';

  // If user configured a cloud MongoDB URI (e.g. MongoDB Atlas)
  if (process.env.MONGO_URI && !process.env.MONGO_URI.includes('localhost') && !process.env.MONGO_URI.includes('127.0.0.1')) {
    try {
      await mongoose.connect(uri);
      console.log('MongoDB Connected (Cloud/Atlas)');
      await seedDemoData();
      return;
    } catch (err) {
      console.error('Remote MongoDB connection failed:', err.message);
    }
  }

  // Attempt local MongoDB with a short timeout
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log('MongoDB Connected (Local mongod)');
    await seedDemoData();
  } catch (err) {
    console.log('Local MongoDB not detected. Starting in-memory MongoDB server...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongodInstance = await MongoMemoryServer.create();
    const memoryUri = mongodInstance.getUri();
    await mongoose.connect(memoryUri);
    console.log(`In-memory MongoDB Connected at ${memoryUri}`);
    await seedDemoData();
  }
}

async function disconnectDatabase() {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  seedDemoData,
};
