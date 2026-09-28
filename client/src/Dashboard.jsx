import { useState, useEffect, useRef } from 'react';
import { getDashboard, uploadExcelData, resetDemoData } from './api';
import { io } from 'socket.io-client';
import {
  Upload, Reset, CheckmarkFilled, WarningFilled,
  Activity, MeterAlt, Flash, Time, Tools, Network_4,
  ArrowUpRight, ArrowDownRight, Document,
} from '@carbon/icons-react';

const socket = io('http://localhost:5000');

// Carbon tile style — flat, no gradient, 1px border
const tile = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 0,
  padding: 16,
};

const sectionLabel = {
  fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.8px', color: 'var(--text-helper)',
  marginBottom: 8,
};

export default function Dashboard({ user }) {
  const [data, setData]         = useState(null);
  const [sensors, setSensors]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast]       = useState(null);
  const fileRef = useRef(null);

  const fetchData = () => {
    getDashboard()
      .then(r => { setData(r.data.data); setSensors(r.data.data?.sensorSummary || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    socket.on('sensor:live', d => d.sensors?.length && setSensors(d.sensors));
    socket.on('dashboard:updated', fetchData);
    return () => { socket.off('sensor:live'); socket.off('dashboard:updated'); };
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    setToast(null);
    try {
      const res = await uploadExcelData(fd);
      setToast({ ok: true, msg: res.data.message || 'Imported successfully.' });
      fetchData();
    } catch (err) {
      setToast({ ok: false, msg: err.response?.data?.message || 'Upload failed.' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetDemoData();
      setToast({ ok: true, msg: 'Restored default demo dataset.' });
      fetchData();
    } catch { setToast({ ok: false, msg: 'Reset failed.' }); setLoading(false); }
  };

  if (loading && !data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12, color:'var(--text-secondary)' }}>
      <div className="spinner" /> Loading dashboard…
    </div>
  );

  const kpis = data?.kpis || {};
  const trends = kpis.trends || {};
  const prodTrend = data?.productionTrend || [];
  const procs = data?.processBreakdown || [];
  const dsInfo = data?.datasetInfo || {};
  const maxOut = Math.max(...prodTrend.map(d => d.output || 0), 1);

  const KPI_DEFS = [
    { key:'oee',                  label:'OEE',            unit:'%',   icon:MeterAlt,       accentColor:'#78a9ff' },
    { key:'productionEfficiency', label:'Prod. Efficiency',unit:'%',  icon:Activity,       accentColor:'#3ddbd9' },
    { key:'qualityRate',          label:'Quality Rate',   unit:'%',   icon:CheckmarkFilled,accentColor:'#42be65' },
    { key:'energyConsumption',    label:'Power Load',     unit:'kW',  icon:Flash,          accentColor:'#f1c21b' },
    { key:'mtbf',                 label:'MTBF',           unit:'hrs', icon:Time,           accentColor:'#be95ff' },
    { key:'mttr',                 label:'MTTR',           unit:'hrs', icon:Tools,          accentColor:'#78a9ff' },
    { key:'activeAlerts',         label:'Active Alerts',  unit:'',    icon:WarningFilled,  accentColor: kpis.criticalAlerts > 0 ? '#fa4d56' : '#3ddbd9' },
    { key:'ontologyNodes',        label:'Twin Nodes',     unit:'',    icon:Network_4,      accentColor:'#3ddbd9' },
  ];

  return (
    <div>
      {/* ── Carbon Page Header ── */}
      <div style={{ padding:'16px 32px', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <div>
          <p style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-helper)', marginBottom:4 }}>SmartFactory</p>
          <h1 style={{ fontSize:20, fontWeight:400, color:'var(--text-primary)' }}>Dashboard</h1>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="file" ref={fileRef} onChange={handleUpload} accept=".xlsx,.xls,.csv" style={{ display:'none' }} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ display:'inline-flex', alignItems:'center', gap:6, borderRadius:0 }}>
            {uploading ? <><span className="spinner" style={{width:12,height:12}}/> Importing…</> : <><Upload size={14}/> Import Excel</>}
          </button>
          {dsInfo.isCustom && (
            <button className="btn btn-secondary btn-sm" onClick={handleReset}
              style={{ display:'inline-flex', alignItems:'center', gap:6, borderRadius:0 }}>
              <Reset size={14}/> Reset Demo
            </button>
          )}
        </div>
      </div>

      <div style={{ padding:'0 32px 32px' }}>

        {/* Toast */}
        {toast && (
          <div style={{
            padding:'12px 16px', borderLeft:`3px solid ${toast.ok?'var(--support-success)':'var(--support-error)'}`,
            background:'var(--bg-secondary)', borderTop:'1px solid var(--border-subtle)',
            borderRight:'1px solid var(--border-subtle)', borderBottom:'1px solid var(--border-subtle)',
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
            fontSize:13, color: toast.ok?'var(--support-success)':'var(--support-error)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {toast.ok ? <CheckmarkFilled size={16}/> : <WarningFilled size={16}/>}
              <span>{toast.msg}</span>
            </div>
            <button onClick={() => setToast(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', fontSize:18, lineHeight:1 }}>×</button>
          </div>
        )}

        {/* Dataset info bar */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 16px', background:'var(--bg-secondary)', borderBottom:'1px solid var(--border-subtle)', borderLeft:'2px solid var(--blue-60)', fontSize:12, color:'var(--text-secondary)' }}>
          <Document size={14} style={{ color:'var(--blue-40)' }}/>
          <span style={{ color:'var(--text-helper)' }}>Active dataset:</span>
          <span style={{ fontFamily:'IBM Plex Mono,monospace', color:'var(--text-primary)' }}>{dsInfo.fileName || 'sample_manufacturing_data.xlsx'}</span>
          <span style={{ background:dsInfo.isCustom?'rgba(66,190,101,0.15)':'rgba(15,98,254,0.15)', color:dsInfo.isCustom?'var(--support-success)':'var(--blue-40)', padding:'1px 6px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>
            {dsInfo.isCustom ? 'Custom' : 'Demo'}
          </span>
        </div>

        {/* ── KPI Row — 8 Carbon tiles ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', marginTop:0 }}>
          {KPI_DEFS.map((k, i) => {
            const val = kpis[k.key];
            const rawTrend = k.key === 'activeAlerts' ? `${kpis.criticalAlerts||0} critical` : k.key === 'ontologyNodes' ? `${kpis.ontologyEdges||0} links` : trends[k.key] || '';
            const isUp   = rawTrend.includes('↑') || rawTrend.includes('+');
            const isDown = rawTrend.includes('↓') || rawTrend.includes('-');
            return (
              <div key={k.key} style={{
                ...tile,
                borderRight: i % 4 < 3 ? 'none' : '1px solid var(--border-subtle)',
                borderTop: i < 4 ? 'none' : '1px solid var(--border-subtle)',
                position:'relative', overflow:'hidden',
              }}>
                {/* Left colour accent */}
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:k.accentColor }} />
                <div style={{ paddingLeft:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <span style={sectionLabel}>{k.label}</span>
                    <k.icon size={16} style={{ color:k.accentColor, opacity:0.8 }} />
                  </div>
                  <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:28, fontWeight:400, color:'var(--text-primary)', lineHeight:1, marginBottom:8 }}>
                    {val ?? '—'}<span style={{ fontSize:14, fontWeight:300, color:'var(--text-helper)', marginLeft:4 }}>{k.unit}</span>
                  </div>
                  {rawTrend && (
                    <div style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color: isDown?'var(--support-error)':isUp?'var(--support-success)':'var(--text-helper)' }}>
                      {isUp && <ArrowUpRight size={11}/>}{isDown && <ArrowDownRight size={11}/>}
                      {rawTrend}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 2-col grid ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:0, marginTop:32 }}>

          {/* Production Chart */}
          <div style={{ ...tile, marginRight:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, paddingBottom:12, borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={sectionLabel}>Production Output vs Target</span>
              <div style={{ display:'flex', gap:16, fontSize:11 }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8,height:8,background:'var(--blue-60)',display:'inline-block' }}/> Output</span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8,height:8,background:'var(--support-error)',display:'inline-block' }}/> Defects</span>
              </div>
            </div>
            {prodTrend.length === 0 ? (
              <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-helper)', fontSize:13 }}>Upload an Excel file with a production trend sheet</div>
            ) : (
              <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:200, padding:'0 0 8px' }}>
                {prodTrend.map(d => (
                  <div key={d.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, height:'100%', justifyContent:'flex-end' }}>
                    <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', flex:1 }}>
                      <div style={{ flex:1, background:'var(--blue-60)', height:`${Math.min(100,(d.output||0)/maxOut*100)}%`, minHeight:2, transition:'height 0.6s ease' }} title={`Output: ${d.output}`}/>
                      <div style={{ flex:1, background:'var(--support-error)', height:`${Math.min(100,(d.defects||0)/maxOut*100)}%`, minHeight:2, opacity:0.7 }} title={`Defects: ${d.defects}`}/>
                    </div>
                    <span style={{ fontSize:10, color:'var(--text-helper)', whiteSpace:'nowrap' }}>{d.day}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Sensors */}
          <div style={{ ...tile, borderLeft:'none' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, paddingBottom:12, borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={sectionLabel}>Plant Telemetry</span>
              <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', background:'rgba(61,219,217,0.1)', border:'1px solid rgba(61,219,217,0.4)', fontSize:10, fontWeight:600, color:'var(--teal-40)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                <Activity size={10}/> Live
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {sensors.length > 0 ? sensors.map(s => {
                const unit = s.unit?.trim() === 'C' ? '°C' : s.unit || '';
                const c = s.status==='critical'?'var(--support-error)':s.status==='warning'?'var(--support-warning)':'var(--support-success)';
                return (
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:c, boxShadow:`0 0 6px ${c}`, flexShrink:0,
                      animation: s.status !== 'normal' ? 'pulse 1.2s infinite' : 'none' }} />
                    <span style={{ flex:1, fontSize:13, color:'var(--text-primary)' }}>{s.label||s.id}</span>
                    <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:15, fontWeight:400, color:'var(--text-primary)' }}>{s.value}</span>
                    <span style={{ fontSize:11, color:'var(--text-helper)', minWidth:28 }}>{unit}</span>
                  </div>
                );
              }) : <div style={{ color:'var(--text-helper)', fontSize:13, padding:'16px 0' }}>No sensors in current dataset</div>}
            </div>
          </div>
        </div>

        {/* Process Breakdown */}
        {procs.length > 0 && (
          <div style={{ ...tile, marginTop:1, borderTop:'none' }}>
            <div style={{ marginBottom:16, paddingBottom:12, borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={sectionLabel}>Process Efficiency</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:1 }}>
              {procs.map(p => {
                const eff = p.efficiency || 0;
                const barColor = eff >= 88 ? 'var(--support-success)' : eff >= 75 ? 'var(--blue-60)' : 'var(--support-warning)';
                return (
                  <div key={p.name} style={{ background:'var(--bg-primary)', border:'1px solid var(--border-subtle)', padding:'12px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{p.name}</span>
                      <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:13, color:barColor, fontWeight:600 }}>{eff}%</span>
                    </div>
                    <div style={{ height:4, background:'var(--bg-tertiary)', marginBottom:10 }}>
                      <div style={{ height:'100%', width:`${Math.min(100,eff)}%`, background:barColor, transition:'width 0.8s ease' }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-helper)' }}>
                      <span>Cycle: <strong style={{ color:'var(--text-secondary)' }}>{p.cycleTimeSec||30}s</strong></span>
                      {p.alerts > 0
                        ? <span style={{ color:'var(--support-warning)', display:'inline-flex', alignItems:'center', gap:3 }}><WarningFilled size={10}/> {p.alerts} alert{p.alerts>1?'s':''}</span>
                        : <span style={{ color:'var(--support-success)' }}>Nominal</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
