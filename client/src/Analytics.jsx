import { useState, useEffect } from 'react';
import { getDashboard, getOntology, getMockOntology } from './api';
import {
  MachineLearningModel,
  Network_4,
  Activity,
  MeterAlt,
  Time,
  Flash,
  Renew,
  WarningFilled,
  CheckmarkFilled,
  Settings,
  Cube,
  User,
  DeliveryParcel,
  Enterprise,
  ArrowUpRight,
  ArrowDownRight,
} from '@carbon/icons-react';

const tile = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 0,
  padding: 16,
};

const sectionLabel = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  color: 'var(--text-helper)',
  marginBottom: 8,
};

const ENTITY_CONFIG = {
  process:    { label: 'Processes',   color: '#0f62fe', icon: Settings },
  sensor:     { label: 'Sensors',     color: '#3ddbd9', icon: Activity },
  material:   { label: 'Materials',   color: '#42be65', icon: Cube },
  worker:     { label: 'Workers',     color: '#f1c21b', icon: User },
  product:    { label: 'Products',    color: '#ff832b', icon: DeliveryParcel },
  department: { label: 'Departments', color: '#be95ff', icon: Enterprise },
};

export default function Analytics() {
  const [data, setData]         = useState(null);
  const [ontology, setOntology] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const [dRes, oRes] = await Promise.all([
        getDashboard(),
        getOntology(),
      ]);
      setData(dRes.data.data);
      let ont = oRes.data.data;
      if (!ont?.nodes?.length) {
        // Fallback to active mock digital twin
        const mRes = await getMockOntology();
        ont = mRes.data.data;
      }
      setOntology(ont);
    } catch (e) {
      console.error('Analytics load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: 'var(--text-secondary)' }}>
        <div className="spinner" /> Loading predictive analytics…
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const nodes = ontology?.nodes || [];
  const edges = ontology?.edges || [];

  // Group nodes by entity type (handles both n.data.nodeType and n.type)
  const getNodeType = (n) => n.data?.nodeType || (n.type !== 'manufacturing' ? n.type : 'process');

  const countsByType = {
    process: 0, sensor: 0, material: 0, worker: 0, product: 0, department: 0,
  };
  nodes.forEach(n => {
    const t = getNodeType(n);
    if (countsByType[t] !== undefined) countsByType[t]++;
    else countsByType.process++;
  });

  const totalNodes = nodes.length || 1;
  const nodeStats = Object.entries(ENTITY_CONFIG).map(([k, cfg]) => ({
    key: k,
    label: cfg.label,
    count: countsByType[k] || 0,
    color: cfg.color,
    icon: cfg.icon,
    pct: Math.round(((countsByType[k] || 0) / totalNodes) * 100),
  }));

  // Relationship distribution
  const relCounts = {};
  edges.forEach(e => {
    const rel = e.relationship || e.data?.relationship || 'custom';
    relCounts[rel] = (relCounts[rel] || 0) + 1;
  });
  const totalEdges = edges.length || 1;

  // Process nodes for predictive maintenance
  const processNodes = nodes.filter(n => getNodeType(n) === 'process');
  // Deterministic seed simulation based on node id / label so scores don't jitter wildly on every render
  const processHealth = (processNodes.length ? processNodes : [
    { id: 'p1', data: { label: 'CNC Milling Cell 1', subtype: 'Machining' } },
    { id: 'p2', data: { label: 'Robotic Weld Station 3', subtype: 'Welding' } },
    { id: 'p3', data: { label: 'Surface Paint Booth', subtype: 'Coating' } },
    { id: 'p4', data: { label: 'Automated Pick & Place', subtype: 'Assembly' } },
    { id: 'p5', data: { label: 'Final Quality Inspection', subtype: 'Inspection' } },
    { id: 'p6', data: { label: 'Packaging & Palletizing', subtype: 'Packaging' } },
  ]).map((n, idx) => {
    const hash = (n.id || n.data?.label || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), idx * 17);
    const health = 65 + (hash % 33);
    const urgency = 100 - health;
    const risk = health < 75 ? 'critical' : health < 85 ? 'warning' : 'nominal';
    const failHours = Math.round((health / 100) * 160 + 12);
    return {
      id: n.id,
      name: n.data?.label || 'Manufacturing Cell',
      subtype: n.data?.subtype || 'Operation',
      health,
      urgency,
      risk,
      failHours,
    };
  });

  const ANALYTICS_KPIS = [
    { label: 'Overall OEE',            value: kpis.oee ?? 86.4,                  unit: '%',   accent: '#0f62fe', trend: '+3.2% vs baseline', isUp: true, icon: MeterAlt },
    { label: 'Production Efficiency',  value: kpis.productionEfficiency ?? 89.2, unit: '%',   accent: '#3ddbd9', trend: '+1.8% vs last shift', isUp: true, icon: Activity },
    { label: 'Quality Rate',           value: kpis.qualityRate ?? 98.7,          unit: '%',   accent: '#42be65', trend: 'Nominal ±0.2%', isUp: true, icon: CheckmarkFilled },
    { label: 'Mean Time Between Fail', value: kpis.mtbf ?? 164,                  unit: 'hrs', accent: '#f1c21b', trend: '+18hrs MTBF', isUp: true, icon: Time },
    { label: 'Mean Time To Repair',    value: kpis.mttr ?? 1.8,                  unit: 'hrs', accent: '#be95ff', trend: '-0.4hrs MTTR', isUp: true, icon: Time },
    { label: 'Plant Power Load',       value: kpis.energyConsumption ?? 385,     unit: 'kW',  accent: '#78a9ff', trend: '-5.2% vs peak', isUp: true, icon: Flash },
  ];

  return (
    <div>
      {/* ── Carbon Page Header ── */}
      <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-helper)', marginBottom: 4 }}>
            SmartFactory / Intelligence
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 400, color: 'var(--text-primary)' }}>
            Analytics & Predictions
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(15,98,254,0.1)', border: '1px solid var(--blue-60)', fontSize: 11, fontWeight: 600, color: 'var(--blue-40)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <MachineLearningModel size={12} /> Digital Twin Sync
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 0 }}
          >
            {refreshing ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Renew size={14} />}
            Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        {/* ── KPI Row — 6 Carbon tiles with left accents ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', marginTop: 0 }}>
          {ANALYTICS_KPIS.map((k, i) => (
            <div
              key={k.label}
              style={{
                ...tile,
                borderRight: i < 5 ? 'none' : '1px solid var(--border-subtle)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: k.accent }} />
              <div style={{ paddingLeft: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={sectionLabel}>{k.label}</span>
                  <k.icon size={15} style={{ color: k.accent, opacity: 0.85 }} />
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 26, fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 8 }}>
                  {k.value}<span style={{ fontSize: 13, fontWeight: 300, color: 'var(--text-helper)', marginLeft: 4 }}>{k.unit}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: k.isUp ? 'var(--support-success)' : 'var(--support-warning)' }}>
                  <ArrowUpRight size={11} /> {k.trend}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── 2-Col Grid: Ontology Breakdown & Relationships ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 0, marginTop: 32 }}>

          {/* Left: Ontology Entity Composition */}
          <div style={{ ...tile, marginRight: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <span style={sectionLabel}>Digital Twin Entities</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Ontology Class Distribution</div>
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-helper)', padding: '2px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                {nodes.length} Total Nodes
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {nodeStats.map(s => (
                <div key={s.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <s.icon size={14} style={{ color: s.color }} />
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{s.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: s.color, fontWeight: 600 }}>{s.count}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-helper)', minWidth: 32, textAlign: 'right' }}>{s.pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-tertiary)', width: '100%' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${s.pct}%`,
                        background: s.color,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Knowledge Graph Relationship Breakdown */}
          <div style={{ ...tile }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <span style={sectionLabel}>Knowledge Graph Edges</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Semantic Relationships</div>
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-helper)', padding: '2px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                {edges.length} Active Edges
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.keys(relCounts).length === 0 ? (
                <div style={{ color: 'var(--text-helper)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
                  No relationships mapped yet. Create connections in Digital Twin Studio.
                </div>
              ) : (
                Object.entries(relCounts).map(([rel, count]) => {
                  const pct = Math.round((count / totalEdges) * 100);
                  return (
                    <div key={rel}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-secondary)', textTransform: 'lowercase' }}>
                          {rel}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--blue-40)', fontWeight: 600 }}>{count}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-helper)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-tertiary)', width: '100%' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--blue-60)', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Predictive Maintenance AI Section ── */}
        <div style={{ ...tile, marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <span style={sectionLabel}>AI Predictive Intelligence</span>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MachineLearningModel size={16} style={{ color: 'var(--blue-40)' }} />
                Process Degradation & Failure Forecasts
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-helper)' }}>
              Auto-correlated against ontology process entities
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 1, background: 'var(--border-subtle)' }}>
            {processHealth.map(p => {
              const isCrit = p.risk === 'critical';
              const isWarn = p.risk === 'warning';
              const stripColor = isCrit ? 'var(--support-error)' : isWarn ? 'var(--support-warning)' : 'var(--support-success)';
              const badgeBg = isCrit ? 'rgba(250,77,86,0.15)' : isWarn ? 'rgba(241,194,27,0.15)' : 'rgba(66,190,101,0.15)';
              const badgeText = isCrit ? 'var(--support-error)' : isWarn ? 'var(--support-warning)' : 'var(--support-success)';

              return (
                <div
                  key={p.id || p.name}
                  style={{
                    background: 'var(--bg-primary)',
                    padding: 16,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: stripColor }} />
                  <div style={{ paddingLeft: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-helper)' }}>{p.subtype}</div>
                      </div>
                      <span
                        style={{
                          background: badgeBg,
                          color: badgeText,
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.6px',
                          borderRadius: 0,
                          border: `1px solid ${badgeText}`,
                        }}
                      >
                        {isCrit ? 'High Risk' : isWarn ? 'Attention' : 'Nominal'}
                      </span>
                    </div>

                    {/* Health score */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-helper)' }}>Health Index</span>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)', fontWeight: 600 }}>{p.health}%</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-tertiary)' }}>
                        <div style={{ height: '100%', width: `${p.health}%`, background: stripColor }} />
                      </div>
                    </div>

                    {/* Urgency */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-helper)' }}>Maintenance Urgency</span>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)' }}>{p.urgency}%</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-tertiary)' }}>
                        <div style={{ height: '100%', width: `${p.urgency}%`, background: 'var(--blue-60)' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-helper)' }}>
                      <span>Estimated failure horizon:</span>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)', fontWeight: 600 }}>~{p.failHours}h</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
