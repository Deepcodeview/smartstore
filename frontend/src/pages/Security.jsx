/* pages/Security.jsx — Loss Prevention & Security Dashboard */
import React, { useState, useEffect } from 'react';
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

const RISK_COLOR = { HIGH: 'var(--red)', MEDIUM: 'var(--amber)', LOW: 'var(--green)', NORMAL: 'var(--green)', CRITICAL: 'var(--red)' };

export default function Security() {
  const [tab,       setTab]       = useState('overview');
  const [summary,   setSummary]   = useState(null);
  const [behavior,  setBehavior]  = useState(null);
  const [mismatch,  setMismatch]  = useState(null);
  const [blindSpots,setBlindSpots]= useState(null);
  const [flags,     setFlags]     = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Flag form
  const [flagForm, setFlagForm] = useState({ flag_type: 'loitering', zone: '', description: '' });
  const [flagSaved, setFlagSaved] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/security/summary`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/security/suspicious-behavior`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/security/billing-mismatch`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/security/blind-spots`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/security/flags`).then(r => r.json()).catch(() => ({ flags: [] })),
    ]).then(([s, b, m, bs, f]) => {
      setSummary(s); setBehavior(b); setMismatch(m); setBlindSpots(bs);
      setFlags(f?.flags || []); setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const submitFlag = async () => {
    await fetch(`${API_BASE}/security/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flagForm),
    });
    setFlagSaved(true); setTimeout(() => setFlagSaved(false), 2000);
    load();
  };

  const TABS = [
    { id: 'overview',  label: '🛡️ Overview' },
    { id: 'behavior',  label: '👁️ Suspicious Behavior' },
    { id: 'mismatch',  label: '🧾 Billing Mismatch' },
    { id: 'blindspot', label: '📷 Blind Spots' },
    { id: 'flags',     label: `🚩 Flags (${flags.length})` },
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
        <StatCard label="Risk Level"       value={summary?.risk_level ?? '—'}          color={RISK_COLOR[summary?.risk_level] || 'var(--brand)'} sub="Overall security status"/>
        <StatCard label="Billing Gap"      value={`${summary?.billing_gap_pct ?? 0}%`} color={summary?.billing_flagged ? 'var(--red)' : 'var(--green)'} sub="Entry vs billing gap"/>
        <StatCard label="Critical Alerts"  value={summary?.critical_alerts ?? 0}       color="var(--red)"   sub="Unresolved critical"/>
        <StatCard label="Coverage Score"   value={`${summary?.coverage_score ?? 0}%`}  color="var(--brand)" sub="Camera coverage"/>
      </div>

      {/* Disclaimer */}
      <div style={{ padding: '10px 16px', background: 'var(--amber-light)', border: '1px solid var(--amber-border)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        ⚠️ <strong>Disclaimer:</strong> All behavioral flags are indicators only — not proof of theft or misconduct. Use for investigation guidance only.
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">🛡️ Security Status</div></div>
            <div className="card-body">
              {[
                { label: 'Billing Gap',      value: `${summary?.billing_gap_pct ?? 0}%`, status: summary?.billing_flagged ? 'CRITICAL' : 'NORMAL' },
                { label: 'Critical Alerts',  value: summary?.critical_alerts ?? 0,       status: (summary?.critical_alerts ?? 0) > 5 ? 'HIGH' : 'NORMAL' },
                { label: 'Camera Coverage',  value: `${summary?.coverage_score ?? 0}%`,  status: (summary?.coverage_score ?? 100) < 80 ? 'HIGH' : 'NORMAL' },
                { label: 'Overall Risk',     value: summary?.risk_level ?? '—',          status: summary?.risk_level ?? 'NORMAL' },
              ].map(s => (
                <div key={s.label} className="info-row">
                  <span className="info-label">{s.label}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="info-value">{s.value}</span>
                    <span className={`badge badge-${s.status}`}>{s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">🚩 Flag Suspicious Event</div></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Flag Type</label>
                <select className="form-input form-select" value={flagForm.flag_type} onChange={e => setFlagForm(p => ({ ...p, flag_type: e.target.value }))}>
                  {['loitering','fast_exit','billing_mismatch','other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Zone</label>
                <select className="form-input form-select" value={flagForm.zone} onChange={e => setFlagForm(p => ({ ...p, zone: e.target.value }))}>
                  <option value="">Select zone</option>
                  {['Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={flagForm.description} onChange={e => setFlagForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the suspicious behavior..."/>
              </div>
              <button className="btn btn-danger" style={{ width: '100%' }} onClick={submitFlag}>
                {flagSaved ? '✓ Flagged!' : '🚩 Submit Flag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspicious Behavior */}
      {tab === 'behavior' && behavior && (
        <div>
          {/* Loitering */}
          <div className="card mb-16">
            <div className="card-header">
              <div className="card-title">🚶 Loitering Cases ({behavior.loitering_cases?.length ?? 0})</div>
            </div>
            {!behavior.loitering_cases?.length ? (
              <div className="empty-state" style={{ padding: 32 }}><div className="empty-state-icon">✅</div><div>No loitering detected</div></div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>File</th><th>Person ID</th><th>Dwell (min)</th><th>Risk</th><th>Note</th></tr></thead>
                  <tbody>
                    {behavior.loitering_cases.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 11, fontFamily: 'var(--font-m)' }}>{c.filename?.slice(0, 20)}</td>
                        <td>#{c.person_id}</td>
                        <td style={{ fontWeight: 700, color: c.risk === 'HIGH' ? 'var(--red)' : 'var(--amber)' }}>{c.dwell_min}</td>
                        <td><span className={`badge badge-${c.risk}`}>{c.risk}</span></td>
                        <td style={{ fontSize: 11 }}>{c.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Fast exits */}
          <div className="card mb-16">
            <div className="card-header">
              <div className="card-title">🏃 Fast Exit Cases ({behavior.fast_exit_cases?.length ?? 0})</div>
            </div>
            {!behavior.fast_exit_cases?.length ? (
              <div className="empty-state" style={{ padding: 32 }}><div className="empty-state-icon">✅</div><div>No fast exits detected</div></div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>File</th><th>Person ID</th><th>Duration (s)</th><th>Risk</th><th>Note</th></tr></thead>
                  <tbody>
                    {behavior.fast_exit_cases.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 11, fontFamily: 'var(--font-m)' }}>{c.filename?.slice(0, 20)}</td>
                        <td>#{c.person_id}</td>
                        <td style={{ fontWeight: 700, color: 'var(--amber)' }}>{c.duration_sec}s</td>
                        <td><span className={`badge badge-${c.risk}`}>{c.risk}</span></td>
                        <td style={{ fontSize: 11 }}>{c.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Suspicious paths */}
          {behavior.suspicious_paths?.length > 0 && (
            <div className="card">
              <div className="card-header"><div className="card-title">🛤️ Suspicious Zone Paths</div></div>
              <div style={{ padding: 16 }}>
                {behavior.suspicious_paths.map((p, i) => (
                  <div key={i} style={{ padding: '12px 16px', background: 'var(--amber-light)', border: '1px solid var(--amber-border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.pattern}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Electronics: {p.electronics_visitors} visitors · Checkout: {p.checkout_visitors} visitors · Gap: {p.gap_pct}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Billing Mismatch */}
      {tab === 'mismatch' && mismatch && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🧾 Entry vs Billing Mismatch</div>
              <div className="card-subtitle">Large gap may indicate loss</div>
            </div>
            <span className={`badge badge-${mismatch.severity}`}>{mismatch.severity}</span>
          </div>
          <div className="card-body">
            <div className="grid-4 mb-16">
              {[
                { label: 'Total Entries', value: mismatch.total_entries, color: 'var(--brand)' },
                { label: 'Total Bills',   value: mismatch.total_bills,   color: 'var(--green)' },
                { label: 'Gap',           value: mismatch.gap,           color: 'var(--red)' },
                { label: 'Gap %',         value: `${mismatch.gap_pct}%`, color: mismatch.flagged ? 'var(--red)' : 'var(--green)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '14px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {mismatch.flagged && (
              <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--red)', marginBottom: 16 }}>
                🚨 {mismatch.recommendation}
              </div>
            )}
            {mismatch.daily?.length > 0 && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Entries</th><th>Bills</th><th>Gap</th><th>Gap %</th><th>Status</th></tr></thead>
                  <tbody>
                    {mismatch.daily.map(d => (
                      <tr key={d.date}>
                        <td style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>{d.date}</td>
                        <td>{d.entries}</td>
                        <td>{d.bills}</td>
                        <td style={{ color: d.gap > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{d.gap}</td>
                        <td>{d.gap_pct}%</td>
                        <td>{d.flagged ? <span className="badge badge-HIGH">Flagged</span> : <span className="badge badge-active">OK</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blind Spots */}
      {tab === 'blindspot' && blindSpots && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📷 Camera Coverage Analysis</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Coverage Score:</span>
              <span style={{ fontFamily: 'var(--font-d)', fontSize: 18, fontWeight: 700, color: blindSpots.coverage_score >= 80 ? 'var(--green)' : 'var(--red)' }}>{blindSpots.coverage_score}%</span>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {blindSpots.zones?.map(z => (
              <div key={z.zone} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px', background: z.status === 'COVERED' ? 'var(--green-light)' : z.status === 'BLIND_SPOT' ? 'var(--red-light)' : 'var(--amber-light)', borderRadius: 'var(--r)', border: `1px solid ${z.status === 'COVERED' ? 'var(--green-border)' : z.status === 'BLIND_SPOT' ? 'var(--red-border)' : 'var(--amber-border)'}`, marginBottom: 8 }}>
                <div style={{ fontSize: 18 }}>{z.status === 'COVERED' ? '✅' : z.status === 'BLIND_SPOT' ? '🔴' : '🟡'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{z.zone}</span>
                    <span className={`badge badge-${z.status === 'COVERED' ? 'active' : z.status === 'BLIND_SPOT' ? 'CRITICAL' : 'HIGH'}`}>{z.status}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{z.coverage_share}% of total footfall</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{z.recommendation}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flags */}
      {tab === 'flags' && (
        <div className="card">
          <div className="card-header"><div className="card-title">🚩 Manual Flags</div></div>
          {!flags.length ? (
            <div className="empty-state" style={{ padding: 48 }}><div className="empty-state-icon">🚩</div><div>No flags submitted yet</div></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Type</th><th>Zone</th><th>Description</th><th>Time</th></tr></thead>
                <tbody>
                  {flags.map(f => (
                    <tr key={f.id}>
                      <td><span className="badge badge-HIGH">{f.flag_type}</span></td>
                      <td>{f.zone || '—'}</td>
                      <td style={{ fontSize: 12 }}>{f.description}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-m)' }}>{new Date(f.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
