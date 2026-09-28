import { useState, useEffect } from 'react';
import { getDashboard, getOntology } from './api';
import { MachineLearningModel } from '@carbon/icons-react';

export default function Analytics() {
  const [data, setData]       = useState(null);
  const [ontology, setOntology] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboard(), getOntology()])
      .then(([d, o]) => { setData(d.data.data); setOntology(o.data.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
      <div className="spinner" /><span className="text-secondary">Loading analytics…</span>
    </div>
  );

  const kpis = data?.kpis || {};
  const nodes = ontology?.nodes || [];
  const edges = ontology?.edges || [];
  const processNodes    = nodes.filter(n => n.type === 'process');
  const sensorNodes     = nodes.filter(n => n.type === 'sensor');
  const workerNodes     = nodes.filter(n => n.type === 'worker');
  const materialNodes   = nodes.filter(n => n.type === 'material');
  const productNodes    = nodes.filter(n => n.type === 'product');
  const deptNodes       = nodes.filter(n => n.type === 'department');

  const nodeTypeStats = [
    { label: 'Processes', count: processNodes.length, color: 'var(--node-process)' },
    { label: 'Sensors',   count: sensorNodes.length,   color: 'var(--node-sensor)' },
    { label: 'Workers',   count: workerNodes.length,   color: 'var(--node-worker)' },
    { label: 'Materials', count: materialNodes.length, color: 'var(--node-material)' },
    { label: 'Products',  count: productNodes.length,  color: 'var(--node-product)' },
    { label: 'Depts',     count: deptNodes.length,     color: 'var(--node-department)' },
  ];

  const total = nodeTypeStats.reduce((a, b) => a + b.count, 0) || 1;

  // Simulate predictive maintenance scores per process
  const processHealth = processNodes.map(n => ({
    name: n.data?.label,
    health: Math.round(60 + Math.random() * 35),
    maintenance: Math.round(10 + Math.random() * 60),
    risk: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
  }));

  // Relationship analysis
  const relCounts = {};
  edges.forEach(e => {
    const rel = e.relationship || e.data?.relationship || 'custom';
    relCounts[rel] = (relCounts[rel] || 0) + 1;
  });

  return (
    <div>
      <div className="page-header">
        <h1>Analytics & Predictions</h1>
        <p>AI-driven insights derived from your manufacturing ontology</p>
      </div>
      <div className="page-body">

        {/* KPI Overview */}
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'OEE Score',    value: kpis.oee,                  unit: '%', color: 'blue' },
            { label: 'Quality Rate', value: kpis.qualityRate,           unit: '%', color: 'green' },
            { label: 'MTBF',         value: kpis.mtbf,                  unit: 'hrs', color: 'teal' },
            { label: 'MTTR',         value: kpis.mttr,                  unit: 'hrs', color: 'yellow' },
            { label: 'Energy (kWh)', value: kpis.energyConsumption,     unit: '', color: 'purple' },
            { label: 'Efficiency',   value: kpis.productionEfficiency,  unit: '%', color: 'blue' },
          ].map(k => (
            <div key={k.label} className={`kpi-tile ${k.color}`}>
              <div className="kpi-label">{k.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span className="kpi-value">{k.value ?? '—'}</span>
                {k.unit && <span className="kpi-unit">{k.unit}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="analytics-grid">
          {/* Ontology Composition */}
          <div className="card">
            <div className="card-header"><span className="card-title">Ontology Composition</span></div>
            {total === 1 && nodes.length === 0 ? (
              <div className="text-secondary text-sm">No digital twin built yet. Go to Digital Twin Studio.</div>
            ) : (
              <>
                {nodeTypeStats.map(s => (
                  <div key={s.label} className="progress-bar-wrap">
                    <div className="progress-bar-label">
                      <span style={{ color: s.color }}>{s.label}</span>
                      <span className="font-mono">{s.count}</span>
                    </div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${(s.count / total) * 100}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
                <div className="mt-16 text-xs text-muted">
                  Total: {nodes.length} nodes · {edges.length} relationships
                </div>
              </>
            )}
          </div>

          {/* Relationship Analysis */}
          <div className="card">
            <div className="card-header"><span className="card-title">Relationship Types</span></div>
            {Object.keys(relCounts).length === 0 ? (
              <div className="text-secondary text-sm">Draw edges in Digital Twin Studio to see relationships.</div>
            ) : (
              Object.entries(relCounts).map(([rel, count]) => (
                <div key={rel} className="progress-bar-wrap">
                  <div className="progress-bar-label">
                    <span>{rel.replace(/_/g, ' ')}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${(count / edges.length) * 100}%`, background: 'var(--blue-60)' }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Predictive Maintenance */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MachineLearningModel size={18} /> Predictive Maintenance (AI)
              </span>
              <span className="text-xs text-muted">Based on ontology process nodes · Simulated ML scores</span>
            </div>
            {processHealth.length === 0 ? (
              <div className="text-secondary text-sm">Add Process nodes to your ontology to see predictions.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {processHealth.map(p => (
                  <div key={p.name} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', padding: 16, borderRadius: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</span>
                      <span className={`badge ${p.risk === 'high' ? 'active' : p.risk === 'medium' ? 'acknowledged' : 'resolved'}`}>
                        {p.risk} risk
                      </span>
                    </div>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar-label"><span className="text-xs text-muted">Health Score</span><span className="font-mono">{p.health}%</span></div>
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${p.health}%`, background: p.health > 80 ? 'var(--support-success)' : p.health > 60 ? 'var(--support-warning)' : 'var(--support-error)' }} />
                      </div>
                    </div>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar-label"><span className="text-xs text-muted">Maintenance Urgency</span><span className="font-mono">{p.maintenance}%</span></div>
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${p.maintenance}%`, background: 'var(--blue-60)' }} />
                      </div>
                    </div>
                    <div className="text-xs text-muted mt-8">
                      Est. failure in {Math.round((100 - p.maintenance) * 2.5)}h
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
