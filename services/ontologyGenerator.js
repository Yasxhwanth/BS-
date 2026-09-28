const { Alert } = require('../models');

const generateOntology = (nodes, edges) => {
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

const autoGenerateAlerts = async (nodes) => {
  const alertTemplates = {
    sensor: { severity: 'high', category: 'sensor', recommendation: 'Check sensor calibration and connectivity' },
    process: { severity: 'medium', category: 'predictive_maintenance', recommendation: 'Schedule preventive maintenance within 48 hours' },
    material: { severity: 'low', category: 'supply_chain', recommendation: 'Monitor material stock levels and reorder if needed' },
    worker: { severity: 'info', category: 'production', recommendation: 'Review shift assignments and workload distribution' },
    product: { severity: 'medium', category: 'quality', recommendation: 'Increase quality sampling frequency for this product' },
    department: { severity: 'low', category: 'production', recommendation: 'Review department KPIs and resource allocation' },
  };

  if (nodes.length > 0 && Math.random() > 0.5) {
    const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
    const template = alertTemplates[randomNode.type] || alertTemplates.process;
    const messages = {
      sensor: `Anomaly detected in ${randomNode.data?.label} - reading outside normal threshold`,
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

module.exports = {
  generateOntology,
  autoGenerateAlerts,
};
