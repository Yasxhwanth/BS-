import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Position, Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import * as XLSX from 'xlsx';
import { getOntology, saveOntology, exportOntology, getMockOntology } from './api';
import {
  autoLayoutNodes,
  buildAutoRelationships,
  parseExcelRowsToNodes,
  RELATIONSHIPS,
} from './ontologyUtils';
import {
  Settings,
  Activity,
  Cube,
  User,
  DeliveryParcel,
  Enterprise,
  Network_4,
  Network_3,
  Save,
  Download,
  CheckmarkFilled,
  Layers,
  Add,
  Industry,
  Edit,
  TrashCan,
  Upload,
  Reset,
  Grid,
  ConnectionSignal,
  Close,
} from '@carbon/icons-react';

// Node color/label config
const NODE_TYPES_CONFIG = {
  process:    { color: '#0f62fe', label: 'Process',    icon: Settings },
  sensor:     { color: '#3ddbd9', label: 'Sensor',     icon: Activity },
  material:   { color: '#42be65', label: 'Material',   icon: Cube },
  worker:     { color: '#f1c21b', label: 'Worker',     icon: User },
  product:    { color: '#ff832b', label: 'Product',    icon: DeliveryParcel },
  department: { color: '#be95ff', label: 'Department', icon: Enterprise },
};

const SUBTYPES = {
  process:    ['Welding', 'Assembly', 'Quality Check', 'Painting', 'CNC Machining', 'Inspection', 'Packaging', 'Stamping'],
  sensor:     ['Temperature', 'Vibration', 'Pressure', 'Speed', 'Humidity', 'Power', 'Flow'],
  material:   ['Steel', 'Aluminium', 'Plastic', 'Rubber', 'Component A', 'Raw Input', 'Sub-Assembly'],
  worker:     ['Operator', 'Technician', 'Engineer', 'Quality Inspector', 'Supervisor'],
  product:    ['Sub-Assembly', 'Final Product', 'Component', 'Batch Output'],
  department: ['Production', 'Maintenance', 'Quality Assurance', 'Logistics', 'Management'],
};

