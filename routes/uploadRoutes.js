const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const { Alert, PlantData } = require('../models');
const { protect } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Upload and parse Excel data
router.post('/upload/excel', protect, upload.single('file'), async (req, res) => {
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
      const name = sheetNames.find((n) => pattern.test(n));
      if (!name) return null;
      return XLSX.utils.sheet_to_json(workbook.Sheets[name]);
    };

    // 1. Parse KPIs
    const kpiRows = getSheetData(/kpi/i) || XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[0]]);
    const parsedKpis = {};
    const parsedTrends = {};

    if (Array.isArray(kpiRows)) {
      kpiRows.forEach((row) => {
        const key = row.MetricKey || row.metricKey || row.key || row.Key || row.Metric || row.metric;
        const val = parseFloat(row.Value ?? row.value ?? row.Val);
        const trend = row.Trend || row.trend;
        if (key && !isNaN(val)) {
          const str = key.toString().trim().toLowerCase();
          const mappedKey =
            str.includes('oee')
              ? 'oee'
              : str.includes('production') || str.includes('efficiency')
              ? 'productionEfficiency'
              : str.includes('quality') || str.includes('yield')
              ? 'qualityRate'
              : str.includes('mtbf')
              ? 'mtbf'
              : str.includes('mttr')
              ? 'mttr'
              : str.includes('energy') || str.includes('power')
              ? 'energyConsumption'
              : str.includes('node')
              ? 'ontologyNodes'
              : str.includes('alert')
              ? 'activeAlerts'
              : key;
          parsedKpis[mappedKey] = val;
          if (trend) parsedTrends[mappedKey] = trend;
        }
      });
    }

    // 2. Parse Production Trend
    const trendRows = getSheetData(/trend|production|output/i);
    let parsedTrend = [];
    if (Array.isArray(trendRows) && trendRows.length > 0) {
      parsedTrend = trendRows.map((r) => ({
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
      parsedProcesses = processRows.map((r) => ({
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
      parsedSensors = sensorRows.map((r) => ({
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
    plantData.kpis = {
      ...plantData.kpis,
      ...parsedKpis,
      trends: { ...(plantData.kpis?.trends || {}), ...parsedTrends },
    };
    if (parsedTrend.length > 0) plantData.productionTrend = parsedTrend;
    if (parsedProcesses.length > 0) plantData.processBreakdown = parsedProcesses;
    if (parsedSensors.length > 0) plantData.sensors = parsedSensors;
    plantData.fileName = req.file.originalname;
    plantData.lastImportedAt = new Date();
    await plantData.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('dashboard:updated', { fileName: plantData.fileName, at: plantData.lastImportedAt });
    }

    res.json({
      success: true,
      message: `Successfully imported "${req.file.originalname}"`,
      data: plantData,
    });
  } catch (err) {
    console.error('Excel upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to parse Excel file: ' + err.message });
  }
});

module.exports = router;
