import { useState, useEffect, useRef } from 'react';
import { getDashboard, uploadExcelData, resetDemoData } from './api';
import { io } from 'socket.io-client';
import {
  Upload,
  Download,
  Document,
  Reset,
  CheckmarkFilled,
  WarningFilled,
  Activity,
} from '@carbon/icons-react';

const socket = io('http://localhost:5000');

export default function Dashboard({ user }) {
  const [data, setData]           = useState(null);
  const [sensors, setSensors]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast]         = useState(null);
  const fileInputRef              = useRef(null);

  const fetchDashboardData = () => {
    getDashboard()
      .then(r => {
        setData(r.data.data);
        if (r.data.data?.sensorSummary) {
          setSensors(r.data.data.sensorSummary);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();

    socket.on('sensor:live', d => {
      if (d.sensors && d.sensors.length > 0) {
        setSensors(d.sensors);
      }
    });

    socket.on('dashboard:updated', () => {
      fetchDashboardData();
    });

    return () => {
      socket.off('sensor:live');
      socket.off('dashboard:updated');
    };
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setToast(null);

    try {
      const res = await uploadExcelData(formData);
      setToast({ type: 'success', message: res.data.message || 'Dataset imported successfully!' });
      fetchDashboardData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to upload Excel file. Ensure it is a valid .xlsx file.',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetDemoData();
      setToast({ type: 'success', message: 'Restored default demo manufacturing dataset.' });
      fetchDashboardData();
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to reset demo dataset.' });
      setLoading(false);
    }
  };

  if (loading && !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
      <div className="spinner" /> <span className="text-secondary">Loading dashboard…</span>
    </div>
  );

  const kpis = data?.kpis || {};
  const trends = kpis.trends || {};
  const productionTrend = data?.productionTrend || [];
  const processBreakdown = data?.processBreakdown || [];
  const datasetInfo = data?.datasetInfo || {};
  const maxOutput = Math.max(...productionTrend.map(d => d.output || 0), 1);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Dashboard</h1>
          <p>Real-time manufacturing KPIs, telemetry, and Excel data import</p>
        </div>

        {/* Excel Actions Toolbar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
          />

          <a
            href="/sample_manufacturing_data.xlsx"
            download="sample_manufacturing_data.xlsx"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            title="Download formatted sample Excel with pre-filled sheets"
          >
            <Download size={14} /> Download Sample Excel
          </a>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {uploading ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                <span>Importing…</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>Upload Excel Data</span>
              </>
            )}
          </button>

          {datasetInfo.isCustom && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleReset}
              title="Reset to default demo dataset"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Reset size={14} /> Reset Demo
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Notification Toast */}
        {toast && (
          <div
            style={{
              padding: '10px 16px',
              marginBottom: 16,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: toast.type === 'success' ? 'rgba(66, 190, 101, 0.15)' : 'rgba(250, 77, 86, 0.15)',
              border: `1px solid ${toast.type === 'success' ? 'var(--support-success)' : 'var(--support-error)'}`,
              color: toast.type === 'success' ? 'var(--support-success)' : 'var(--support-error)',
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {toast.type === 'success' ? <CheckmarkFilled size={16} /> : <WarningFilled size={16} />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}
            >
              ×
            </button>
          </div>
        )}

        {/* Data Source Info Banner */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            padding: '10px 16px',
            marginBottom: 20,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Document size={16} style={{ color: 'var(--teal-40)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Active Dataset:</span>
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {datasetInfo.fileName || 'sample_manufacturing_data.xlsx'}
            </strong>
            <span className={`badge ${datasetInfo.isCustom ? 'active' : 'resolved'}`}>
              {datasetInfo.isCustom ? 'Uploaded File' : 'Default Demo'}
            </span>
          </div>

          <div style={{ color: 'var(--text-helper)' }}>
            Imported: {datasetInfo.importedAt ? new Date(datasetInfo.importedAt).toLocaleTimeString() : 'Initial'} · 5 sheets configured
          </div>
        </div>

        {/* KPI Tiles */}
        <div className="kpi-grid">
          {[
            { key: 'oee',                  label: 'OEE',                   value: kpis.oee,                  unit: '%',   color: 'blue'   },
            { key: 'productionEfficiency', label: 'Production Efficiency', value: kpis.productionEfficiency, unit: '%',   color: 'teal'   },
            { key: 'qualityRate',          label: 'Quality Rate',          value: kpis.qualityRate,          unit: '%',   color: 'green'  },
            { key: 'mtbf',                 label: 'MTBF',                  value: kpis.mtbf,                 unit: 'hrs', color: 'yellow' },
            { key: 'mttr',                 label: 'MTTR',                  value: kpis.mttr,                 unit: 'hrs', color: 'blue'   },
            { key: 'activeAlerts',         label: 'Active Alerts',         value: kpis.activeAlerts ?? 0,    unit: '',    color: kpis.criticalAlerts > 0 ? 'red' : 'teal' },
            { key: 'ontologyNodes',        label: 'Ontology Nodes',        value: kpis.ontologyNodes ?? 0,   unit: '',    color: 'purple' },
            { key: 'energyConsumption',    label: 'Energy (kWh)',          value: kpis.energyConsumption,    unit: '',    color: 'yellow' },
          ].map(k => {
            const trendText = trends[k.key] || (k.key === 'activeAlerts' ? `${kpis.criticalAlerts || 0} critical` : '');
            return (
              <div key={k.label} className={`kpi-tile ${k.color}`}>
                <div className="kpi-label">{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span className="kpi-value">{k.value ?? '—'}</span>
                  {k.unit && <span className="kpi-unit">{k.unit}</span>}
                </div>
                {trendText && (
                  <div className={`kpi-trend ${trendText.includes('↑') || trendText.includes('+') ? 'up' : trendText.includes('↓') || trendText.includes('-') ? 'down' : ''}`}>
                    {trendText}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Main Grid */}
        <div className="dashboard-grid">

          {/* Production Chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Production Trend (from Dataset)</span>
              <span className="text-xs text-muted">Output vs Target & Defects</span>
            </div>
            <div className="chart-legend">
              <div className="chart-legend-item">
                <div className="legend-dot" style={{ background: 'var(--blue-60)' }} /> Output
              </div>
              <div className="chart-legend-item">
                <div className="legend-dot" style={{ background: 'var(--support-error)', opacity: 0.7 }} /> Defects
              </div>
            </div>
            <div className="chart-container">
              {productionTrend.map(d => (
                <div key={d.day} className="chart-bar-group">
                  <div className="chart-bar-wrap">
                    <div
                      className="chart-bar output"
                      style={{ height: `${Math.min(100, ((d.output || 0) / maxOutput) * 100)}%` }}
                      title={`Output: ${d.output} (Target: ${d.target})`}
                    />
                    <div
                      className="chart-bar defects"
                      style={{ height: `${Math.min(100, ((d.defects || 0) / maxOutput) * 100)}%` }}
                      title={`Defects: ${d.defects}`}
                    />
                  </div>
                  <div className="chart-label">{d.day}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Sensors */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Plant Sensor Telemetry</span>
              <div className="chat-ai-badge" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Activity size={12} /> LIVE
              </div>
            </div>
            <div className="sensor-list">
              {sensors.length > 0 ? sensors.map(s => (
                <div key={s.id} className="sensor-item">
                  <div className={`sensor-dot ${s.status || 'normal'}`} />
                  <span className="sensor-name">{s.label || s.id}</span>
                  <span className="sensor-value">{s.value}</span>
                  <span className="sensor-unit">{s.unit}</span>
                </div>
              )) : (
                <div className="text-secondary text-sm">No sensors in active dataset…</div>
              )}
            </div>
          </div>

          {/* Process Breakdown */}
          <div className="card dashboard-grid-full">
            <div className="card-header">
              <span className="card-title">Process Efficiency & Bottleneck Analysis</span>
              <span className="text-xs text-muted">Extracted from {datasetInfo.fileName || 'Excel dataset'}</span>
            </div>
            {processBreakdown.length === 0 ? (
              <div className="text-secondary text-sm" style={{ padding: '12px 0' }}>
                No process breakdown found in dataset. Upload an Excel file with a Process sheet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {processBreakdown.map(p => (
                  <div key={p.name} className="progress-bar-wrap" style={{ background: 'var(--bg-primary)', padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
                    <div className="progress-bar-label" style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span className="font-mono">{p.efficiency}%</span>
                    </div>
                    <div className="progress-bar-track" style={{ marginBottom: 8 }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, p.efficiency)}%`,
                          background: p.efficiency >= 88 ? 'var(--support-success)' : p.efficiency >= 75 ? 'var(--blue-60)' : 'var(--support-warning)',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-helper)' }}>
                      <span>Cycle: {p.cycleTimeSec || 30}s</span>
                      <span className={`badge ${p.status === 'Optimal' ? 'resolved' : p.status === 'Warning' ? 'active' : 'acknowledged'}`}>
                        {p.status || 'Operating'}
                      </span>
                    </div>
                    {p.alerts > 0 && (
                      <div className="text-xs text-warning mt-8" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <WarningFilled size={12} />
                        <span>{p.alerts} active alert(s)</span>
                      </div>
                    )}
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
