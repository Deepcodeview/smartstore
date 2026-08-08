/* pages/AIInsights.jsx — Predictive AI & Advanced Analytics */
import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { API_BASE } from '../utils/api';

function StatCard({ label, value, color = 'var(--brand)', sub }) {
  return (
    <div className="stat-card-premium" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-d)', fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }}/>
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const SEV_COLOR = { CRITICAL: 'var(--red)', HIGH: 'var(--amber)', MEDIUM: 'var(--brand)', LOW: 'var(--green)' };
const URG_COLOR = { OVERDUE: 'var(--red)', TODAY: 'var(--amber)', SOON: 'var(--amber)', NORMAL: 'var(--green)' };

export default function AIInsights() {
  const [tab,       setTab]       = useState('forecast');
  const [forecast,  setForecast]  = useState(null);
  const [demand,    setDemand]    = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [camHealth, setCamHealth] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [scanning,  setScanning]  = useState(false);
  const [scanMsg,   setScanMsg]   = useState('');

  // Camera report form
  const [camForm, setCamForm] = useState({ camera_id: '', issue_type: 'offline', zone: '', description: '' });
  const [camSaved, setCamSaved] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/ai/footfall-forecast?days_ahead=7`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/ai/demand-forecast`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/ai/anomalies`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/ai/camera-health`).then(r => r.json()).catch(() => null),
    ]).then(([f, d, a, c]) => {
      setForecast(f); setDemand(d); setAnomalies(a); setCamHealth(c);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setScanning(true); setScanMsg('');
    const res = await fetch(`${API_BASE}/ai/anomalies/scan`, { method: 'POST' }).then(r => r.json()).catch(() => null);
    setScanMsg(res?.message || 'Scan complete');
    setScanning(false);
    load();
  };

  const reportCamera = async () => {
    await fetch(`${API_BASE}/ai/camera-health/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(camForm),
    });
    setCamSaved(true); setTimeout(() => setCamSaved(false), 2000);
    load();
  };

  const TABS = [
    { id: 'forecast',  label: '📈 Footfall Forecast' },
    { id: 'demand',    label: '📦 Demand Forecast' },
    { id: 'anomalies', label: `🔍 Anomalies${anomalies?.total ? ` (${anomalies.total})` : ''}` },
    { id: 'camera',    label: '📷 Camera Health' },
  ];

  if (loading) return (
    <div>
      <div className="stat-grid stat-grid-4 mb-20">{[1,2,3,4].map(i => <div key={i} className="skeleton-kpi"/>)}</div>
      <div className="skeleton-chart"/>
    </div>
  );

  return (
    <div>
      {/* KPI row */}
      <div className="stat-grid stat-grid-4 mb-20">
        <StatCard label="Forecast Peak Day"  value={forecast?.peak_day?.label || '—'}         color="var(--brand)"  sub={`${forecast?.peak_day?.predicted || 0} predicted visitors`}/>
        <StatCard label="Trend Direction"    value={forecast?.trend_direction || '—'}          color={forecast?.trend_direction === 'UP' ? 'var(--green)' : forecast?.trend_direction === 'DOWN' ? 'var(--red)' : 'var(--amber)'} sub="Based on last 30 days"/>
        <StatCard label="Demand Overdue"     value={demand?.overdue ?? 0}                      color={demand?.overdue > 0 ? 'var(--red)' : 'var(--green)'} sub="Zones needing reorder now"/>
        <StatCard label="Anomalies Detected" value={anomalies?.total ?? 0}                     color={anomalies?.total > 0 ? 'var(--amber)' : 'var(--green)'} sub="Auto-detected patterns"/>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Footfall Forecast */}
      {tab === 'forecast' && (
        <div>
          <div className="card mb-16">
            <div className="card-header">
              <div>
                <div className="card-title">📈 Next 7-Day Footfall Forecast</div>
                <div className="card-subtitle">Model: {forecast?.model} · Historical avg: {forecast?.avg_historical} visitors/day</div>
              </div>
              <span style={{ fontSize: 11, padding: '4px 10px', background: 'var(--brand-light)', color: 'var(--brand)', borderRadius: 20, fontWeight: 600 }}>
                {forecast?.data_points_used || 0} data points
              </span>
            </div>
            <div className="card-body">
              {forecast?.forecast?.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={forecast.forecast} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gPred" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0057ff" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#0057ff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Legend wrapperStyle={{ fontSize: 12 }}/>
                    <Area type="monotone" dataKey="ci_high"    name="Upper CI"  stroke="none" fill="#0057ff" fillOpacity={0.06}/>
                    <Area type="monotone" dataKey="predicted"  name="Predicted" stroke="#0057ff" strokeWidth={2.5} fill="url(#gPred)"/>
                    <Area type="monotone" dataKey="ci_low"     name="Lower CI"  stroke="none" fill="white" fillOpacity={1}/>
                    {forecast?.avg_historical > 0 && (
                      <ReferenceLine y={forecast.avg_historical} stroke="var(--text-muted)" strokeDasharray="4 4" label={{ value: 'Avg', fontSize: 10, fill: 'var(--text-muted)' }}/>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ padding: 48 }}>
                  <div className="empty-state-icon">📈</div>
                  <div className="empty-state-title">No historical data yet</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Complete video jobs to enable forecasting</div>
                </div>
              )}
            </div>
          </div>

          {/* Forecast table */}
          {forecast?.forecast?.length > 0 && (
            <div className="card">
              <div className="card-header"><div className="card-title">📅 Day-by-Day Forecast</div></div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Day</th><th>Predicted</th><th>Range</th><th>Season</th><th>Boost</th></tr></thead>
                  <tbody>
                    {forecast.forecast.map(f => (
                      <tr key={f.date}>
                        <td style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>{f.date}</td>
                        <td style={{ fontWeight: 600 }}>{f.day_of_week}</td>
                        <td style={{ fontFamily: 'var(--font-d)', fontSize: 16, fontWeight: 700, color: 'var(--brand)' }}>{f.predicted}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.ci_low} – {f.ci_high}</td>
                        <td><span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--brand-light)', color: 'var(--brand)', borderRadius: 10 }}>{f.season}</span></td>
                        <td style={{ fontSize: 11, color: f.boost_reason ? 'var(--amber)' : 'var(--text-muted)' }}>{f.boost_reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                ℹ️ {forecast.note}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Demand Forecast */}
      {tab === 'demand' && (
        <div>
          <div className="stat-grid stat-grid-3 mb-16">
            <StatCard label="Total Zones Tracked" value={demand?.total_zones ?? 0}  color="var(--brand)"  sub="With shelf event history"/>
            <StatCard label="Overdue Reorders"     value={demand?.overdue ?? 0}      color={demand?.overdue > 0 ? 'var(--red)' : 'var(--green)'} sub="Reorder date passed"/>
            <StatCard label="Due Soon"             value={demand?.due_soon ?? 0}     color="var(--amber)" sub="Within 2 days"/>
          </div>

          {!demand?.forecasts?.length ? (
            <div className="card">
              <div className="empty-state" style={{ padding: 64 }}>
                <div className="empty-state-icon">📦</div>
                <div className="empty-state-title">No shelf event data yet</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log shelf empty events in Inventory → Shelf Events to enable demand forecasting</div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📦 Demand Forecast by Zone</div>
                <div className="card-subtitle">Model: {demand?.model}</div>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Zone</th><th>Avg Days Between Empty</th><th>Last Restock</th><th>Next Reorder</th><th>Days Until</th><th>Urgency</th><th>Confidence</th></tr></thead>
                  <tbody>
                    {demand.forecasts.map(f => (
                      <tr key={f.zone}>
                        <td style={{ fontWeight: 600 }}>{f.zone}</td>
                        <td>{f.avg_days_between_empties}d</td>
                        <td style={{ fontSize: 11, fontFamily: 'var(--font-m)' }}>{f.last_restock}</td>
                        <td style={{ fontFamily: 'var(--font-m)', fontSize: 12, fontWeight: 600 }}>{f.predicted_reorder_date}</td>
                        <td style={{ fontFamily: 'var(--font-d)', fontSize: 16, fontWeight: 700, color: URG_COLOR[f.urgency] || 'var(--text-primary)' }}>
                          {f.days_until_reorder < 0 ? `${Math.abs(f.days_until_reorder)}d ago` : `${f.days_until_reorder}d`}
                        </td>
                        <td><span className={`badge badge-${f.urgency === 'OVERDUE' ? 'CRITICAL' : f.urgency === 'SOON' ? 'HIGH' : 'active'}`}>{f.urgency}</span></td>
                        <td><span style={{ fontSize: 11, color: f.confidence === 'HIGH' ? 'var(--green)' : f.confidence === 'MEDIUM' ? 'var(--amber)' : 'var(--text-muted)' }}>{f.confidence}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Anomaly Detection */}
      {tab === 'anomalies' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={runScan} disabled={scanning}>
              {scanning ? '⏳ Scanning...' : '🔍 Run Anomaly Scan'}
            </button>
            {scanMsg && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ {scanMsg}</span>}
          </div>

          {/* By-type summary */}
          {anomalies?.by_type && (
            <div className="stat-grid stat-grid-4 mb-16">
              {Object.entries(anomalies.by_type).map(([type, count]) => (
                <StatCard key={type}
                  label={type.replace(/_/g, ' ')}
                  value={count}
                  color={count > 0 ? (type === 'camera_offline' ? 'var(--red)' : 'var(--amber)') : 'var(--green)'}
                  sub="detected"
                />
              ))}
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <div className="card-title">🔍 Anomaly Log</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{anomalies?.total || 0} total</span>
            </div>
            {!anomalies?.anomalies?.length ? (
              <div className="empty-state" style={{ padding: 48 }}>
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-title">No anomalies detected</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Run a scan to check for unusual patterns</div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Type</th><th>Zone</th><th>Value</th><th>Baseline</th><th>Deviation</th><th>Severity</th><th>Message</th><th>Time</th></tr></thead>
                  <tbody>
                    {anomalies.anomalies.map(a => (
                      <tr key={a.id}>
                        <td><span style={{ fontSize: 11, fontFamily: 'var(--font-m)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{a.type}</span></td>
                        <td>{a.zone || '—'}</td>
                        <td style={{ fontFamily: 'var(--font-d)', fontWeight: 700 }}>{a.value ?? '—'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{a.baseline ?? '—'}</td>
                        <td style={{ color: a.deviation_pct > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                          {a.deviation_pct != null ? `${a.deviation_pct > 0 ? '+' : ''}${a.deviation_pct}%` : '—'}
                        </td>
                        <td><span className={`badge badge-${a.severity}`}>{a.severity}</span></td>
                        <td style={{ fontSize: 11, maxWidth: 200 }}>{a.message}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-m)' }}>{a.wall_time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera Health */}
      {tab === 'camera' && (
        <div>
          <div className="stat-grid stat-grid-3 mb-16">
            <StatCard label="Health Score"   value={`${camHealth?.health_score ?? 100}%`} color={camHealth?.health_score >= 90 ? 'var(--green)' : camHealth?.health_score >= 70 ? 'var(--amber)' : 'var(--red)'} sub="Camera system health"/>
            <StatCard label="Status"         value={camHealth?.status || '—'}             color={camHealth?.status === 'HEALTHY' ? 'var(--green)' : 'var(--red)'} sub="Overall camera status"/>
            <StatCard label="Issues Found"   value={camHealth?.total_issues ?? 0}         color={camHealth?.total_issues > 0 ? 'var(--amber)' : 'var(--green)'} sub="Active camera issues"/>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">📷 Camera Issues</div></div>
              {!camHealth?.issues?.length ? (
                <div className="empty-state" style={{ padding: 32 }}>
                  <div className="empty-state-icon">✅</div>
                  <div>All cameras healthy</div>
                </div>
              ) : (
                <div style={{ padding: 16 }}>
                  {camHealth.issues.map((issue, i) => (
                    <div key={i} style={{ padding: '10px 14px', background: 'var(--amber-light)', border: '1px solid var(--amber-border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>📷 {issue.camera_id}</span>
                        <span className="badge badge-HIGH">{issue.issue_type}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{issue.message}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{issue.last_seen}</div>
                    </div>
                  ))}
                </div>
              )}
              {camHealth?.recommendations?.filter(Boolean).length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  {camHealth.recommendations.filter(Boolean).map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>💡 {r}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">🚨 Report Camera Issue</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Camera ID</label>
                  <input className="form-input" value={camForm.camera_id} onChange={e => setCamForm(p => ({ ...p, camera_id: e.target.value }))} placeholder="e.g. cam_entrance_1"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Issue Type</label>
                  <select className="form-input form-select" value={camForm.issue_type} onChange={e => setCamForm(p => ({ ...p, issue_type: e.target.value }))}>
                    {['offline', 'blurred', 'tampered', 'low_light', 'misaligned'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Zone</label>
                  <select className="form-input form-select" value={camForm.zone} onChange={e => setCamForm(p => ({ ...p, zone: e.target.value }))}>
                    <option value="">Select zone</option>
                    {['Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="form-input" value={camForm.description} onChange={e => setCamForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the issue..."/>
                </div>
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={reportCamera}>
                  {camSaved ? '✓ Reported!' : '🚨 Report Issue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
