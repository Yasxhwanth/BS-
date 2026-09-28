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
  Filter,
} from '@carbon/icons-react';

const socket = io('http://localhost:5000');

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

function SeverityIcon({ severity }) {
  const size = 16;
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
      return <Information size={size} style={{ color: 'var(--text-helper)' }} />;
  }
}

const CATEGORY_LABELS = {
  predictive_maintenance: 'Predictive Maint.',
  quality:                'Quality Control',
  safety:                 'Plant Safety',
  production:             'Production Line',
  sensor:                 'Telemetry Anomaly',
  supply_chain:           'Supply Chain',
};

const SEVERITY_COLORS = {
  critical: 'var(--support-error)',
  high:     'var(--support-warning)',
  medium:   'var(--blue-40)',
  low:      'var(--support-success)',
  info:     'var(--text-helper)',
};

export default function Alerts() {
  const [alerts, setAlerts]     = useState([]);
  const [filter, setFilter]     = useState({ status: '', severity: '' });
  const [loading, setLoading]   = useState(true);

  const fetchAlerts = () => {
    const params = {};
    if (filter.status)   params.status   = filter.status;
    if (filter.severity) params.severity = filter.severity;
    getAlerts(params)
      .then(r => { setAlerts(r.data.data); setLoading(false); })
      .catch(() => setLoading(false));
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

  const ALERT_KPIS = [
    { label: 'Active Alerts',       value: counts.active,       accent: 'var(--support-error)' },
    { label: 'Critical Severity',   value: counts.critical,     accent: '#da1e28' },
    { label: 'Acknowledged',        value: counts.acknowledged, accent: 'var(--support-warning)' },
    { label: 'Resolved',            value: counts.resolved,     accent: 'var(--support-success)' },
  ];

  return (
    <div>
      {/* ── Carbon Page Header ── */}
      <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-helper)', marginBottom: 4 }}>
            SmartFactory / Operations
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 400, color: 'var(--text-primary)' }}>
            Plant Alerts & Incident Feed
          </h1>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={fetchAlerts}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 0 }}
        >
          <Renew size={14} /> Refresh Feed
        </button>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        {/* ── Carbon KPI Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 0 }}>
          {ALERT_KPIS.map((k, i) => (
            <div
              key={k.label}
              style={{
                ...tile,
                borderRight: i < 3 ? 'none' : '1px solid var(--border-subtle)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: k.accent }} />
              <div style={{ paddingLeft: 10 }}>
                <div style={sectionLabel}>{k.label}</div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 28, fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {k.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter Bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderTop: 'none', marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-helper)' }}>
            <Filter size={13} /> Filters:
          </div>
          <select
            className="form-select"
            style={{ width: 'auto', borderRadius: 0, fontSize: 12, height: 32 }}
            value={filter.status}
            onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            className="form-select"
            style={{ width: 'auto', borderRadius: 0, fontSize: 12, height: 32 }}
            value={filter.severity}
            onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh', gap: 12, color: 'var(--text-secondary)' }}>
            <div className="spinner" /> Loading alerts…
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ ...tile, textAlign: 'center', padding: '48px 24px' }}>
            <CheckmarkFilled size={36} style={{ color: 'var(--support-success)', marginBottom: 12 }} />
            <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>All Systems Nominal</div>
            <div style={{ color: 'var(--text-helper)', fontSize: 13 }}>No matching plant alerts found for current filter criteria.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map(a => {
              const borderLeftColor = SEVERITY_COLORS[a.severity] || 'var(--blue-40)';
              return (
                <div
                  key={a._id}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `4px solid ${borderLeftColor}`,
                    borderRadius: 0,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, flex: 1 }}>
                    <div style={{ marginTop: 2 }}>
                      <SeverityIcon severity={a.severity} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            padding: '1px 6px',
                            borderRadius: 0,
                            border: `1px solid ${borderLeftColor}`,
                            color: borderLeftColor,
                            background: 'transparent',
                          }}
                        >
                          {a.severity}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 0,
                            background: a.status === 'resolved' ? 'rgba(66,190,101,0.15)' : a.status === 'acknowledged' ? 'rgba(241,194,27,0.15)' : 'rgba(250,77,86,0.15)',
                            color: a.status === 'resolved' ? 'var(--support-success)' : a.status === 'acknowledged' ? 'var(--support-warning)' : 'var(--support-error)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {a.status}
                        </span>
                      </div>

                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                        {a.message}
                      </div>

                      {a.recommendation && (
                        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--teal-40)', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(61,219,217,0.08)', padding: '4px 10px', border: '1px solid rgba(61,219,217,0.25)' }}>
                          <Idea size={13} />
                          <span>Recommendation: {a.recommendation}</span>
                        </div>
                      )}

                      {/* Carbon Meta Tags */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-helper)' }}>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                          {CATEGORY_LABELS[a.category] || a.category}
                        </span>
                        {a.source?.nodeLabel && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--blue-40)' }}>
                            <Location size={12} /> {a.source.nodeLabel}
                          </span>
                        )}
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--teal-40)' }}>
                          <Bot size={13} />
                          <span>Confidence: {a.aiConfidence}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {a.status === 'active' && (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleAck(a._id)}
                          style={{ borderRadius: 0 }}
                        >
                          Acknowledge
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleResolve(a._id)}
                          style={{ borderRadius: 0 }}
                        >
                          Resolve
                        </button>
                      </>
                    )}
                    {a.status === 'acknowledged' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleResolve(a._id)}
                        style={{ borderRadius: 0 }}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
