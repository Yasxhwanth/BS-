import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Position, Handle } from 'reactflow';
import 'reactflow/dist/style.css';
import * as XLSX from 'xlsx';
import { getOntology, saveOntology, exportOntology, getMockOntology } from './api';
import { autoLayoutNodes, buildAutoRelationships, parseExcelRowsToNodes, RELATIONSHIPS } from './ontologyUtils';
import { Settings, Activity, Cube, User, DeliveryParcel, Enterprise, Network_4, Network_3, Save, Download, CheckmarkFilled, Layers, Add, Industry, Edit, TrashCan, Upload, Reset, Grid, ConnectionSignal, Close } from '@carbon/icons-react';

const TYPES = {
  process:    { color: '#0f62fe', label: 'Process',    icon: Settings },
  sensor:     { color: '#3ddbd9', label: 'Sensor',     icon: Activity },
  material:   { color: '#42be65', label: 'Material',   icon: Cube },
  worker:     { color: '#f1c21b', label: 'Worker',     icon: User },
  product:    { color: '#ff832b', label: 'Product',    icon: DeliveryParcel },
  department: { color: '#be95ff', label: 'Department', icon: Enterprise },
};

const SUBS = {
  process:    ['Welding','Assembly','Quality Check','Painting','CNC Machining','Inspection','Packaging'],
  sensor:     ['Temperature','Vibration','Pressure','Speed','Humidity','Power','Flow'],
  material:   ['Steel','Aluminium','Plastic','Rubber','Component A','Raw Input'],
  worker:     ['Operator','Technician','Engineer','Quality Inspector','Supervisor'],
  product:    ['Sub-Assembly','Final Product','Component','Batch Output'],
  department: ['Production','Maintenance','Quality Assurance','Logistics','Management'],
};

// Per-relationship edge colours + glow
const REL_EDGE = {
  monitors:    { color: '#3ddbd9', animated: true  },
  feeds_into:  { color: '#0f62fe', animated: false },
  produces:    { color: '#42be65', animated: false },
  operated_by: { color: '#f1c21b', animated: false },
  belongs_to:  { color: '#be95ff', animated: false },
  requires:    { color: '#ff832b', animated: false },
  part_of:     { color: '#fa4d56', animated: false },
  managed_by:  { color: '#be95ff', animated: false },
  inspects:    { color: '#42be65', animated: true  },
  custom:      { color: '#78a9ff', animated: false },
};

const makeEdgeStyle = (relValue) => {
  const r = REL_EDGE[relValue] || REL_EDGE.custom;
  return {
    type: 'smoothstep',
    animated: r.animated,
    style: { stroke: r.color, strokeWidth: 2.5, filter: `drop-shadow(0 0 4px ${r.color}88)` },
    labelStyle: { fill: r.color, fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: 'var(--bg-secondary, #262626)', fillOpacity: 0.9 },
    markerEnd: { type: 'arrowclosed', color: r.color, width: 14, height: 14 },
  };
};

const EDGE_OPTS = {
  type: 'smoothstep',
  style: { stroke: 'var(--blue-40, #4589ff)', strokeWidth: 2 },
  markerEnd: { type: 'arrowclosed', color: 'var(--blue-40, #4589ff)', width: 14, height: 14 },
};

function MfgNode({ data }) {
  const t = TYPES[data.nodeType] || TYPES.process;
  return (
    <div className="rf-node" style={{ borderColor: t.color }}>
      <Handle type="target" position={Position.Left} style={{ borderColor: t.color }} />
      <Handle type="source" position={Position.Right} style={{ background: t.color }} />
      <div className="rf-node-header" style={{ color: t.color }}>
        <t.icon size={14} /><span>{t.label}</span>
      </div>
      <div className="rf-node-body">
        <div className="rf-node-label">{data.label}</div>
        {data.subtype && <div className="rf-node-sub">{data.subtype}</div>}
      </div>
    </div>
  );
}

const nodeTypes = { manufacturing: MfgNode };

