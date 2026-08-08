/* pages/Compliance.jsx — Compliance & Safety Dashboard */
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

export default function Compliance() {
  const [tab,        setTab]        = useState('occupancy');
  const [summary,    setSummary]    = useState(null);
  const [occupancy,  setOccupancy]  = useState(null);
  const [blockage,   setBlockage]   = useState(null);
  const [retention,  setRetention]  = useState(null);
  const [loading,    setLoading]    = useState(true);

  // Occupancy log form
  const [occForm, setOccForm] = useState({ zone: 'store', count: '' });
  const [occSaved, setOccSaved] = useState(false);

  // Blockage flag form
  const [blkForm, setBlkForm] = useState({ zone: 'Entrance', location: '', blocked_by: 'boxes', severity: 'HIGH', description: '' });
  const [blkSaved, setBlkSaved] = useState(false);

  // Retention form
  const [retForm, setRetForm] = useState({ retention_days: 30, dry_run: true });
  const [retResult, setRetResult] = useState(null);
  const [retRunning, setRetRunning] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/compliance/summary`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/compliance/occupancy`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/compliance/aisle-blockage`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/compliance/cctv-retention`).then(r => r.json()).catch(() => null),
    ]).then(([s, o, b, r]) => {
      setSummary(s); setOccupancy(o); setBlockage(b); setRetention(r);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const logOccupancy = async () => {
    await fetch(`${API_BASE}/compliance/occupancy/log`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...occForm, count: parseInt(occForm.count) || 0 }),
    });
    setOccSaved(true); setTimeout(() => setOccSaved(false), 2000);
    load();
  };

  const flagBlockage = async () => {
    await fetch(`${API_BASE}/compliance/aisle-blockage/flag`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blkForm),
    });
    setBlkSaved(true); setTimeout(() => setBlkSaved(false), 2000);
    load();
  };

  const resolveBlockage = async (id) => {
    await fetch(`${API_BASE}/compliance/aisle-blockage/${id}/resolve`, { method: 'POST' });
    load();
  };

  const runRetention = async () => {
    setRetRunning(true); setRetResult(null);
    const res = await fetch(`${API_BASE}/compliance/cctv-retention/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retForm),
    }).then(r => r.json()).catch(() => null);
    setRetResult(res); setRetRunning(false);
    if (!retForm.dry_run) load();
  };

  const TABS = [
    { id: 'occupancy', label: '👥 Occupancy Limits' },
    { id: 'blockage',  label: `🚧 Aisle Blockage${blockage?.total_open > 0 ? ` (${blockage.total_open})` : ''}` },
    { id: 'cctv',      label: '🎥 CCTV Retention' },
  ];

  const STATUS_COLOR = { COMPLIANT: 'var(--green)', NEEDS_ATTENTION: 'var(--amber)', NON_COMPLIANT: 'var(--red)', ACTION_REQUIRED: 'var(--red)' };

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
        <StatCard label="Compliance Score"   value={`${summary?.compliance_score ?? 100}%`} color={summary?.compliance_score >= 90 ? 'var(--green)' : summary?.compliance_score >= 70 ? 'var(--amber)' : 'var(--red)'} sub="Overall compliance"/>
        <StatCard label="Occupancy Breaches" value={summary?.occupancy_breaches ?? 0}       color={summary?.occupancy_breaches > 0 ? 'var(--red)' : 'var(--green)'} sub="Total capacity violations"/>
        <StatCard label="Open Blockages"     value={summary?.open_blockages ?? 0}           color={summary?.open_blockages > 0 ? 'var(--red)' : 'var(--green)'} sub="Unresolved aisle/exit blocks"/>
        <StatCard label="Overdue Footage"    value={summary?.overdue_footage ?? 0}          color={summary?.overdue_footage > 0 ? 'var(--amber)' : 'var(--green)'} sub="Beyond retention policy"/>
      </div>

      {/* Status banner */}
      <div style={{ padding: '10px 16px', background: summary?.status === 'COMPLIANT' ? 'var(--green-light)' : 'var(--amber-light)', border: `1px solid ${summary?.status === 'COMPLIANT' ? 'var(--green-border)' : 'var(--amber-border)'}`, borderRadius: 'var(--r)', fontSize: 12, marginBottom: 16 }}>
        {summary?.status === 'COMPLIANT' ? '✅' : '⚠️'} <strong>Status: {summary?.status || '—'}</strong>
        {summary?.status !== 'COMPLIANT' && ' — Review flagged items below'}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Occupancy */}
      {tab === 'occupancy' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">👥 Zone Occupancy Status</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{occupancy?.total_breaches_7d || 0} breaches in last 7 days</span>
            </div>
            {!occupancy?.zones?.length ? (
              <div className="empty-state" style={{ padding: 48 }}>
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">No occupancy data yet</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log occupancy readings using the form</div>
              </div>
            ) : (
              <div style={{ padding: 16 }}>
                {occupancy.zones.map(z => {
                  const pct = z.pct || 0;
                  return (
                    <div key={z.zone} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{z.zone}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-d)', fontSize: 15, fontWeight: 700, color: z.status === 'BREACHED' ? 'var(--red)' : z.status === 'WARNING' ? 'var(--amber)' : 'var(--green)' }}>
                            {z.current}/{z.max_capacity}
                          </span>
                          <span className={`badge badge-${z.status === 'BREACHED' ? 'CRITICAL' : z.status === 'WARNING' ? 'HIGH' : 'active'}`}>{z.status}</span>
                        </div>
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)', borderRadius: 3, transition: 'width .3s' }}/>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{pct}% capacity · Last updated: {z.last_updated}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📊 Log Occupancy Reading</div></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Zone</label>
                <select className="form-input form-select" value={occForm.zone} onChange={e => setOccForm(p => ({ ...p, zone: e.target.value }))}>
                  {['store','Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Current Count</label>
                <input className="form-input" type="number" value={occForm.count} onChange={e => setOccForm(p => ({ ...p, count: e.target.value }))} placeholder="Number of people currently in zone"/>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                Zone capacities: {Object.entries(occupancy?.zone_capacities || {}).map(([z, c]) => `${z}: ${c}`).join(' · ')}
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={logOccupancy}>
                {occSaved ? '✓ Logged!' : '📊 Log Occupancy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aisle Blockage */}
      {tab === 'blockage' && (
        <div>
          {blockage?.status !== 'CLEAR' && (
            <div style={{ padding: '10px 16px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--red)', marginBottom: 16 }}>
              🚨 <strong>{blockage?.total_open} open blockage(s)</strong> — Fire exits and emergency aisles must remain clear at all times.
            </div>
          )}

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <div className="card-title">🚧 Open Blockages</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{blockage?.total_open || 0} open</span>
              </div>
              {!blockage?.open_flags?.length ? (
                <div className="empty-state" style={{ padding: 48 }}>
                  <div className="empty-state-icon">✅</div>
                  <div>All aisles and exits clear</div>
                </div>
              ) : (
                <div style={{ padding: 16 }}>
                  {blockage.open_flags.map(f => (
                    <div key={f.id} style={{ padding: '12px 14px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{f.location}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>in {f.zone}</span>
                        </div>
                        <span className={`badge badge-${f.severity}`}>{f.severity}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Blocked by: {f.blocked_by}</div>
                      {f.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{f.description}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(f.reported_at).toLocaleString()}</span>
                        <button className="btn btn-sm btn-secondary" onClick={() => resolveBlockage(f.id)}>✓ Resolve</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">🚧 Report Blockage</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Zone</label>
                  <select className="form-input form-select" value={blkForm.zone} onChange={e => setBlkForm(p => ({ ...p, zone: e.target.value }))}>
                    {['Entrance','Electronics','Apparel','Grocery','Checkout','Fire Exit','Emergency Aisle'].map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={blkForm.location} onChange={e => setBlkForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Fire Exit A, Aisle 3"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Blocked By</label>
                  <select className="form-input form-select" value={blkForm.blocked_by} onChange={e => setBlkForm(p => ({ ...p, blocked_by: e.target.value }))}>
                    {['boxes','trolley','display_stand','person','other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select className="form-input form-select" value={blkForm.severity} onChange={e => setBlkForm(p => ({ ...p, severity: e.target.value }))}>
                    {['CRITICAL','HIGH','MEDIUM'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={flagBlockage}>
                  {blkSaved ? '✓ Flagged!' : '🚧 Report Blockage'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CCTV Retention */}
      {tab === 'cctv' && (
        <div>
          <div style={{ padding: '10px 16px', background: 'var(--brand-light)', border: '1px solid rgba(0,87,255,.1)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            ⚖️ <strong>GDPR/PDPA Note:</strong> {retention?.gdpr_note}
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <div className="card-title">🎥 Retention Policy Status</div>
                <span className={`badge badge-${retention?.compliance_status === 'COMPLIANT' ? 'active' : 'HIGH'}`}>{retention?.compliance_status}</span>
              </div>
              <div className="card-body">
                {[
                  { label: 'Retention Policy',    value: `${retention?.retention_policy_days || 30} days` },
                  { label: 'Total Jobs',           value: retention?.total_jobs || 0 },
                  { label: 'Within Retention',     value: retention?.within_retention?.length || 0 },
                  { label: 'Eligible for Deletion', value: retention?.deletion_count || 0 },
                ].map(s => (
                  <div key={s.label} className="info-row">
                    <span className="info-label">{s.label}</span>
                    <span className="info-value" style={{ color: s.label === 'Eligible for Deletion' && s.value > 0 ? 'var(--amber)' : 'inherit' }}>{s.value}</span>
                  </div>
                ))}
              </div>

              {retention?.eligible_for_deletion?.length > 0 && (
                <div style={{ padding: '0 16px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--amber)' }}>⚠️ Eligible for deletion:</div>
                  {retention.eligible_for_deletion.slice(0, 5).map(j => (
                    <div key={j.job_id} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      {j.filename} · {j.age_days} days old · completed {j.completed}
                    </div>
                  ))}
                  {retention.eligible_for_deletion.length > 5 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>+{retention.eligible_for_deletion.length - 5} more</div>
                  )}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">🗑️ Run Retention Policy</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Retention Period (days)</label>
                  <input className="form-input" type="number" value={retForm.retention_days} onChange={e => setRetForm(p => ({ ...p, retention_days: parseInt(e.target.value) || 30 }))}/>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={retForm.dry_run} onChange={e => setRetForm(p => ({ ...p, dry_run: e.target.checked }))}/>
                    Dry Run (simulate only — no actual deletion)
                  </label>
                </div>
                {!retForm.dry_run && (
                  <div style={{ padding: '8px 12px', background: 'var(--red-light)', border: '1px solid var(--red-border)', borderRadius: 'var(--r)', fontSize: 11, color: 'var(--red)', marginBottom: 12 }}>
                    ⚠️ This will permanently delete job records from the database. This action cannot be undone.
                  </div>
                )}
                <button className={`btn ${retForm.dry_run ? 'btn-secondary' : 'btn-danger'}`} style={{ width: '100%' }} onClick={runRetention} disabled={retRunning}>
                  {retRunning ? '⏳ Running...' : retForm.dry_run ? '🔍 Simulate Deletion' : '🗑️ Execute Deletion'}
                </button>

                {retResult && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{retResult.message}</div>
                    {retResult.warning && <div style={{ fontSize: 11, color: 'var(--amber)' }}>⚠️ {retResult.warning}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