// Custom ReactFlow Node
function ManufacturingNode({ data }) {
  const cfg = NODE_TYPES_CONFIG[data.nodeType] || NODE_TYPES_CONFIG.process;
  const Icon = cfg.icon;
  return (
    <div className="rf-node" style={{ borderColor: cfg.color }}>
      <Handle type="target" position={Position.Left}  style={{ borderColor: cfg.color }} />
      <Handle type="source" position={Position.Right} style={{ background: cfg.color }} />
      <div className="rf-node-header" style={{ color: cfg.color, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={14} />
        <span>{cfg.label}</span>
      </div>
      <div className="rf-node-body">
        <div className="rf-node-label">{data.label}</div>
        {data.subtype && <div className="rf-node-sub">{data.subtype}</div>}
        {data.description && (
          <div className="rf-node-badge">{data.description.slice(0, 40)}{data.description.length > 40 ? '...' : ''}</div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { manufacturing: ManufacturingNode };

// Edge label renderer
const edgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#525252', strokeWidth: 2 },
  labelStyle: { fill: '#c6c6c6', fontSize: 11 },
  labelBgStyle: { fill: '#262626', fillOpacity: 0.85 },
};

export default function OntologyBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedRel, setSelectedRel]   = useState('custom');
  const [selectedNode, setSelectedNode] = useState(null);
  const [ontologyMeta, setOntologyMeta] = useState(null);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [loadingMock, setLoadingMock]   = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);
  const [addForm, setAddForm]           = useState({ type: 'process', subtype: '', label: '', description: '' });

  const flowRef   = useRef(null);
  const uploadRef = useRef(null);
  let nodeCounter = useRef(nodes.length + 1);

  const showStatus = (text, type = 'info') => {
    setStatusBanner({ text, type });
    setTimeout(() => setStatusBanner(null), 5000);
  };

  // Load saved ontology on mount
  useEffect(() => {
    getOntology()
      .then(r => {
        if (r.data?.data) {
          const ont = r.data.data;
          setNodes(ont.nodes || []);
          setEdges(ont.edges || []);
          setOntologyMeta(ont.generatedOntology?.meta || null);
          nodeCounter.current = (ont.nodes?.length || 0) + 1;
        }
      })
      .catch(() => {});
  }, []);

  // Connect edge with selected relationship
  const onConnect = useCallback((params) => {
    const rel = RELATIONSHIPS.find(r => r.value === selectedRel);
    setEdges(eds => addEdge({
      ...params,
      ...edgeOptions,
      id: `e-${params.source}-${params.target}-${Date.now()}`,
      label: rel?.label || 'related',
      data: { relationship: selectedRel },
      relationship: selectedRel,
      animated: selectedRel === 'monitors',
    }, eds));
  }, [selectedRel, setEdges]);

  // Add node from palette
  const addNode = () => {
    if (!addForm.label.trim()) return;
    const id = `node-${nodeCounter.current++}`;
    setNodes(ns => [...ns, {
      id,
      type: 'manufacturing',
      position: { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: {
        label: addForm.label,
        subtype: addForm.subtype,
        description: addForm.description,
        nodeType: addForm.type,
        properties: {},
      },
    }]);
    setAddForm(f => ({ ...f, label: '', description: '' }));
  };

  // Drag-add from palette
  const onDragStart = (e, nodeType) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/reactflow');
    if (!nodeType) return;
    const bounds = flowRef.current?.getBoundingClientRect();
    const position = { x: e.clientX - (bounds?.left || 0) - 80, y: e.clientY - (bounds?.top || 0) - 40 };
    const id = `node-${nodeCounter.current++}`;
    const cfg = NODE_TYPES_CONFIG[nodeType];
    const subtype = SUBTYPES[nodeType]?.[0] || '';
    setNodes(ns => [...ns, {
      id, type: 'manufacturing', position,
      data: { label: `${cfg.label} ${nodeCounter.current - 1}`, subtype, nodeType, description: '', properties: {} },
    }]);
  }, [setNodes]);

  const onDragOver = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const onNodeClick = (_, node) => setSelectedNode(node);

  // Save ontology
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await saveOntology({ name: 'Manufacturing Ontology', nodes, edges });
      setOntologyMeta(data.generatedOntology?.meta || null);
      setSaved(true);
      showStatus('Ontology saved and OWL classes generated successfully.', 'success');
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      showStatus('Failed to save ontology: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Export JSON
  const handleExport = async () => {
    try {
      const { data } = await exportOntology();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manufacturing-ontology.json';
      a.click();
    } catch {
      showStatus('No ontology available to export.', 'error');
    }
  };

  // 1-Click Load Mock Plant Data
  const handleLoadMockData = async () => {
    setLoadingMock(true);
    try {
      const res = await getMockOntology();
      if (res.data?.success && res.data.data) {
        const mock = res.data.data;
        const arrangedNodes = autoLayoutNodes(mock.nodes || []);
        setNodes(arrangedNodes);
        setEdges(mock.edges || []);
        nodeCounter.current = (mock.nodes?.length || 0) + 1;
        setSelectedNode(null);
        showStatus(`Loaded complete mock ontology with ${arrangedNodes.length} entities and ${(mock.edges || []).length} relationships.`, 'success');
      }
    } catch (err) {
      showStatus('Failed to load mock data: ' + err.message, 'error');
    } finally {
      setLoadingMock(false);
    }
  };

  // Automatically build relationships between all nodes
  const handleAutoBuildRelationships = () => {
    if (nodes.length < 2) {
      showStatus('Add at least two nodes to build relationships.', 'error');
      return;
    }
    const builtEdges = buildAutoRelationships(nodes);
    setEdges(builtEdges);
    showStatus(`Auto-built ${builtEdges.length} semantic relationships across ${nodes.length} nodes.`, 'success');
  };

  // Auto-arrange layout into clean columns
  const handleAutoArrange = () => {
    if (nodes.length === 0) return;
    const arranged = autoLayoutNodes(nodes);
    setNodes(arranged);
    showStatus('Nodes arranged into structured manufacturing columns.', 'info');
  };

  // Clear Canvas
  const handleClearCanvas = () => {
    if (nodes.length === 0) return;
    if (window.confirm('Clear all nodes and relationships from the canvas?')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      showStatus('Canvas cleared.', 'info');
    }
  };

  // Handle Multi-File Upload (Excel or JSON)
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let newNodes = [];
    let hasJson = false;

    for (const file of files) {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.json')) {
        hasJson = true;
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (parsed.nodes && Array.isArray(parsed.nodes)) {
            setNodes(autoLayoutNodes(parsed.nodes));
            setEdges(parsed.edges || []);
            nodeCounter.current = parsed.nodes.length + 1;
            showStatus(`Imported ${parsed.nodes.length} nodes and ${(parsed.edges || []).length} edges from ${file.name}.`, 'success');
            e.target.value = '';
            return;
          }
        } catch {
          showStatus(`Failed to parse JSON file ${file.name}.`, 'error');
        }
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        try {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet);

          if (rows.length > 0) {
            const parsedNodes = parseExcelRowsToNodes(file.name, rows, nodeCounter.current);
            nodeCounter.current += parsedNodes.length;
            newNodes = [...newNodes, ...parsedNodes];
          }
        } catch (err) {
          showStatus(`Failed to read Excel file ${file.name}: ${err.message}`, 'error');
        }
      }
    }

    if (!hasJson && newNodes.length > 0) {
      // Merge with existing nodes
      const allNodes = [...nodes, ...newNodes];
      const arrangedNodes = autoLayoutNodes(allNodes);
      setNodes(arrangedNodes);

      // Automatically construct relationships for the loaded entities!
      const builtEdges = buildAutoRelationships(arrangedNodes);
      setEdges(builtEdges);

      showStatus(`Imported ${newNodes.length} nodes from ${files.length} file(s) and automatically built ${builtEdges.length} relationships.`, 'success');
    }

    e.target.value = '';
  };

  // Node editing handlers
  const updateSelectedNode = (field, value) => {
    if (!selectedNode) return;
    setNodes(ns => ns.map(n => n.id === selectedNode.id
      ? { ...n, data: { ...n.data, [field]: value } }
      : n
    ));
    setSelectedNode(n => ({ ...n, data: { ...n.data, [field]: value } }));
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes(ns => ns.filter(n => n.id !== selectedNode.id));
    setEdges(es => es.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  return (
    <div className="ontology-shell" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Toolbar */}
      <div className="ontology-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginRight: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Network_4 size={18} /> Digital Twin Studio
        </span>

        {ontologyMeta && (
          <span className="text-xs" style={{ color: 'var(--teal-40)', marginRight: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckmarkFilled size={12} /> {ontologyMeta.nodeCount} nodes · {ontologyMeta.edgeCount} edges
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Hidden Multi-file input */}
        <input
          ref={uploadRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.json,.csv"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {/* Action Buttons */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => uploadRef.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Upload Excel files (department, worker, material, process, sensor, product) or JSON"
        >
          <Upload size={14} /> Upload Mock Files
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleLoadMockData}
          disabled={loadingMock}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Instantly load preconfigured 30-node manufacturing plant data"
        >
          <Layers size={14} /> {loadingMock ? 'Loading...' : 'Load Mock Data'}
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleAutoBuildRelationships}
          disabled={nodes.length < 2}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: 'var(--teal-40)', color: 'var(--teal-40)' }}
          title="Analyze nodes on canvas and automatically generate domain relationships"
        >
          <ConnectionSignal size={14} /> Auto-Build Relationships
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleAutoArrange}
          disabled={nodes.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Arrange nodes into structured columns"
        >
          <Grid size={14} /> Auto-Arrange
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleClearCanvas}
          disabled={nodes.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Clear canvas"
        >
          <Reset size={14} /> Clear
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleExport}
          disabled={nodes.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={14} /> Export JSON-LD
        </button>

        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving || nodes.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {saving ? 'Saving...' : saved ? <><CheckmarkFilled size={14} /> Saved!</> : <><Save size={14} /> Save & Generate</>}
        </button>
      </div>

      {/* Status Banner */}
      {statusBanner && (
        <div style={{
          padding: '8px 16px',
          background: statusBanner.type === 'error' ? 'rgba(218, 30, 40, 0.2)' : statusBanner.type === 'success' ? 'rgba(0, 166, 126, 0.2)' : 'rgba(15, 98, 254, 0.2)',
          borderBottom: `1px solid ${statusBanner.type === 'error' ? 'var(--red-40)' : statusBanner.type === 'success' ? 'var(--teal-40)' : 'var(--blue-40)'}`,
          color: 'var(--text-primary)',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{statusBanner.text}</span>
          <button
            onClick={() => setStatusBanner(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <Close size={14} />
          </button>
        </div>
      )}

      {/* Main workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', flex: 1, overflow: 'hidden' }}>

        {/* LEFT — Palette */}
        <div className="ontology-panel">
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={16} /> Entity Palette
          </div>
          <p className="text-xs text-muted" style={{ marginBottom: 12 }}>Drag to canvas or fill form below</p>

          <div className="node-palette">
            {Object.entries(NODE_TYPES_CONFIG).map(([type, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={type} className="palette-node"
                  draggable onDragStart={e => onDragStart(e, type)}>
                  <div className="palette-dot" style={{ background: cfg.color }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} /> {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Add size={16} /> Quick Add
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <select className="form-select" value={addForm.type}
                onChange={e => setAddForm(f => ({ ...f, type: e.target.value, subtype: SUBTYPES[e.target.value]?.[0] || '' }))}>
                {Object.entries(NODE_TYPES_CONFIG).map(([t, c]) => <option key={t} value={t}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <select className="form-select" value={addForm.subtype}
                onChange={e => setAddForm(f => ({ ...f, subtype: e.target.value }))}>
                {(SUBTYPES[addForm.type] || []).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <input className="form-input" placeholder="Node label..." value={addForm.label}
                onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addNode()} />
            </div>
            <button className="btn btn-secondary btn-sm w-full" onClick={addNode} style={{ justifyContent: 'center' }}>
              Add Node
            </button>
          </div>

          <div style={{ marginTop: 20, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Network_3 size={16} /> Manual Link Mode
            </div>
            <p className="text-xs text-muted" style={{ marginBottom: 8 }}>Selected for drag-to-connect edges</p>
            <div className="rel-grid">
              {RELATIONSHIPS.map(r => (
                <div key={r.value} className={`rel-item ${selectedRel === r.value ? 'selected' : ''}`}
                  onClick={() => setSelectedRel(r.value)}>
                  <div style={{ fontWeight: 600 }}>{r.label}</div>
                  <div style={{ color: 'var(--text-helper)' }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER — ReactFlow Canvas */}
        <div ref={flowRef} style={{ position: 'relative', width: '100%', height: '100%' }}
          onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={edgeOptions}
            fitView
          >
            <Background color="#333" gap={20} size={1} />
            <Controls />
            <MiniMap
              nodeColor={n => NODE_TYPES_CONFIG[n.data?.nodeType]?.color || '#525252'}
              maskColor="rgba(0,0,0,0.6)"
            />
          </ReactFlow>

          {/* Empty State */}
          {nodes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-helper)', padding: 24, textAlign: 'center',
            }}>
              <Industry size={48} style={{ marginBottom: 16, opacity: 0.6 }} />
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Ontology Knowledge Graph Canvas
              </div>
              <p style={{ maxWidth: 440, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                Load preconfigured mock plant entities or upload individual Excel/JSON datasets. Once nodes are on the canvas, use Auto-Build Relationships to automatically connect them.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleLoadMockData}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <Layers size={16} />
                  <span>Load Complete Mock Plant (30 Entities + 40 Links)</span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => uploadRef.current?.click()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <Upload size={16} />
                  <span>Upload Excel Datasets</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Node editor */}
        <div className="ontology-panel-right">
          {selectedNode ? (
            <>
              <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Edit size={16} /> Edit Node
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 2, marginBottom: 16, border: '1px solid var(--border-subtle)' }}>
                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Type</div>
                <div style={{ color: NODE_TYPES_CONFIG[selectedNode.data?.nodeType]?.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {(() => {
                    const NodeIcon = NODE_TYPES_CONFIG[selectedNode.data?.nodeType]?.icon || Settings;
                    return <NodeIcon size={16} />;
                  })()}
                  {NODE_TYPES_CONFIG[selectedNode.data?.nodeType]?.label}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Label</label>
                <input className="form-input" value={selectedNode.data?.label || ''}
                  onChange={e => updateSelectedNode('label', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Subtype</label>
                <select className="form-select" value={selectedNode.data?.subtype || ''}
                  onChange={e => updateSelectedNode('subtype', e.target.value)}>
                  {(SUBTYPES[selectedNode.data?.nodeType] || []).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={3} value={selectedNode.data?.description || ''}
                  onChange={e => updateSelectedNode('description', e.target.value)} />
              </div>

              {/* Node Properties */}
              {selectedNode.data?.properties && Object.keys(selectedNode.data.properties).length > 0 && (
                <div style={{ marginTop: 12, marginBottom: 16 }}>
                  <div className="form-label" style={{ marginBottom: 6 }}>Properties</div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', background: 'var(--bg-primary)', padding: 8, borderRadius: 2, border: '1px solid var(--border-subtle)', fontSize: 11 }}>
                    {Object.entries(selectedNode.data.properties).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ color: 'var(--text-helper)' }}>{k}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn btn-secondary btn-sm w-full" onClick={deleteSelectedNode}
                style={{ justifyContent: 'center', color: 'var(--red-40)', borderColor: 'var(--red-40)' }}>
                <TrashCan size={14} /> Delete Node
              </button>
            </>
          ) : (
            <div>
              <div className="panel-title">Node Inspector</div>
              <p className="text-xs text-muted" style={{ marginBottom: 16 }}>Click any node on the canvas to inspect and edit its properties.</p>

              <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 4, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Graph Summary</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-helper)' }}>Total Nodes:</span>
                  <span style={{ fontWeight: 600 }}>{nodes.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-helper)' }}>Total Edges:</span>
                  <span style={{ fontWeight: 600 }}>{edges.length}</span>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                  {Object.entries(NODE_TYPES_CONFIG).map(([t, c]) => {
                    const count = nodes.filter(n => n.data?.nodeType === t).length;
                    return (
                      <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                        <span style={{ color: c.color }}>{c.label}:</span>
                        <span>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
