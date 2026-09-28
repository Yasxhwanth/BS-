const express = require('express');
const router = express.Router();
const { Ontology, Alert, PlantData } = require('../models');
const { protect } = require('../middleware/auth');
const AIEngine = require('../services/aiEngine');

router.get('/dashboard', protect, async (req, res) => {
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
      oee: '+ 3.2% vs last week',
      productionEfficiency: '+ 1.8%',
      qualityRate: '+ 0.4%',
      mtbf: '+ 18hrs',
      mttr: '- 0.4hrs',
      activeAlerts: `${criticalAlerts} critical`,
      ontologyNodes: `${ontology?.edges?.length || 34} edges`,
      energyConsumption: '- 5.2% vs avg',
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
          { id: 'T-01', label: 'Spindle Bearing Temp', type: 'temperature', value: 78.4, unit: 'C', status: 'normal' },
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
          isCustom: !(!plantData?.userId),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/predict/:nodeId', protect, async (req, res) => {
  try {
    const ontology = await Ontology.findOne({ createdBy: req.user._id });
    const node = ontology?.nodes?.find(n => n.id === req.params.nodeId);
    if (!node) {
      return res.status(404).json({ success: false, message: 'Node not found' });
    }
    const prediction = AIEngine.predictMaintenance(node.type, []);
    res.json({ success: true, data: { node: node.data?.label, ...prediction } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
