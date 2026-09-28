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
  MeterAlt,
  Flash,
  Time,
  Tools,
  Network_4,
  ArrowUpRight,
  ArrowDownRight,
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
        <div className="dataset-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Document size={16} style={{ color: 'var(--teal-40)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Active Dataset:</span>
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '0.3px' }}>
              {datasetInfo.fileName || 'sample_manufacturing_data.xlsx'}
            </strong>
            <span className={`badge ${datasetInfo.isCustom ? 'active' : 'resolved'}`}>
              {datasetInfo.isCustom ? 'Uploaded File' : 'Default Demo'}
            </span>
          </div>

          <div style={{ color: 'var(--text-helper)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Imported: {datasetInfo.importedAt ? new Date(datasetInfo.importedAt).toLocaleTimeString() : 'Initial'}</span>
            <span>·</span>
            <span>5 sheets configured</span>
          </div>
        </div>

        {/* KPI Tiles — Balanced 4x2 Matrix */}
        <div className="kpi-grid">
          {[
            {
              key: 'oee',
              shortLabel: 'OEE',
              value: kpis.oee,
              unit: '%',
              color: 'blue',
              icon: MeterAlt,
            },
            {
              key: 'productionEfficiency',
              shortLabel: 'Efficiency',
              value: kpis.productionEfficiency,
              unit: '%',
              color: 'teal',
              icon: Activity,
            },
            {
              key: 'qualityRate',
              shortLabel: 'Quality Rate',
              value: kpis.qualityRate,
              unit: '%',
              color: 'green',
              icon: CheckmarkFilled,
            },
            {
              key: 'energyConsumption',
              shortLabel: 'Power Load',
              value: kpis.energyConsumption,
              unit: 'kW',
              color: 'yellow',
              icon: Flash,
            },
            {
              key: 'mtbf',
              shortLabel: 'MTBF',
              value: kpis.mtbf,
              unit: 'hrs',
              color: 'purple',
              icon: Time,
            },
            {
              key: 'mttr',
              shortLabel: 'MTTR',
              value: kpis.mttr,
              unit: 'hrs',
              color: 'blue',
              icon: Tools,
            },
            {
              key: 'activeAlerts',
              shortLabel: 'Active Alerts',
              value: kpis.activeAlerts ?? 0,
              unit: '',
              color: kpis.criticalAlerts > 0 ? 'red' : 'teal',
              icon: WarningFilled,
            },
            {
              key: 'ontologyNodes',
              shortLabel: 'Twin Nodes',
              value: kpis.ontologyNodes ?? 0,
              unit: '',
              color: 'teal',
              icon: Network_4,
            },
          ].map(k => {
            const rawTrend = trends[k.key];
            const isAlert = k.key === 'activeAlerts';
            const isTwin = k.key === 'ontologyNodes';
            const trendText = isAlert
              ? `${kpis.criticalAlerts || 0} critical`
              : isTwin
              ? `${kpis.ontologyEdges || 34} links`
              : rawTrend || '';

            const isUp = trendText.includes('↑') || trendText.includes('+');
            const isDown = trendText.includes('↓') || trendText.includes('-');

            return (
              <div key={k.key} className={`kpi-tile ${k.color}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span className="kpi-label">{k.shortLabel}</span>
                  <div className={`kpi-icon-wrap ${k.color}`}>
                    <k.icon size={15} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span className="kpi-value">{k.value ?? '—'}</span>
                  {k.unit && <span className="kpi-unit">{k.unit}</span>}
                </div>

                {trendText && (
                  <div
                    className={`kpi-trend ${
                      isAlert
                        ? kpis.criticalAlerts > 0
                          ? 'down'
                          : 'neutral'
                        : isTwin
                        ? 'neutral'
                        : isUp
                        ? 'up'
                        : isDown
                        ? 'down'
                        : 'neutral'
                    }`}
                  >
                    {isUp && <ArrowUpRight size={11} />}
                    {isDown && <ArrowDownRight size={11} />}
                    <span>{trendText}</span>
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
                <div className="legend-dot" style={{ background: 'var(--support-error)' }} /> Defects
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
              {sensors.length > 0 ? sensors.map(s => {
                const cleanUnit = (s.unit || '').trim();
                const displayUnit = cleanUnit === 'C' ? '°C' : cleanUnit;
                return (
                  <div key={s.id} className="sensor-item">
                    <div className={`sensor-dot ${s.status || 'normal'}`} />
                    <span className="sensor-name">{s.label || s.id}</span>
                    <span className="sensor-value">{s.value}</span>
                    <span className="sensor-unit">{displayUnit}</span>
                  </div>
                );
              }) : (
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {processBreakdown.map(p => (
                  <div key={p.name} className="process-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{p.name}</span>
                      <span className={`badge ${p.status === 'Optimal' ? 'resolved' : p.status === 'Warning' ? 'active' : 'acknowledged'}`}>
                        {p.status || 'Operating'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-helper)' }}>Efficiency</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', color: p.efficiency >= 88 ? 'var(--support-success)' : p.efficiency >= 75 ? 'var(--blue-40)' : 'var(--support-warning)' }}>
                        {p.efficiency}%
                      </span>
                    </div>
                    <div className="progress-bar-track" style={{ marginBottom: 10, height: 6, borderRadius: 3 }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, p.efficiency)}%`,
                          borderRadius: 3,
                          background: p.efficiency >= 88
                            ? 'linear-gradient(90deg, #24a148, #42be65)'
                            : p.efficiency >= 75
                            ? 'linear-gradient(90deg, #0f62fe, #4589ff)'
                            : 'linear-gradient(90deg, #d2a106, #f1c21b)',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-helper)' }}>
                      <span>Cycle Time: <strong style={{ color: 'var(--text-secondary)' }}>{p.cycleTimeSec || 30}s</strong></span>
                      {p.alerts > 0 ? (
                        <span style={{ color: 'var(--support-warning)', display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 500 }}>
                          <WarningFilled size={12} /> {p.alerts} alert{p.alerts > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--support-success)' }}>Nominal</span>
                      )}
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