export default function OntologyBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selRel, setSelRel]     = useState('custom');
  const [selNode, setSelNode]   = useState(null);
  const [inspOpen, setInspOpen] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [banner, setBanner]     = useState(null);
  const [form, setForm]         = useState({ type: 'process', subtype: '', label: '' });
  const flowRef   = useRef(null);
  const uploadRef = useRef(null);
  const counter   = useRef(1);

  const notify = (text, type = 'info') => {
    setBanner({ text, type });
    setTimeout(() => setBanner(null), 4000);
  };

  const loadMock = async (silent) => {
    try {
      const res = await getMockOntology();
      if (res.data?.success) {
        const { nodes: n, edges: e } = res.data.data;
        const laid = autoLayoutNodes(n || []);
        setNodes(laid); setEdges(e || []);
        counter.current = laid.length + 1;
        setSelNode(null); setInspOpen(false);
        if (!silent) notify(`Loaded ${laid.length} entities, ${(e||[]).length} edges.`, 'success');
      }
    } catch (err) { if (!silent) notify(err.message, 'error'); }
  };

  useEffect(() => {
    getOntology()
      .then(r => {
        const ont = r.data?.data;
        if (ont?.nodes?.length) {
          setNodes(ont.nodes); setEdges(ont.edges || []);
          counter.current = ont.nodes.length + 1;
        } else loadMock(true);
      })
      .catch(() => loadMock(true));
  }, []); // eslint-disable-line

  const onConnect = useCallback((p) => {
    const rel = RELATIONSHIPS.find(r => r.value === selRel);
    setEdges(es => addEdge({ ...p, ...makeEdgeStyle(selRel), id: `e-${Date.now()}`, label: rel?.label || 'related' }, es));
  }, [selRel, setEdges]);

  const addNode = () => {
    if (!form.label.trim()) return;
    setNodes(ns => [...ns, { id: `n-${counter.current++}`, type: 'manufacturing', position: { x: 200 + Math.random()*400, y: 100 + Math.random()*300 }, data: { ...form, nodeType: form.type, properties: {} } }]);
    setForm(f => ({ ...f, label: '' }));
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const t = e.dataTransfer.getData('application/reactflow');
    if (!t) return;
    const b = flowRef.current?.getBoundingClientRect();
    setNodes(ns => [...ns, { id: `n-${counter.current++}`, type: 'manufacturing', position: { x: e.clientX-(b?.left||0)-80, y: e.clientY-(b?.top||0)-40 }, data: { label: `${TYPES[t].label} ${counter.current-1}`, subtype: SUBS[t]?.[0]||'', nodeType: t, properties: {} } }]);
  }, [setNodes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveOntology({ name: 'Manufacturing Ontology', nodes, edges });
      setSaved(true); notify('Saved successfully.', 'success');
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { notify('Save failed: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleExport = async () => {
    try {
      let exportData;
      try {
        const { data } = await exportOntology();
        exportData = data;
      } catch {
        exportData = { nodes, edges, exportedAt: new Date().toISOString() };
      }
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })),
        download: 'ontology.json',
      });
      a.click();
      notify('Exported ontology.json successfully.', 'success');
    } catch (e) {
      notify('Export failed: ' + e.message, 'error');
    }
  };

  const handleUpload = async (e) => {
    const files = [...(e.target.files||[])];
    let extra = [];
    for (const f of files) {
      if (f.name.endsWith('.json')) {
        const p = JSON.parse(await f.text());
        if (p.nodes?.length) { setNodes(autoLayoutNodes(p.nodes)); setEdges(p.edges||[]); counter.current=p.nodes.length+1; notify(`Imported ${p.nodes.length} nodes.`,'success'); e.target.value=''; return; }
      } else {
        const wb = XLSX.read(await f.arrayBuffer(), { type:'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        extra = [...extra, ...parseExcelRowsToNodes(f.name, rows, counter.current)];
        counter.current += extra.length;
      }
    }
    if (extra.length) {
      const all = autoLayoutNodes([...nodes, ...extra]);
      const built = colorEdges(buildAutoRelationships(all));
      setNodes(all); setEdges(built);
      notify(`Imported ${extra.length} nodes, built ${built.length} edges.`, 'success');
    }
    e.target.value = '';
  };

  const updateNode = (field, val) => {
    if (!selNode) return;
    setNodes(ns => ns.map(n => n.id===selNode.id ? {...n, data:{...n.data,[field]:val}} : n));
    setSelNode(n => ({...n, data:{...n.data,[field]:val}}));
  };

  const deleteNode = () => {
    setNodes(ns => ns.filter(n => n.id!==selNode.id));
    setEdges(es => es.filter(e => e.source!==selNode.id && e.target!==selNode.id));
    setSelNode(null); setInspOpen(false);
  };

  const openNode = (_, n) => { setSelNode(n); setInspOpen(true); };
  const closeInsp = () => { setSelNode(null); setInspOpen(false); };

  // Apply colour/glow styles to auto-built edges
  const colorEdges = (rawEdges) => rawEdges.map(e => ({ ...e, ...makeEdgeStyle(e.relationship || e.data?.relationship || 'custom') }));

  const bannerColor = { error:'#da1e28', success:'#42be65', info:'#0f62fe' };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', height:48, flexShrink:0, background:'var(--bg-secondary)', borderBottom:'1px solid var(--border-subtle)', flexWrap:'wrap' }}>
        <Network_4 size={18} style={{ color:'var(--blue-40)' }} />
        <strong style={{ fontSize:14, marginRight:8 }}>Digital Twin Studio</strong>
        <div style={{ flex:1 }} />
        <input ref={uploadRef} type="file" multiple accept=".xlsx,.xls,.json,.csv" style={{ display:'none' }} onChange={handleUpload} />
        {[
          { icon:<Upload size={14}/>, label:'Upload', onClick:()=>uploadRef.current?.click() },
          { icon:<Layers size={14}/>, label:'Load Mock', onClick:()=>loadMock(false) },
          { icon:<ConnectionSignal size={14}/>, label:'Auto-Relate', onClick:()=>{ if(nodes.length<2){notify('Need 2+ nodes','error');return;} const b=colorEdges(buildAutoRelationships(nodes));setEdges(b);notify(`Built ${b.length} edges.`,'success'); }, style:{ borderColor:'var(--teal-40)', color:'var(--teal-40)' } },
          { icon:<Grid size={14}/>, label:'Arrange', onClick:()=>{ setNodes(autoLayoutNodes(nodes)); } },
          { icon:<Reset size={14}/>, label:'Clear', onClick:()=>{ if(window.confirm('Clear canvas?')){ setNodes([]);setEdges([]);closeInsp(); } }, style:{ color:'var(--support-error)', borderColor:'var(--support-error)' } },
          { icon:<Download size={14}/>, label:'Export', onClick:handleExport },
        ].map(b => (
          <button key={b.label} className="btn btn-secondary btn-sm" onClick={b.onClick} style={{ display:'inline-flex', alignItems:'center', gap:5, ...b.style }}>
            {b.icon} {b.label}
          </button>
        ))}
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving||!nodes.length} style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
          {saved ? <><CheckmarkFilled size={14}/> Saved</> : <><Save size={14}/> Save</>}
        </button>
      </div>

      {/* Banner */}
      {banner && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 16px', background:`${bannerColor[banner.type]}18`, borderBottom:`1px solid ${bannerColor[banner.type]}`, fontSize:13, flexShrink:0 }}>
          <span>{banner.text}</span>
          <button onClick={()=>setBanner(null)} style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer' }}><Close size={14}/></button>
        </div>
      )}

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Left Palette */}
        <div style={{ width:210, flexShrink:0, overflowY:'auto', background:'var(--bg-secondary)', borderRight:'1px solid var(--border-subtle)', padding:14 }}>
          {/* Entity drag items */}
          <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-helper)', marginBottom:8 }}>Entity Types</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:16 }}>
            {Object.entries(TYPES).map(([type, cfg]) => (
              <div key={type} className="palette-node" draggable
                onDragStart={e=>{ e.dataTransfer.setData('application/reactflow',type); e.dataTransfer.effectAllowed='move'; }}
                style={{ borderLeft:`3px solid ${cfg.color}` }}>
                <cfg.icon size={13} style={{ color:cfg.color }} />
                <span style={{ fontSize:13 }}>{cfg.label}</span>
              </div>
            ))}
          </div>

          {/* Quick Add */}
          <div style={{ borderTop:'1px solid var(--border-subtle)', paddingTop:14, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-helper)', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}><Add size={13}/> Quick Add</div>
            <select className="form-select" style={{ marginBottom:6 }} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value,subtype:SUBS[e.target.value]?.[0]||''}))}>
              {Object.entries(TYPES).map(([t,c])=><option key={t} value={t}>{c.label}</option>)}
            </select>
            <select className="form-select" style={{ marginBottom:6 }} value={form.subtype} onChange={e=>setForm(f=>({...f,subtype:e.target.value}))}>
              {(SUBS[form.type]||[]).map(s=><option key={s}>{s}</option>)}
            </select>
            <input className="form-input" style={{ marginBottom:6 }} placeholder="Label" value={form.label}
              onChange={e=>setForm(f=>({...f,label:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addNode()} />
            <button className="btn btn-secondary btn-sm" onClick={addNode} style={{ width:'100%', justifyContent:'center' }}>Add Node</button>
          </div>

          {/* Link type */}
          <div style={{ borderTop:'1px solid var(--border-subtle)', paddingTop:14, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-helper)', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}><Network_3 size={13}/> Link Type</div>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {RELATIONSHIPS.map(r=>(
                <div key={r.value} className={`rel-item${selRel===r.value?' selected':''}`} onClick={()=>setSelRel(r.value)}>
                  <div style={{ fontWeight:600, fontSize:12 }}>{r.label}</div>
                  <div style={{ fontSize:11, color:'var(--text-helper)' }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div style={{ borderTop:'1px solid var(--border-subtle)', paddingTop:14 }}>
            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-helper)', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}><Industry size={13}/> Summary</div>
            <div style={{ background:'var(--bg-primary)', border:'1px solid var(--border-subtle)', borderRadius:2, padding:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}><span style={{ color:'var(--text-helper)' }}>Nodes</span><strong style={{ color:'var(--blue-40)' }}>{nodes.length}</strong></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}><span style={{ color:'var(--text-helper)' }}>Edges</span><strong style={{ color:'var(--teal-40)' }}>{edges.length}</strong></div>
              {Object.entries(TYPES).map(([t,c])=>(
                <div key={t} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'1px 0' }}>
                  <span style={{ color:c.color }}>{c.label}</span>
                  <span>{nodes.filter(n=>n.data?.nodeType===t).length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div ref={flowRef} style={{ position:'relative', flex:1 }} onDrop={onDrop} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';}}>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={openNode} onPaneClick={closeInsp}
            nodeTypes={nodeTypes} defaultEdgeOptions={EDGE_OPTS} fitView>
            <Background color="#333" gap={20} size={1} />
            <Controls />
            <MiniMap nodeColor={n=>TYPES[n.data?.nodeType]?.color||'#525252'} maskColor="rgba(0,0,0,0.6)" />
          </ReactFlow>

          {/* Empty state */}
          {!nodes.length && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:32, pointerEvents:'none', color:'var(--text-helper)' }}>
              <Industry size={52} style={{ opacity:0.3, marginBottom:16 }} />
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>Ontology Knowledge Graph</div>
              <p style={{ fontSize:13, maxWidth:380, marginBottom:24, lineHeight:1.6 }}>Load a 30-node mock plant or upload Excel/JSON to begin building your knowledge graph.</p>
              <div style={{ display:'flex', gap:10, pointerEvents:'all' }}>
                <button className="btn btn-primary" onClick={()=>loadMock(false)} style={{ display:'inline-flex', alignItems:'center', gap:7 }}><Layers size={15}/> Load Mock Plant</button>
                <button className="btn btn-secondary" onClick={()=>uploadRef.current?.click()} style={{ display:'inline-flex', alignItems:'center', gap:7 }}><Upload size={15}/> Upload File</button>
              </div>
            </div>
          )}

          {/* Floating Inspector */}
          {inspOpen && selNode && (
            <div style={{ position:'absolute', top:12, right:12, bottom:12, width:264, background:'var(--bg-secondary)', border:'1px solid var(--border-strong)', borderRadius:2, boxShadow:'0 8px 28px rgba(0,0,0,0.6)', zIndex:10, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-tertiary)', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <Edit size={15} style={{ color:'var(--blue-40)' }} />
                  <span style={{ fontWeight:600, fontSize:13 }}>Node Inspector</span>
                </div>
                <button onClick={closeInsp} style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', display:'flex', padding:3, borderRadius:2 }}
                  onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-hover)';e.currentTarget.style.color='var(--text-primary)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='var(--text-secondary)';}}>
                  <Close size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ flex:1, overflowY:'auto', padding:14 }}>
                {(() => {
                  const c = TYPES[selNode.data?.nodeType] || TYPES.process;
                  return <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:12, marginBottom:14, background:`${c.color}1a`, border:`1px solid ${c.color}55`, color:c.color, fontSize:12, fontWeight:600 }}><c.icon size={13}/>{c.label}</div>;
                })()}
                <div className="form-group">
                  <label className="form-label">Label</label>
                  <input className="form-input" value={selNode.data?.label||''} onChange={e=>updateNode('label',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Subtype</label>
                  <select className="form-select" value={selNode.data?.subtype||''} onChange={e=>updateNode('subtype',e.target.value)}>
                    {(SUBS[selNode.data?.nodeType]||[]).map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows={3} value={selNode.data?.description||''} onChange={e=>updateNode('description',e.target.value)} />
                </div>
                {selNode.data?.properties && Object.keys(selNode.data.properties).length > 0 && (
                  <div>
                    <div className="form-label" style={{ marginBottom:6 }}>Properties</div>
                    <div style={{ background:'var(--bg-primary)', border:'1px solid var(--border-subtle)', borderRadius:2, padding:8, fontSize:11, maxHeight:160, overflowY:'auto' }}>
                      {Object.entries(selNode.data.properties).map(([k,v])=>(
                        <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                          <span style={{ color:'var(--text-helper)' }}>{k}</span><span>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border-subtle)', flexShrink:0 }}>
                <button className="btn btn-secondary btn-sm" onClick={deleteNode}
                  style={{ width:'100%', justifyContent:'center', display:'flex', alignItems:'center', gap:6, color:'var(--support-error)', borderColor:'var(--support-error)' }}>
                  <TrashCan size={13}/> Delete Node
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
