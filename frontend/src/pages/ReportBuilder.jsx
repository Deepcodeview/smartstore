/* pages/ReportBuilder.jsx — Custom Report Builder, Scheduled Reports, Industry Benchmark */
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
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

const RATING_COLOR = { EXCELLENT: 'var(--green)', GOOD: 'var(--brand)', NEEDS_IMPROVEMENT: 'var(--red)' };
const FREQ_LABEL   = { daily: '📅 Daily', weekly: '📆 Weekly', monthly: '🗓️ Monthly' };

export default function ReportBuilder() {
  const [tab,        setTab]        = useState('builder');
  const [metrics,    setMetrics]    = useState(null);
  const [reports,    setReports]    = useState([]);
  const [scheduled,  setScheduled]  = useState([]);
  const [benchmark,  setBenchmark]  = useState(null);
  const [loading,    setLoading]    = useState(true);

  // Builder state
  const [selected,   setSelected]   = useState([]);
  const [reportName, setReportName] = useState('');
  const [runResult,  setRunResult]  = useState(null);
  const [running,    setRunning]    = useState(false);
  const [saving,     setSaving]     = useState(false);

  // Schedule form
  const [schedForm, setSchedForm] = useState({ name: '', frequency: 'daily', format: 'pdf', recipients: '' });
  const [schedSaved, setSchedSaved] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/bi/metrics/available`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/bi/reports/custom`).then(r => r.json()).catch(() => ({ reports: [] })),
      fetch(`${API_BASE}/bi/reports/scheduled`).then(r => r.json()).catch(() => ({ reports: [] })),
      fetch(`${API_BASE}/bi/benchmark`).then(r => r.json()).catch(() => null),
    ]).then(([m, cr, sr, bm]) => {
      setMetrics(m); setReports(cr?.reports || []);
      setScheduled(sr?.reports || []); setBenchmark(bm);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const toggleMetric = (key) => {
    setSelected(s => s.includes(key) ? s.filter(k => k !== key) : [...s, key]);
  };

  const saveReport = async () => {
    if (!reportName.trim() || selected.length === 0) return;
    setSaving(true);
    await fetch(`${API_BASE}/bi/reports/custom`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: reportName, metrics: selected }),
    });
    setSaving(false); setReportName(''); setSelected([]);
    load();
  };

  const runReport = async (id) => {
    setRunning(true); setRunResult(null);
    const res = await fetch(`${API_BASE}/bi/reports/custom/${id}/run`, { method: 'POST' }).then(r => r.json()).catch(() => null);
    setRunResult(res); setRunning(false);
  };

  const deleteReport = async (id) => {
    await fetch(`${API_BASE}/bi/reports/custom/${id}`, { method: 'DELETE' });
    load();
  };

  const createSchedule = async () => {
    const recipients = schedForm.recipients.split(',').map(e => e.trim()).filter(Boolean);
    if (!schedForm.name || recipients.length === 0) return;
    await fetch(`${API_BASE}/bi/reports/scheduled`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...schedForm, recipients }),
    });
    setSchedSaved(true); setTimeout(() => setSchedSaved(false), 2000);
    load();
  };

  const sendNow = async (id) => {
    await fetch(`${API_BASE}/bi/reports/scheduled/${id}/send`, { method: 'POST' });
    load();
  };

  const toggleSchedule = async (id, enabled) => {
    await fetch(`${API_BASE}/bi/reports/scheduled/${id}?enabled=${enabled}`, { method: 'PATCH' });
    load();
  };

  const TABS = [
    { id: 'builder',   label: '🔧 Report Builder' },
    { id: 'scheduled', label: `⏰ Scheduled (${scheduled.length})` },
    { id: 'benchmark', label: '📊 Industry Benchmark' },
  ];

  if (loading) return (
    <div>
      <div className="stat-grid stat-grid-4 mb-20">{[1,2,3,4].map(i => <div key={i} className="skeleton-kpi"/>)}</div>
      <div className="skeleton-chart"/>
    </div>
  );

  const byCategory = metrics?.by_category || {};

  return (
    <div>
      {/* KPI row */}
      <div className="stat-grid stat-grid-4 mb-20">
        <StatCard label="Available Metrics"  value={metrics?.total ?? 0}          color="var(--brand)"  sub="Metrics you can report on"/>
        <StatCard label="Saved Reports"      value={reports.length}                color="var(--purple)" sub="Custom report definitions"/>
        <StatCard label="Scheduled Reports"  value={scheduled.length}              color="var(--green)"  sub="Auto-send reports"/>
        <StatCard label="Benchmark Score"    value={benchmark ? `${benchmark.overall_score}%` : '—'} color={benchmark?.overall_score >= 75 ? 'var(--green)' : 'var(--amber)'} sub={benchmark?.rank || 'vs industry avg'}/>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── Report Builder ── */}
      {tab === 'builder' && (
        <div>
          <div className="grid-2 mb-16">
            {/* Metric selector */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">🔧 Select Metrics</div>
                <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>{selected.length} selected</span>
              </div>
              <div style={{ padding: 16, maxHeight: 420, overflowY: 'auto' }}>
                {Object.entries(byCategory).map(([cat, mets]) => (
                  <div key={cat} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>{cat}</div>
                    {mets.map(m => (
                      <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: selected.includes(m.key) ? 'var(--brand-light)' : 'transparent', marginBottom: 2, transition: 'background .15s' }}>
                        <input type="checkbox" checked={selected.includes(m.key)} onChange={() => toggleMetric(m.key)} style={{ accentColor: 'var(--brand)' }}/>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: selected.includes(m.key) ? 600 : 400, color: selected.includes(m.key) ? 'var(--brand)' : 'var(--text-primary)' }}>{m.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.unit}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Save + Saved reports */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="card-header"><div className="card-title">💾 Save Report</div></div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">Report Name</label>
                    <input className="form-input" value={reportName} onChange={e => setReportName(e.target.value)} placeholder="e.g. Weekly Sales Summary"/>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    {selected.length === 0 ? 'Select at least 1 metric above' : `${selected.length} metrics selected: ${selected.slice(0,3).join(', ')}${selected.length > 3 ? '...' : ''}`}
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveReport} disabled={!reportName.trim() || selected.length === 0 || saving}>
                    {saving ? '⏳ Saving...' : '💾 Save Report'}
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">📋 Saved Reports</div></div>
                {!reports.length ? (
                  <div className="empty-state" style={{ padding: 32 }}>
                    <div className="empty-state-icon">📋</div>
                    <div>No saved reports yet</div>
                  </div>
                ) : (
                  <div style={{ padding: 12 }}>
                    {reports.map(r => (
                      <div key={r.id} style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm btn-primary" onClick={() => runReport(r.id)} disabled={running}>
                              {running ? '⏳' : '▶ Run'}
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteReport(r.id)}>🗑</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.metrics?.length} metrics · {r.created_at}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Run result */}
          {runResult && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📊 {runResult.report_name} — Results</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{runResult.generated_at?.slice(0,16)}</span>
              </div>
              <div style={{ padding: 16 }}>
                <div className="stat-grid stat-grid-4">
                  {runResult.metrics?.map(m => (
                    <div key={m.key} style={{ padding: '14px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{m.label}</div>
                      <div style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 700, color: 'var(--brand)' }}>
                        {typeof m.value === 'object' ? JSON.stringify(m.value).slice(0, 30) : String(m.value)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{m.unit} · {m.category}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Scheduled Reports ── */}
      {tab === 'scheduled' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">⏰ Create Scheduled Report</div></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Report Name</label>
                <input className="form-input" value={schedForm.name} onChange={e => setSchedForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Daily Morning Summary"/>
              </div>
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select className="form-input form-select" value={schedForm.frequency} onChange={e => setSchedForm(p => ({ ...p, frequency: e.target.value }))}>
                  <option value="daily">📅 Daily (every morning 7AM)</option>
                  <option value="weekly">📆 Weekly (every Monday 7AM)</option>
                  <option value="monthly">🗓️ Monthly (1st of month 7AM)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Format</label>
                <select className="form-input form-select" value={schedForm.format} onChange={e => setSchedForm(p => ({ ...p, format: e.target.value }))}>
                  <option value="pdf">📄 PDF</option>
                  <option value="excel">📊 Excel</option>
                  <option value="both">📄📊 Both</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Recipients (comma-separated emails)</label>
                <input className="form-input" value={schedForm.recipients} onChange={e => setSchedForm(p => ({ ...p, recipients: e.target.value }))} placeholder="owner@store.com, manager@store.com"/>
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--brand-light)', borderRadius: 'var(--r-sm)', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
                📧 Reports will be emailed automatically. Connect SMTP/SendGrid in Enterprise → Integrations for real delivery.
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={createSchedule}>
                {schedSaved ? '✓ Scheduled!' : '⏰ Create Schedule'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">📋 Active Schedules</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{scheduled.length} total</span>
            </div>
            {!scheduled.length ? (
              <div className="empty-state" style={{ padding: 48 }}>
                <div className="empty-state-icon">⏰</div>
                <div className="empty-state-title">No scheduled reports yet</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Create a schedule to auto-send reports</div>
              </div>
            ) : (
              <div style={{ padding: 12 }}>
                {scheduled.map(s => (
                  <div key={s.id} style={{ padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {FREQ_LABEL[s.frequency]} · {s.format.toUpperCase()} · {s.recipients?.length} recipient(s)
                        </div>
                      </div>
                      <span className={`badge badge-${s.enabled ? 'active' : 'inactive'}`}>{s.enabled ? 'Active' : 'Paused'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Last sent: {s.last_sent || 'Never'} · Next: {s.next_run || '—'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => sendNow(s.id)}>📤 Send Now</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => toggleSchedule(s.id, !s.enabled)}>
                        {s.enabled ? '⏸ Pause' : '▶ Resume'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Industry Benchmark ── */}
      {tab === 'benchmark' && benchmark && (
        <div>
          {/* Score header */}
          <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--brand-light) 0%, var(--purple-light) 100%)', border: '1px solid rgba(0,87,255,.1)', borderRadius: 'var(--r-lg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-d)', fontSize: 52, fontWeight: 800, color: benchmark.overall_score >= 75 ? 'var(--green)' : 'var(--amber)', lineHeight: 1 }}>{benchmark.overall_score}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Overall Score</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Industry Rank: {benchmark.rank}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{benchmark.data_note}</div>
              {benchmark.needs_improvement?.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--amber)' }}>
                  ⚠️ Needs improvement: {benchmark.needs_improvement.join(', ')}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>{benchmark.excellent_count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Excellent metrics</div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="card mb-16">
            <div className="card-header"><div className="card-title">📊 Your Store vs Industry Average</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={benchmark.metrics.filter(m => typeof m.store_value === 'number')} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end"/>
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                  <Bar dataKey="store_value"   name="Your Store"      fill="#0057ff" radius={[4,4,0,0]}/>
                  <Bar dataKey="industry_avg"  name="Industry Avg"    fill="#e2e8f0" radius={[4,4,0,0]}/>
                  <Bar dataKey="top_quartile"  name="Top 25%"         fill="#bbf7d0" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Metric cards */}
          <div className="card">
            <div className="card-header"><div className="card-title">📋 Detailed Benchmark</div></div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Metric</th><th>Your Store</th><th>Industry Avg</th><th>Top 25%</th><th>vs Avg</th><th>Rating</th></tr></thead>
                <tbody>
                  {benchmark.metrics.map(m => (
                    <tr key={m.key}>
                      <td style={{ fontWeight: 600 }}>{m.label}</td>
                      <td style={{ fontFamily: 'var(--font-d)', fontSize: 16, fontWeight: 700, color: RATING_COLOR[m.rating] }}>{m.store_value} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.unit}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{m.industry_avg} {m.unit}</td>
                      <td style={{ color: 'var(--green)' }}>{m.top_quartile} {m.unit}</td>
                      <td style={{ fontWeight: 600, color: m.vs_avg_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {m.vs_avg_pct >= 0 ? '+' : ''}{m.vs_avg_pct}%
                      </td>
                      <td><span className={`badge badge-${m.rating === 'EXCELLENT' ? 'active' : m.rating === 'GOOD' ? 'LOW' : 'HIGH'}`}>{m.rating}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
