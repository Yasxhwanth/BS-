import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Position, Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getOntology, saveOntology, exportOntology } from './api';
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
  DataShare,
} from '@carbon/icons-react';

// ─── Node color/label config ─────────────────────────────────
const NODE_TYPES_CONFIG = {
  process:    { color: '#0f62fe', label: 'Process',    icon: Settings },
  sensor:     { color: '#3ddbd9', label: 'Sensor',     icon: Activity },
  material:   { color: '#42be65', label: 'Material',   icon: Cube },
  worker:     { color: '#f1c21b', label: 'Worker',     icon: User },
  product:    { color: '#ff832b', label: 'Product',    icon: DeliveryParcel },
  department: { color: '#be95ff', label: 'Department', icon: Enterprise },
};

const SUBTYPES = {
  process:    ['Welding', 'Assembly', 'Quality Check', 'Painting', 'CNC Machining', 'Inspection', 'Packaging'],
  sensor:     ['Temperature', 'Vibration', 'Pressure', 'Speed', 'Humidity', 'Power', 'Flow'],
  material:   ['Steel', 'Aluminium', 'Plastic', 'Rubber', 'Component A', 'Raw Input', 'Sub-Assembly'],
  worker:     ['Operator', 'Technician', 'Engineer', 'Quality Inspector', 'Supervisor'],
  product:    ['Sub-Assembly', 'Final Product', 'Component', 'Batch Output'],
  department: ['Production', 'Maintenance', 'Quality Assurance', 'Logistics', 'Management'],
};

const RELATIONSHIPS = [
  { value: 'monitors',    label: 'monitors',      desc: 'Sensor → Process' },
  { value: 'feeds_into',  label: 'feeds into',    desc: 'Material → Process' },
  { value: 'produces',    label: 'produces',      desc: 'Process → Product' },
  { value: 'operated_by', label: 'operated by',   desc: 'Process → Worker' },
  { value: 'belongs_to',  label: 'belongs to',    desc: '→ Department' },
  { value: 'requires',    label: 'requires',      desc: 'Process → Material' },
  { value: 'part_of',     label: 'part of',       desc: 'Sub → Product' },
  { value: 'managed_by',  label: 'managed by',    desc: 'Dept → Worker' },
  { value: 'inspects',    label: 'inspects',      desc: 'Worker → Product' },
  { value: 'custom',      label: 'custom',        desc: 'Any → Any' },
];

// ─── Custom ReactFlow Node ────────────────────────────────────
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
          <div className="rf-node-badge">{data.description.slice(0, 40)}{data.description.length > 40 ? '…' : ''}</div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { manufacturing: ManufacturingNode };

// ─── Edge label renderer ──────────────────────────────────────
const edgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#525252', strokeWidth: 2 },
  labelStyle: { fill: '#c6c6c6', fontSize: 11 },
  labelBgStyle: { fill: '#262626', fillOpacity: 0.85 },
};

