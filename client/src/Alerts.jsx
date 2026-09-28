import { useState, useEffect } from 'react';
import { getAlerts, acknowledgeAlert, resolveAlert } from './api';
import { io } from 'socket.io-client';
import {
  ErrorFilled,
  WarningFilled,
  InformationFilled,
  CheckmarkFilled,
  Information,
  Renew,
  Idea,
  Location,
  Bot,
} from '@carbon/icons-react';

const socket = io('http://localhost:5000');

function SeverityIcon({ severity }) {
  const size = 18;
  switch (severity) {
    case 'critical':
      return <ErrorFilled size={size} style={{ color: 'var(--support-error)' }} />;
    case 'high':
      return <WarningFilled size={size} style={{ color: 'var(--support-warning)' }} />;
    case 'medium':
      return <InformationFilled size={size} style={{ color: 'var(--blue-40)' }} />;
    case 'low':
      return <CheckmarkFilled size={size} style={{ color: 'var(--support-success)' }} />;
    case 'info':
    default:
      return <Information size={size} style={{ color: 'var(--text-secondary)' }} />;
  }
}

const CATEGORY_LABELS = {
  predictive_maintenance: 'Predictive Maintenance',
  quality:    'Quality',
  safety:     'Safety',
  production: 'Production',
  sensor:     'Sensor',
  supply_chain: 'Supply Chain',
};

export default function Alerts() {
  const [alerts, setAlerts]     = useState([]);
  const [filter, setFilter]     = useState({ status: '', severity: '' });
  const [loading, setLoading]   = useState(true);

  const fetchAlerts = () => {
    const params = {};
    if (filter.status)   params.status   = filter.status;
    if (filter.severity) params.severity = filter.severity;
    getAlerts(params).then(r => { setAlerts(r.data.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchAlerts(); }, [filter]);

  useEffect(() => {
    socket.on('alert:updated', updated => {
      setAlerts(as => as.map(a => a._id === updated._id ? updated : a));
    });
    socket.on('ontology:updated', () => fetchAlerts());
    return () => { socket.off('alert:updated'); socket.off('ontology:updated'); };
  }, []);

  const handleAck = async id => {
    await acknowledgeAlert(id);
    fetchAlerts();
  };
  const handleResolve = async id => {
    await resolveAlert(id);
    fetchAlerts();
  };

  const counts = {
    active:       alerts.filter(a => a.status === 'active').length,
    critical:     alerts.filter(a => a.severity === 'critical').length,
    acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
    resolved:     alerts.filter(a => a.status === 'resolved').length,
  };

  return (
    <div>
      <div className="page-header">
        <h1>Intelligent Alerts</h1>
        <p>AI-generated alerts from ontology analysis and sensor anomaly detection</p>
      </div>
      <div className="page-body">

        {/* Summary Tiles */}
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'Active Alerts',       value: counts.active,       color: 'red' },
            { label: 'Critical',            value: counts.critical,     color: 'red' },
            { label: 'Acknowledged',        value: counts.acknowledged, color: 'yellow' },
            { label: 'Resolved Today',      value: counts.resolved,     color: 'green' },
          ].map(k => (
            <div key={k.label} className={`kpi-tile ${k.color}`}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-12 mb-16" style={{ marginBottom: 16 }}>
          <select className="form-select" style={{ width: 'auto' }}
            value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <select className="form-select" style={{ width: 'auto' }}
            value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}>
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={fetchAlerts} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Renew size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex gap-12 items-center"><div className="spinner" /><span className="text-secondary">Loading alerts…</span></div>
        ) : alerts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <CheckmarkFilled size={36} style={{ color: 'var(--support-success)', marginBottom: 12 }} />
            <div style={{ color: 'var(--support-success)', fontSize: 16, marginBottom: 8 }}>No alerts found</div>
            <div className="text-secondary text-sm">Build and save an ontology to start receiving AI-generated alerts</div>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map(a => (
              <div key={a._id} className={`alert-card ${a.severity}`}>
                <div className={`alert-icon ${a.severity}`}>
                  <SeverityIcon severity={a.severity} />
                </div>
                <div className="alert-content">
                  <div className="alert-title">{a.title}</div>
                  <div className="alert-message">{a.message}</div>
                  {a.recommendation && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--teal-40)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Idea size={14} />
                      <span>{a.recommendation}</span>
                    </div>
                  )}
                  <div className="alert-meta">
                    <span className="alert-tag">{CATEGORY_LABELS[a.category] || a.category}</span>
                    {a.source?.nodeLabel && (
                      <span className="alert-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Location size={12} /> {a.source.nodeLabel}
                      </span>
                    )}
                    <span className="alert-tag">{new Date(a.createdAt).toLocaleString()}</span>
                    <div className="alert-confidence" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Bot size={14} />
                      <span>AI Confidence: {a.aiConfidence}%</span>
                    </div>
                    <span className={`badge ${a.status}`} style={{ textTransform: 'capitalize' }}>{a.status}</span>
                  </div>
                </div>
                {a.status === 'active' && (
                  <div className="alert-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => handleAck(a._id)}>Acknowledge</button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleResolve(a._id)}>Resolve</button>
                  </div>
                )}
                {a.status === 'acknowledged' && (
                  <div className="alert-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleResolve(a._id)}>Resolve</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
