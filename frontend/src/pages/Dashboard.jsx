/* pages/Dashboard.jsx — Live SSE Dashboard */
import React, { useEffect, useState, useRef } from 'react';
import useAppStore from '../store/appStore';
import ZoneHeatmapCanvas from '../components/ZoneHeatmapCanvas';

const API_BASE = 'http://localhost:8000';

function KpiCard({ label, value, unit = '', color = 'var(--brand)', sub }) {
  return (
    <div className="stat-card-premium" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-d)', fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { setLiveKpis } = useAppStore();
  const [kpis,       setKpis]       = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [connected,  setConnected]  = useState(false);
  const [agentReport, setAgentReport] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);
  const esRef = useRef(null);

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/dashboard/stream`);
    esRef.current = es;

    es.onopen    = () => setConnected(true);
    es.onerror   = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setKpis(data);
        setLiveKpis(data);
      } catch (_) {}
    };

    return () => es.close();
  }, []);

  // Recent jobs
  useEffect(() => {
    fetch(`${API_BASE}/dashboard/recent-jobs`)
      .then(r => r.ok ? r.json() : [])
      .then(setRecentJobs)
      .catch(() => {});
  }, []);

  const runOptimizer = async () => {
    setLoadingReport(true);
    try {
      const res = await fetch(`${API_BASE}/agents/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analytics: kpis }),
      });
      const data = await res.json();
      setAgentReport(data.recommendations?.join('\n\n') || '');
    } catch (_) {
      setAgentReport('Backend offline — connect backend to get AI recommendations.');
    }
    setLoadingReport(false);
  };

  const zoneHeatmap = kpis?.zone_heatmap || {};

  return (
    <div>
      {/* Connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--red)', animation: connected ? 'livePulse 1.5s infinite' : 'none' }}/>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {connected ? 'Live data streaming' : 'Connecting to backend...'}
        </span>
        {kpis?.ts && <span style={{ fontSize: 11, color: 'var(--text-light)', fontFamily: 'var(--font-m)' }}>Updated: {new Date(kpis.ts).toLocaleTimeString()}</span>}
      </div>

      {/* KPI Cards */}
      <div className="stat-grid stat-grid-4 mb-20">
        <KpiCard label="Live Crowd"       value={kpis?.live_crowd ?? '—'}       unit="people" color="var(--brand)"  sub="Current in-store"/>
        <KpiCard label="Today's Entries"  value={kpis?.total_entries ?? '—'}    color="var(--green)" sub="Total footfall"/>
        <KpiCard label="Conversion Rate"  value={kpis?.conversion_rate ?? '—'}  unit="%" color="var(--purple)" sub="Visitors → buyers"/>
        <KpiCard label="Avg Dwell Time"   value={kpis?.avg_dwell_min ?? '—'}    unit="min" color="var(--amber)" sub="Per customer"/>
      </div>

      <div className="stat-grid stat-grid-4 mb-20">
        <KpiCard label="Total Jobs"       value={kpis?.total_jobs ?? '—'}       color="var(--text-secondary)" sub="Video analyses"/>
        <KpiCard label="Active Jobs"      value={kpis?.active_jobs ?? '—'}      color="var(--brand)" sub="Processing now"/>
        <KpiCard label="Shelf Alerts"     value={kpis?.shelf_alerts ?? '—'}     color="var(--amber)" sub="Empty/low stock"/>
        <KpiCard label="Total Alerts"     value={kpis?.total_alerts ?? '—'}     color="var(--red)" sub="All time"/>
      </div>

      <div className="grid-2 mb-20">
        {/* Zone Heatmap */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🗺️ Zone Footfall Heatmap</div>
              <div className="card-subtitle">Live crowd distribution</div>
            </div>
          </div>
          <div className="card-body">
            <ZoneHeatmapCanvas heatmap={zoneHeatmap}/>
          </div>
        </div>

        {/* AI Optimizer */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🤖 AI Store Optimizer</div>
              <div className="card-subtitle">Agent 4 — Layout & staffing suggestions</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={runOptimizer} disabled={loadingReport}>
              {loadingReport ? <><span className="spinner"/>Running...</> : '⚡ Run AI'}
            </button>
          </div>
          <div className="card-body">
            {agentReport ? (
              <div className="ai-box">
                <div className="ai-label">🤖 AI Recommendations</div>
                {agentReport.split('\n\n').map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <span style={{ color: 'var(--brand)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                    <div className="ai-text">{tip}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">⚡</div>
                <div className="empty-state-title">Click "Run AI" to get recommendations</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Agent 4 analyzes your store data</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📹 Recent Video Jobs</div>
        </div>
        {recentJobs.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-icon">📹</div>
            <div className="empty-state-title">No jobs yet</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Upload a video to start analysis</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr>
                <th>File</th><th>Status</th><th>Entries</th><th>Exits</th><th>Created</th>
              </tr></thead>
              <tbody>
                {recentJobs.map(j => (
                  <tr key={j.job_id}>
                    <td style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>{j.filename}</td>
                    <td><span className={`badge badge-${j.status}`}>{j.status}</span></td>
                    <td>{j.entries}</td>
                    <td>{j.exits}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(j.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