// ─── Main Component ──────────────────────────────────────────
export default function OntologyBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedRel, setSelectedRel]   = useState('custom');
  const [selectedNode, setSelectedNode] = useState(null);
  const [ontologyMeta, setOntologyMeta] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [addForm, setAddForm] = useState({ type: 'process', subtype: '', label: '', description: '' });
  const flowRef = useRef(null);
  let nodeCounter = useRef(nodes.length + 1);

  // Load saved ontology on mount
  useEffect(() => {
    getOntology().then(r => {
      if (r.data?.data) {
        const ont = r.data.data;
        setNodes(ont.nodes || []);
        setEdges(ont.edges || []);
        setOntologyMeta(ont.generatedOntology?.meta || null);
        nodeCounter.current = (ont.nodes?.length || 0) + 1;
      }
    }).catch(() => {});
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
    const cfg = NODE_TYPES_CONFIG[addForm.type];
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

  // Node click → show in right panel
  const onNodeClick = (_, node) => setSelectedNode(node);

  // Save ontology
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await saveOntology({ name: 'Manufacturing Ontology', nodes, edges });
      setOntologyMeta(data.generatedOntology?.meta || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  // Export JSON
  const handleExport = async () => {
    const { data } = await exportOntology();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'manufacturing-ontology.json'; a.click();
  };

  // Update selected node
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
      <div className="ontology-toolbar">
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginRight: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Network_4 size={18} /> Ontology Builder
        </span>
        <span className="text-xs text-muted" style={{ flex: 1 }}>
          Drag nodes onto canvas → Connect → Save to auto-generate OWL ontology
        </span>
        {ontologyMeta && (
          <span className="text-xs" style={{ color: 'var(--teal-40)', marginRight: 16, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckmarkFilled size={12} /> {ontologyMeta.nodeCount} nodes · {ontologyMeta.edgeCount} edges · {ontologyMeta.axiomCount} axioms
          </span>
        )}
        <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={nodes.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> Export JSON-LD
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || nodes.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {saving ? '…' : saved ? <><CheckmarkFilled size={14} /> Saved!</> : <><Save size={14} /> Save & Generate</>}
        </button>
      </div>

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
              <input className="form-input" placeholder="Node label…" value={addForm.label}
                onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addNode()} />
            </div>
            <button className="btn btn-secondary btn-sm w-full" onClick={addNode} style={{ justifyContent: 'center' }}>
              Add Node
            </button>
          </div>

          <div style={{ marginTop: 20, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Network_3 size={16} /> Relationship Type
            </div>
            <p className="text-xs text-muted" style={{ marginBottom: 8 }}>Select before drawing an edge</p>
            <div className="rel-grid">
              {RELATIONSHIPS.map(r => (
                <div key={r.value} className={`rel-item ${selectedRel === r.value ? 'selected' : ''}`}
                  onClick={() => setSelectedRel(r.value)}>
                  <strong>{r.label}</strong> <span className="text-xs text-muted">({r.desc})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER — ReactFlow Canvas */}
        <div className="ontology-canvas" ref={flowRef} onDrop={onDrop} onDragOver={onDragOver}>
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

          {nodes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
              color: 'var(--text-helper)',
            }}>
              <Industry size={44} style={{ marginBottom: 12, opacity: 0.7 }} />
              <div style={{ fontSize: 16, marginBottom: 8 }}>Start building your ontology</div>
              <div style={{ fontSize: 13 }}>Drag entity types from the left panel onto the canvas</div>
            </div>
          )}
        </div>

        {/* RIGHT — Node editor + generated ontology stats */}
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
                <input className="form-input" value={selectedNode.data?.description || ''}
                  onChange={e => updateSelectedNode('description', e.target.value)}
                  placeholder="Optional description…" />
              </div>
              <button className="btn btn-danger btn-sm w-full" style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }} onClick={deleteSelectedNode}>
                <TrashCan size={14} /> Delete Node
              </button>
            </>
          ) : (
            <div className="text-secondary text-sm">
              Click a node to edit its properties
            </div>
          )}

          {ontologyMeta && (
            <div style={{ marginTop: 24, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DataShare size={16} /> Generated Ontology
              </div>
              {[
                { label: 'OWL Classes', value: ontologyMeta.classCount },
                { label: 'Individuals', value: ontologyMeta.individualCount },
                { label: 'Object Properties', value: ontologyMeta.edgeCount },
                { label: 'Axioms', value: ontologyMeta.axiomCount },
                { label: 'Total Nodes', value: ontologyMeta.nodeCount },
              ].map(s => (
                <div key={s.label} className="ontology-stat">
                  <span className="ontology-stat-label">{s.label}</span>
                  <span className="ontology-stat-value">{s.value}</span>
                </div>
              ))}
              <div className="text-xs text-muted mt-16">
                Last generated: {new Date(ontologyMeta.generatedAt).toLocaleTimeString()}
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="panel-title">JSON-LD Preview</div>
                <div className="ontology-json">{`@context: mfg: manufacturing-aip.io/ontology#\n\nClasses: ${ontologyMeta.classCount} OWL classes\nProperties: ${ontologyMeta.edgeCount} object properties\nIndividuals: ${ontologyMeta.individualCount} instances\nAxioms: ${ontologyMeta.axiomCount} assertions\n\n→ Export full JSON-LD above`}</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, padding: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
            <div className="text-xs text-muted" style={{ marginBottom: 8 }}>Canvas Stats</div>
            <div className="ontology-stat"><span className="ontology-stat-label">Nodes</span><span className="ontology-stat-value">{nodes.length}</span></div>
            <div className="ontology-stat"><span className="ontology-stat-label">Edges</span><span className="ontology-stat-value">{edges.length}</span></div>
            <div className="ontology-stat"><span className="ontology-stat-label">Relationship</span><span className="ontology-stat-value" style={{ fontSize: 11 }}>{selectedRel}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
