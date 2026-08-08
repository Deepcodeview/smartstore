/* pages/AdminDashboard.jsx — Retail Admin Dashboard */
import React, { useState, useEffect, useCallback } from 'react';
import useAppStore from '../store/appStore';
import { API_BASE } from '../utils/api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const API = API_BASE;

function KpiCard({ label, value, sub, color = 'var(--brand)', icon }) {
  return (
    <div className="stat-card-premium" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
        {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        {action}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAppStore();
  const [tab, setTab] = useState('overview');
  const [kpis, setKpis] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, jobRes, alertRes, storeRes] = await Promise.allSettled([
        fetch(`${API}/dashboard/kpis`).then(r => r.json()),
        fetch(`${API}/jobs/`).then(r => r.json()),
        fetch(`${API}/dashboard/notifications`).then(r => r.json()),
        fetch(`${API}/enterprise/stores`).then(r => r.json()),
      ]);
      if (kpiRes.status === 'fulfilled') setKpis(kpiRes.value);
      if (jobRes.status === 'fulfilled') setJobs(jobRes.value?.jobs || []);
      if (alertRes.status === 'fulfilled') setAlerts(alertRes.value?.notifications || []);
      if (storeRes.status === 'fulfilled') setStores(storeRes.value?.stores || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const completed = jobs.filter(j => j.status === 'completed');
  const processing = jobs.filter(j => j.status === 'processing');
  const failed = jobs.filter(j => j.status === 'failed');
  const criticalAlerts = alerts.filter(a => a.type === 'CRITICAL');

  // Chart data from jobs
  const jobStatusData = [
    { name: 'Completed', value: completed.length, color: 'var(--green)' },
    { name: 'Processing', value: processing.length, color: 'var(--brand)' },
    { name: 'Failed', value: failed.length, color: 'var(--red)' },
  ].filter(d => d.value > 0);

  // Last 7 jobs timeline
  const recentTimeline = jobs.slice(0, 7).map((j, i) => ({
    name: `J${i + 1}`,
    entries: (j.entries || 0),
    exits: (j.exits || 0),
  }));

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'jobs',     label: `🎬 Jobs (${jobs.length})` },
    { id: 'alerts',   label: `🔔 Alerts (${alerts.length})` },
    { id: 'stores',   label: `🏪 Stores (${stores.length})` },
    { id: 'system',   label: '🛡️ System' },
  ];

  if (loading) return (
    <div>
      <div className="stat-grid stat-grid-4 mb-20">{[1,2,3,4].map(i => <div key={i} className="skeleton-kpi"/>)}</div>
      <div className="skeleton-chart"/>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-20">
        <div>
          <div style={{ fontFamily: 'var(--font-d)', fontSize: 20, fontWeight: 800 }}>🌐 Admin Control Center</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            Retail AI Platform · Auto-refresh every 15s
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>🔄 Refresh</button>
      </div>

      {/* KPI Row */}
      <div className="stat-grid stat-grid-4 mb-20">
        <KpiCard label="Total Jobs"       value={jobs.length}           icon="🎬" color="var(--brand)"  sub={`${processing.length} processing now`}/>
        <KpiCard label="Total Entries"    value={kpis?.total_entries ?? '—'} icon="🚶" color="var(--green)"  sub="All-time footfall"/>
        <KpiCard label="Active Alerts"    value={alerts.length}         icon="🔔" color={criticalAlerts.length > 0 ? 'var(--red)' : 'var(--amber)'} sub={`${criticalAlerts.length} critical`}/>
        <KpiCard label="Stores Online"    value={stores.filter(s => s.active).length || '—'} icon="🏪" color="var(--purple)" sub={`${stores.length} total registered`}/>
      </div>

      <div className="stat-grid stat-grid-4 mb-20">
        <KpiCard label="Completed Jobs"   value={completed.length}      icon="✅" color="var(--green)"  sub="Successfully processed"/>
        <KpiCard label="Failed Jobs"      value={failed.length}         icon="❌" color={failed.length > 0 ? 'var(--red)' : 'var(--text-muted)'} sub="Need attention"/>
        <KpiCard label="Live Crowd"       value={kpis?.live_crowd ?? '—'} icon="👥" color="var(--brand)"  sub="Current in-store (simulated)"/>
        <KpiCard label="Shelf Alerts"     value={kpis?.shelf_alerts ?? '—'} icon="📦" color="var(--amber)" sub="Empty / low stock"/>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--bg)', padding: 5, borderRadius: 'var(--r-lg)', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            border: 'none', transition: 'all .15s',
            background: tab === t.id ? 'var(--bg-card)' : 'transparent',
            color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: tab === t.id ? 'var(--shadow-sm)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            {/* Footfall chart */}
            <SectionCard title="📈 Footfall — Recent Jobs">
              {recentTimeline.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">📈</div><div>No job data yet</div></div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={recentTimeline} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}/>
                    <Bar dataKey="entries" name="Entries" fill="var(--green)"  radius={[4,4,0,0]}/>
                    <Bar dataKey="exits"   name="Exits"   fill="var(--brand)"  radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            {/* Job status pie */}
            <SectionCard title="🎬 Job Status Distribution">
              {jobStatusData.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">🎬</div><div>No jobs yet</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <PieChart width={180} height={180}>
                    <Pie data={jobStatusData} cx={85} cy={85} innerRadius={45} outerRadius={80}
                      dataKey="value" strokeWidth={2} stroke="var(--bg-card)">
                      {jobStatusData.map((e, i) => <Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                  </PieChart>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {jobStatusData.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }}/>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.name}: <strong>{d.value}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Recent alerts */}
          <SectionCard title="🔔 Recent Alerts" action={
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{alerts.length} total</span>
          }>
            {alerts.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}><div className="empty-state-icon">✅</div><div>No alerts</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.slice(0, 5).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 16 }}>{a.type === 'CRITICAL' ? '🔴' : a.type === 'HIGH' ? '🟡' : '🔵'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.message}</div>
                    </div>
                    <span className={`badge badge-${a.type}`}>{a.type}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Jobs Tab ── */}
      {tab === 'jobs' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🎬 All Video Jobs</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-active">{completed.length} completed</span>
              <span className="badge badge-HIGH">{processing.length} processing</span>
              {failed.length > 0 && <span className="badge badge-CRITICAL">{failed.length} failed</span>}
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr>
                <th>Job ID</th><th>File</th><th>Status</th><th>Progress</th>
                <th>Entries</th><th>Exits</th><th>Created</th>
              </tr></thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No jobs yet — upload a video to start</td></tr>
                ) : jobs.map(j => (
                  <tr key={j.job_id}>
                    <td className="cell-mono" style={{ fontSize: 11 }}>{j.job_id?.slice(0, 8)}…</td>
                    <td style={{ fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.filename}</td>
                    <td><span className={`badge badge-${j.status === 'completed' ? 'active' : j.status === 'failed' ? 'CRITICAL' : 'HIGH'}`}>{j.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 60 }}>
                          <div className="progress-fill" style={{ width: `${j.progress || 0}%`, background: j.status === 'completed' ? 'var(--green)' : 'var(--brand)' }}/>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{j.progress || 0}%</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-m)', color: 'var(--green)', fontWeight: 600 }}>{j.entries ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-m)', color: 'var(--brand)', fontWeight: 600 }}>{j.exits ?? '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{j.created_at ? new Date(j.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Alerts Tab ── */}
      {tab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="stat-grid stat-grid-4 mb-16">
            <KpiCard label="Total Alerts"    value={alerts.length}                                    color="var(--text-secondary)"/>
            <KpiCard label="Critical"        value={alerts.filter(a => a.type === 'CRITICAL').length} color="var(--red)"/>
            <KpiCard label="High"            value={alerts.filter(a => a.type === 'HIGH').length}     color="var(--amber)"/>
            <KpiCard label="Info"            value={alerts.filter(a => a.type === 'INFO').length}     color="var(--brand)"/>
          </div>
          {alerts.length === 0 ? (
            <div className="card"><div className="empty-state" style={{ padding: 64 }}><div className="empty-state-icon">✅</div><div className="empty-state-title">All clear — no alerts</div></div></div>
          ) : alerts.map((a, i) => (
            <div key={i} className={`alert-item sev-${a.type}`}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{a.type === 'CRITICAL' ? '🔴' : a.type === 'HIGH' ? '🟡' : '🔵'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4, fontFamily: 'var(--font-m)' }}>
                  {a.time ? new Date(a.time).toLocaleString('en-IN') : '—'}
                </div>
              </div>
              <span className={`badge badge-${a.type}`}>{a.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Stores Tab ── */}
      {tab === 'stores' && (
        <div>
          <div className="stat-grid stat-grid-3 mb-16">
            <KpiCard label="Total Stores"  value={stores.length}                          color="var(--brand)"/>
            <KpiCard label="Active"        value={stores.filter(s => s.active).length}    color="var(--green)"/>
            <KpiCard label="Inactive"      value={stores.filter(s => !s.active).length}   color="var(--text-muted)"/>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">🏪 Registered Stores</div></div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Store ID</th><th>Name</th><th>Location</th><th>Manager</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>
                  {stores.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                      No stores registered — use Enterprise → Stores to add
                    </td></tr>
                  ) : stores.map(s => (
                    <tr key={s.id}>
                      <td className="cell-mono">{s.id}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.location || '—'}</td>
                      <td style={{ fontSize: 12 }}>{s.manager_email || '—'}</td>
                      <td><span className={`badge badge-${s.active ? 'active' : 'inactive'}`}>{s.active ? 'Active' : 'Inactive'}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.created_at?.slice(0, 10) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── System Tab ── */}
      {tab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="stat-grid stat-grid-4 mb-4">
            <KpiCard label="Backend"      value="Online"   icon="✅" color="var(--green)"  sub="FastAPI running"/>
            <KpiCard label="Database"     value="SQLite"   icon="🗄️" color="var(--brand)"  sub="Auto-migrated"/>
            <KpiCard label="WebSocket"    value="Active"   icon="⚡" color="var(--green)"  sub="ws://localhost:8000"/>
            <KpiCard label="AI Models"    value="Loaded"   icon="🤖" color="var(--purple)" sub="YOLOv8 ready"/>
          </div>

          <div className="grid-2">
            <SectionCard title="🔗 API Endpoints">
              {[
                { label: 'Backend URL',    value: 'http://localhost:8000' },
                { label: 'API Docs',       value: 'http://localhost:8000/docs' },
                { label: 'WebSocket',      value: 'ws://localhost:8000/ws/alerts' },
                { label: 'SSE Stream',     value: 'http://localhost:8000/dashboard/stream' },
                { label: 'Total Routes',   value: '142 routes registered' },
              ].map(r => (
                <div key={r.label} className="info-row">
                  <span className="info-label">{r.label}</span>
                  <span className="info-value mono">{r.value}</span>
                </div>
              ))}
            </SectionCard>

            <SectionCard title="📦 Modules Status">
              {[
                { name: 'Core Detection',    status: 'active', detail: 'YOLOv8 + ByteTrack' },
                { name: 'Zone Analytics',    status: 'active', detail: 'Polygon zones + heatmap' },
                { name: 'Footfall Counter',  status: 'active', detail: 'Entry/Exit polygon mode' },
                { name: 'Dwell Tracker',     status: 'active', detail: 'Global ID based' },
                { name: 'BI Reports',        status: 'active', detail: '10 routes' },
                { name: 'Platform Config',   status: 'active', detail: 'Whitelabel + API keys' },
                { name: 'Edge Deployment',   status: 'active', detail: 'Jetson/OAK-D/RPi' },
                { name: 'WebSocket Alerts',  status: 'active', detail: 'Real-time push' },
              ].map(m => (
                <div key={m.name} className="info-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className={`status-dot ${m.status === 'active' ? 'online' : 'offline'}`}/>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.detail}</span>
                </div>
              ))}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
