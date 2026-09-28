const express = require('express');
const router = express.Router();
const path = require('path');
const { Ontology } = require('../models');
const { protect } = require('../middleware/auth');
const { generateOntology, autoGenerateAlerts } = require('../services/ontologyGenerator');

router.get('/', protect, async (req, res) => {
  try {
    const ontology = await Ontology.findOne({ createdBy: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, data: ontology });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/save', protect, async (req, res) => {
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
      ontology = await Ontology.create({
        name,
        description,
        nodes: nodes || [],
        edges: edges || [],
        generatedOntology,
        createdBy: req.user._id,
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('ontology:updated', { ontologyId: ontology._id, meta: generatedOntology.meta });
    }

    await autoGenerateAlerts(nodes || [], edges || []);
    res.json({ success: true, data: ontology, generatedOntology });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/export', protect, async (req, res) => {
  try {
    const ontology = await Ontology.findOne({ createdBy: req.user._id });
    if (!ontology) {
      return res.status(404).json({ success: false, message: 'No ontology found' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=manufacturing-ontology.json');
    res.json(ontology.generatedOntology);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/mock', protect, async (req, res) => {
  try {
    const mockData = require('../mock_ontology_data.json');
    res.json({ success: true, data: mockData });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load mock ontology: ' + err.message });
  }
});

module.exports = router;
