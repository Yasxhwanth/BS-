// Utility functions for Ontology Auto-Linking, Mock Data, and Excel Parsing

export const RELATIONSHIPS = [
  { value: 'monitors',    label: 'monitors',      desc: 'Sensor -> Process' },
  { value: 'feeds_into',  label: 'feeds into',    desc: 'Material -> Process or Process -> Process' },
  { value: 'produces',    label: 'produces',      desc: 'Process -> Product' },
  { value: 'operated_by', label: 'operated by',   desc: 'Process -> Worker' },
  { value: 'belongs_to',  label: 'belongs to',    desc: 'Process/Worker -> Department' },
  { value: 'requires',    label: 'requires',      desc: 'Process -> Material' },
  { value: 'part_of',     label: 'part of',       desc: 'Sub-Assembly -> Product' },
  { value: 'managed_by',  label: 'managed by',    desc: 'Department -> Worker' },
  { value: 'inspects',    label: 'inspects',      desc: 'Worker -> Product' },
  { value: 'custom',      label: 'custom',        desc: 'Any -> Any' },
];

// Layout nodes in organized vertical columns by entity type
export function autoLayoutNodes(currentNodes) {
  const typeColumns = {
    department: { x: 60,   spacingY: 150 },
    worker:     { x: 380,  spacingY: 100 },
    material:   { x: 720,  spacingY: 100 },
    process:    { x: 1060, spacingY: 130 },
    sensor:     { x: 1400, spacingY: 100 },
    product:    { x: 1740, spacingY: 130 },
  };

  const counters = {};

  return currentNodes.map(node => {
    const type = node.data?.nodeType || 'process';
    const col = typeColumns[type] || { x: 500, spacingY: 110 };
    const currentCount = counters[type] || 0;
    counters[type] = currentCount + 1;

    return {
      ...node,
      position: {
        x: col.x,
        y: 60 + currentCount * col.spacingY,
      },
    };
  });
}

// Automatically build relationships between all nodes
export function buildAutoRelationships(currentNodes) {
  const newEdges = [];
  const edgeKeys = new Set();

  const addEdgeUnique = (sourceId, targetId, rel, animated = false) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const key = `${sourceId}->${targetId}:${rel}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);

    const relObj = RELATIONSHIPS.find(r => r.value === rel);
    newEdges.push({
      id: `e-${sourceId}-${targetId}-${rel}`,
      source: sourceId,
      target: targetId,
      type: 'smoothstep',
      label: relObj?.label || rel.replace(/_/g, ' '),
      data: { relationship: rel },
      relationship: rel,
      animated,
      style: { stroke: '#525252', strokeWidth: 2 },
      labelStyle: { fill: '#c6c6c6', fontSize: 11 },
      labelBgStyle: { fill: '#262626', fillOpacity: 0.85 },
    });
  };

  const departments = currentNodes.filter(n => n.data?.nodeType === 'department');
  const processes   = currentNodes.filter(n => n.data?.nodeType === 'process');
  const sensors     = currentNodes.filter(n => n.data?.nodeType === 'sensor');
  const materials   = currentNodes.filter(n => n.data?.nodeType === 'material');
  const workers     = currentNodes.filter(n => n.data?.nodeType === 'worker');
  const products    = currentNodes.filter(n => n.data?.nodeType === 'product');

  // 1. SENSORS -> PROCESSES (monitors)
  sensors.forEach((sensor, idx) => {
    const sProp = sensor.data?.properties || {};
    const sLabel = (sensor.data?.label || '').toLowerCase();
    const sDesc = (sensor.data?.description || '').toLowerCase();
    const explicitProc = (sProp.Process || '').toLowerCase();

    let matchedProc = null;

    if (explicitProc) {
      matchedProc = processes.find(p => {
        const pLabel = (p.data?.label || '').toLowerCase();
        return pLabel.includes(explicitProc) || explicitProc.includes(pLabel);
      });
    }

    if (!matchedProc) {
      if (sLabel.includes('weld') || sDesc.includes('weld')) {
        matchedProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('weld'));
      } else if (sLabel.includes('cnc') || sDesc.includes('cnc') || sLabel.includes('spindle')) {
        matchedProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('cnc') || (p.data?.label || '').toLowerCase().includes('machin'));
      } else if (sLabel.includes('hyd') || sLabel.includes('press') || sLabel.includes('stamp')) {
        matchedProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('press') || (p.data?.label || '').toLowerCase().includes('stamp'));
      } else if (sLabel.includes('paint') || sDesc.includes('paint') || sLabel.includes('oven')) {
        matchedProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('paint'));
      } else if (sLabel.includes('flow') || sLabel.includes('cool')) {
        matchedProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('cnc') || (p.data?.label || '').toLowerCase().includes('cool'));
      } else if (sLabel.includes('pkg') || sLabel.includes('pack')) {
        matchedProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('pack'));
      }
    }

    if (!matchedProc && processes.length > 0) {
      matchedProc = processes[idx % processes.length];
    }

    if (matchedProc) {
      addEdgeUnique(sensor.id, matchedProc.id, 'monitors', true);
    }
  });

  // 2. MATERIALS -> PROCESSES (feeds_into) & PROCESSES -> MATERIALS (requires)
  materials.forEach((mat, idx) => {
    const mLabel = (mat.data?.label || '').toLowerCase();
    const mSub = (mat.data?.subtype || '').toLowerCase();
    let targetProc = null;

    if (mLabel.includes('sheet') || mLabel.includes('coil') || mSub.includes('steel')) {
      targetProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('stamp') || (p.data?.label || '').toLowerCase().includes('press'));
    } else if (mLabel.includes('billet') || mSub.includes('aluminium') || mSub.includes('aluminum')) {
      targetProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('cnc') || (p.data?.label || '').toLowerCase().includes('machin'));
    } else if (mLabel.includes('wire') || mLabel.includes('flux') || mLabel.includes('gas') || mSub.includes('gas')) {
      targetProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('weld'));
    } else if (mLabel.includes('paint') || mLabel.includes('powder') || mSub.includes('coat')) {
      targetProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('paint'));
    } else if (mLabel.includes('fastener') || mLabel.includes('box') || mLabel.includes('strap')) {
      targetProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('pack') || (p.data?.label || '').toLowerCase().includes('assembl'));
    }

    if (!targetProc && processes.length > 0) {
      targetProc = processes[idx % processes.length];
    }

    if (targetProc) {
      addEdgeUnique(mat.id, targetProc.id, 'feeds_into', false);
      addEdgeUnique(targetProc.id, mat.id, 'requires', false);
    }
  });

  // 3. PROCESS PIPELINE (Process -> Process feeds_into)
  if (processes.length >= 2) {
    const pipelineKeywords = ['stamp', 'press', 'machin', 'cnc', 'weld', 'paint', 'check', 'inspect', 'assembl', 'pack'];
    const sortedProcs = [...processes].sort((a, b) => {
      const aName = (a.data?.label || '').toLowerCase();
      const bName = (b.data?.label || '').toLowerCase();
      const aIdx = pipelineKeywords.findIndex(k => aName.includes(k));
      const bIdx = pipelineKeywords.findIndex(k => bName.includes(k));
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    for (let i = 0; i < sortedProcs.length - 1; i++) {
      addEdgeUnique(sortedProcs[i].id, sortedProcs[i + 1].id, 'feeds_into', false);
    }
  }

  // 4. PROCESSES -> PRODUCTS (produces)
  processes.forEach((proc, idx) => {
    const pLabel = (proc.data?.label || '').toLowerCase();
    let prod = null;

    if (pLabel.includes('stamp') || pLabel.includes('press')) {
      prod = products.find(p => (p.data?.label || '').toLowerCase().includes('chassis') || (p.data?.label || '').toLowerCase().includes('frame'));
    } else if (pLabel.includes('cnc') || pLabel.includes('machin')) {
      prod = products.find(p => (p.data?.label || '').toLowerCase().includes('cylinder') || (p.data?.label || '').toLowerCase().includes('block'));
    } else if (pLabel.includes('weld')) {
      prod = products.find(p => (p.data?.label || '').toLowerCase().includes('sub') || (p.data?.label || '').toLowerCase().includes('housing'));
    } else if (pLabel.includes('paint')) {
      prod = products.find(p => (p.data?.label || '').toLowerCase().includes('powder') || (p.data?.label || '').toLowerCase().includes('coated'));
    } else if (pLabel.includes('assembl') || pLabel.includes('pack')) {
      prod = products.find(p => (p.data?.label || '').toLowerCase().includes('final') || (p.data?.label || '').toLowerCase().includes('pack') || (p.data?.label || '').toLowerCase().includes('ev'));
    }

    if (!prod && products.length > 0) {
      prod = products[idx % products.length];
    }

    if (prod) {
      addEdgeUnique(proc.id, prod.id, 'produces', false);
    }
  });

  // 5. WORKERS -> PROCESSES (operated_by)
  workers.forEach((worker, idx) => {
    const wRole = (worker.data?.subtype || worker.data?.label || '').toLowerCase();
    let targetProc = null;

    if (wRole.includes('weld')) {
      targetProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('weld'));
    } else if (wRole.includes('machin') || wRole.includes('cnc') || wRole.includes('operat')) {
      targetProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('cnc') || (p.data?.label || '').toLowerCase().includes('press'));
    } else if (wRole.includes('inspect') || wRole.includes('qual')) {
      targetProc = processes.find(p => (p.data?.label || '').toLowerCase().includes('check') || (p.data?.label || '').toLowerCase().includes('inspect'));
    }

    if (!targetProc && processes.length > 0) {
      targetProc = processes[idx % processes.length];
    }

    if (targetProc) {
      addEdgeUnique(targetProc.id, worker.id, 'operated_by', false);
    }

    // Workers -> Departments (managed_by)
    const wProp = worker.data?.properties || {};
    const wDept = (wProp.Department || '').toLowerCase();
    let targetDept = departments.find(d => {
      const dLabel = (d.data?.label || '').toLowerCase();
      return wDept.includes(dLabel) || dLabel.includes(wDept);
    });

    if (!targetDept && departments.length > 0) {
      targetDept = departments[idx % departments.length];
    }

    if (targetDept) {
      addEdgeUnique(targetDept.id, worker.id, 'managed_by', false);
    }
  });

  // 6. PROCESSES -> DEPARTMENTS (belongs_to)
  processes.forEach((proc, idx) => {
    const pProp = proc.data?.properties || {};
    const pDept = (pProp.Department || '').toLowerCase();
    let targetDept = departments.find(d => (d.data?.label || '').toLowerCase().includes(pDept));
    if (!targetDept && departments.length > 0) {
      targetDept = departments[0];
    }
    if (targetDept) {
      addEdgeUnique(proc.id, targetDept.id, 'belongs_to', false);
    }
  });

  // 7. PRODUCTS -> PRODUCTS (part_of)
  const components = products.filter(p => {
    const sub = (p.data?.subtype || '').toLowerCase();
    const lbl = (p.data?.label || '').toLowerCase();
    return sub.includes('sub') || lbl.includes('frame') || lbl.includes('block') || lbl.includes('part');
  });
  const mainProducts = products.filter(p => !components.includes(p));
  if (mainProducts.length > 0) {
    components.forEach(comp => {
      addEdgeUnique(comp.id, mainProducts[0].id, 'part_of', false);
    });
  }

  return newEdges;
}

// Parse an Excel sheet into ReactFlow nodes
export function parseExcelRowsToNodes(fileName, rows, startingCounter = 1) {
  const nameLower = fileName.toLowerCase();
  let nodeType = 'process';

  if (nameLower.includes('dept') || (rows[0] && 'Department_ID' in rows[0])) {
    nodeType = 'department';
  } else if (nameLower.includes('worker') || (rows[0] && 'Worker_ID' in rows[0])) {
    nodeType = 'worker';
  } else if (nameLower.includes('material') || (rows[0] && 'Material_ID' in rows[0])) {
    nodeType = 'material';
  } else if (nameLower.includes('sensor') || (rows[0] && 'Sensor_ID' in rows[0])) {
    nodeType = 'sensor';
  } else if (nameLower.includes('product') || (rows[0] && 'Product_ID' in rows[0])) {
    nodeType = 'product';
  } else if (nameLower.includes('process') || (rows[0] && 'Process_ID' in rows[0])) {
    nodeType = 'process';
  }

  let counter = startingCounter;

  return rows.map(row => {
    const id = `node-${nodeType}-${counter++}`;
    let label = row.Name || row.label || `${nodeType} ${counter}`;
    let subtype = row.Subtype || row.subtype || '';
    let description = '';

    if (nodeType === 'department') {
      description = `Location: ${row.Location || 'Plant'} · Manager: ${row.Manager || 'N/A'}`;
    } else if (nodeType === 'worker') {
      description = `Dept: ${row.Department || 'Production'} · Shift: ${row.Shift || 'Standard'}`;
    } else if (nodeType === 'material') {
      description = `Stock: ${row.Stock_Qty || 0} ${row.Unit || ''} · Supplier: ${row.Supplier || 'N/A'}`;
    } else if (nodeType === 'process') {
      description = `Machine: ${row.Machine || 'Standard'} · Uptime: ${row.Uptime_Pct || 90}%`;
    } else if (nodeType === 'sensor') {
      description = `Monitors: ${row.Process || 'Process'} · Metric: ${row.Current_Value || ''} ${row.Unit || ''}`;
    } else if (nodeType === 'product') {
      description = `SKU: ${row.SKU || 'N/A'} · Daily: ${row.Daily_Output || 0} units`;
    }

    return {
      id,
      type: 'manufacturing',
      position: { x: 300, y: 300 },
      data: {
        label,
        subtype,
        description,
        nodeType,
        properties: { ...row },
      },
    };
  });
}
