/* pages/StaffOps.jsx — Staff & Operations Dashboard */
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
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
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 12 }}>
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

const STATUS_COLOR = { UNDERSTAFFED: 'var(--red)', OVERSTAFFED: 'var(--amber)', OPTIMAL: 'var(--green)', OK: 'var(--green)', WARNING: 'var(--amber)', CRITICAL: 'var(--red)', NEEDS_ATTENTION: 'var(--red)' };

export default function StaffOps() {
  const [tab,        setTab]        = useState('productivity');
  const [summary,    setSummary]    = useState(null);
  const [productivity, setProductivity] = useState(null);
  const [shifts,     setShifts]     = useState(null);
  const [checkout,   setCheckout]   = useState(null);
  const [loading,    setLoading]    = useState(true);

  // Log activity form
  const [actForm, setActForm] = useState({ staff_id: '', zone: 'Entrance', duration_min: '' });
  const [actSaved, setActSaved] = useState(false);

  // Self-checkout event form
  const [coForm, setCoForm] = useState({ counter_id: 'SC-1', event_type: 'completed', duration_sec: '' });
  const [coSaved, setCoSaved] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/staff/summary`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/staff/productivity`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/staff/shift-optimization`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/staff/self-checkout`).then(r => r.json()).catch(() => null),
    ]).then(([s, p, sh, c]) => {
      setSummary(s); setProductivity(p); setShifts(sh); setCheckout(c);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const logActivity = async () => {
    await fetch(`${API_BASE}/staff/log-activity`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...actForm, duration_min: parseFloat(actForm.duration_min) || 0 }),
    });
    setActSaved(true); setTimeout(() => setActSaved(false), 2000);
    load();
  };

  const logCheckout = async () => {
    await fetch(`${API_BASE}/staff/self-checkout/event`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...coForm, duration_sec: parseFloat(coForm.duration_sec) || null }),
    });
    setCoSaved(true); setTimeout(() => setCoSaved(false), 2000);
    load();
  };

  const TABS = [
    { id: 'productivity', label: '👤 Productivity' },
    { id: 'shifts',       label: '🕐 Shift Optimization' },
    { id: 'checkout',     label: '🛒 Self-Checkout' },
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
        <StatCard label="Staff Logged"       value={summary?.total_staff_logged ?? 0}    color="var(--brand)"  sub="Unique staff IDs"/>
        <StatCard label="Total Staff Time"   value={`${summary?.total_staff_time_min ?? 0}m`} color="var(--purple)" sub="Across all zones"/>
        <StatCard label="Checkout Errors"    value={summary?.self_checkout_errors ?? 0}  color={summary?.self_checkout_errors > 0 ? 'var(--red)' : 'var(--green)'} sub="Self-checkout issues"/>
        <StatCard label="Error Rate"         value={`${summary?.error_rate ?? 0}%`}      color={summary?.error_rate > 10 ? 'var(--red)' : 'var(--green)'} sub="Self-checkout error rate"/>
      </div>

      <div style={{ padding: '10px 16px', background: 'var(--brand-light)', border: '1px solid rgba(0,87,255,.1)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        🔒 <strong>Privacy Notice:</strong> {productivity?.privacy_note || 'Staff tracking requires explicit consent per local labor laws.'}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Productivity */}
      {tab === 'productivity' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">👤 Staff vs Customer Load by Zone</div></div>
            {!productivity?.zones?.length ? (
              <div className="empty-state" style={{ padding: 48 }}>
                <div className="empty-state-icon">👤</div>
                <div className="empty-state-title">No staff activity logged yet</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Use the form to log staff zone activity</div>
              </div>
            ) : (
              <div style={{ padding: 16 }}>
                {productivity.zones.map(z => (
                  <div key={z.zone} style={{ padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{z.zone}</span>
                      <span className={`badge badge-${z.status === 'OPTIMAL' ? 'active' : z.status === 'UNDERSTAFFED' ? 'CRITICAL' : 'HIGH'}`}>{z.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      <span>👥 {z.customer_footfall} customers</span>
                      <span>🧑‍💼 {z.unique_staff} staff · {z.staff_time_min}min</span>
                    </div>
                    <div style={{ fontSize: 11, color: STATUS_COLOR[z.status] || 'var(--text-secondary)' }}>{z.recommendation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📝 Log Staff Activity</div></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Staff ID</label>
                <input className="form-input" value={actForm.staff_id} onChange={e => setActForm(p => ({ ...p, staff_id: e.target.value }))} placeholder="e.g. staff_001"/>
              </div>
              <div className="form-group">
                <label className="form-label">Zone</label>
                <select className="form-input form-select" value={actForm.zone} onChange={e => setActForm(p => ({ ...p, zone: e.target.value }))}>
                  {['Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Duration (minutes)</label>
                <input className="form-input" type="number" value={actForm.duration_min} onChange={e => setActForm(p => ({ ...p, duration_min: e.target.value }))} placeholder="e.g. 45"/>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={logActivity}>
                {actSaved ? '✓ Logged!' : '📝 Log Activity'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Optimization */}
      {tab === 'shifts' && shifts && (
        <div>
          <div style={{ padding: '10px 16px', background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            💡 <strong>Insight:</strong> {shifts.insight}
          </div>

          <div className="card mb-16">
            <div className="card-header">
              <div className="card-title">🕐 Recommended Staff by Hour</div>
              <div className="card-subtitle">1 staff per {shifts.staff_per_customers} customers · Min {shifts.min_staff} staff</div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={shifts.hourly.filter(h => h.avg_footfall > 0 || h.hour >= 8 && h.hour <= 22)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{ fontSize: 12 }}/>
                  <Bar dataKey="recommended_staff" name="Recommended Staff" fill="#0057ff" radius={[4,4,0,0]}/>
                  <Bar dataKey="avg_footfall"       name="Avg Footfall"     fill="#e2e8f0" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📅 Recommended Staff by Day</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={shifts.by_day} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{ fontSize: 12 }}/>
                  <Bar dataKey="recommended_staff" name="Recommended Staff"
                    fill="#0057ff" radius={[4,4,0,0]}
                    label={{ position: 'top', fontSize: 10, fill: 'var(--text-muted)' }}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Self-Checkout */}
      {tab === 'checkout' && (
        <div>
          {checkout?.status !== 'NO_DATA' && (
            <div className="stat-grid stat-grid-4 mb-16">
              <StatCard label="Total Events"    value={checkout?.total_events ?? 0}    color="var(--brand)"  sub="All checkout events"/>
              <StatCard label="Completed"       value={checkout?.completed ?? 0}       color="var(--green)"  sub="Successful checkouts"/>
              <StatCard label="Errors"          value={checkout?.errors ?? 0}          color={checkout?.errors > 0 ? 'var(--red)' : 'var(--green)'} sub="Error events"/>
              <StatCard label="Error Rate"      value={`${checkout?.error_rate ?? 0}%`} color={checkout?.error_rate > 10 ? 'var(--red)' : 'var(--green)'} sub="Error percentage"/>
            </div>
          )}

          {checkout?.status !== 'NO_DATA' && checkout?.recommendation && (
            <div style={{ padding: '10px 16px', background: checkout.status === 'OK' ? 'var(--green-light)' : 'var(--amber-light)', border: `1px solid ${checkout.status === 'OK' ? 'var(--green-border)' : 'var(--amber-border)'}`, borderRadius: 'var(--r)', fontSize: 12, marginBottom: 16 }}>
              {checkout.status === 'OK' ? '✅' : '⚠️'} {checkout.recommendation}
            </div>
          )}

          <div className="grid-2">
            {checkout?.counters?.length > 0 && (
              <div className="card">
                <div className="card-header"><div className="card-title">🛒 Counter Status</div></div>
                <div style={{ padding: 16 }}>
                  {checkout.counters.map(c => (
                    <div key={c.counter_id} style={{ padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{c.counter_id}</span>
                        <span className={`badge badge-${c.status === 'OK' ? 'active' : 'HIGH'}`}>{c.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                        <span>Total: {c.total}</span>
                        <span style={{ color: c.errors > 0 ? 'var(--red)' : 'inherit' }}>Errors: {c.errors}</span>
                        <span>Error rate: {c.error_rate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><div className="card-title">📝 Log Checkout Event</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Counter ID</label>
                  <input className="form-input" value={coForm.counter_id} onChange={e => setCoForm(p => ({ ...p, counter_id: e.target.value }))} placeholder="e.g. SC-1"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Event Type</label>
                  <select className="form-input form-select" value={coForm.event_type} onChange={e => setCoForm(p => ({ ...p, event_type: e.target.value }))}>
                    {['completed','error','assistance_needed','abandoned'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (seconds)</label>
                  <input className="form-input" type="number" value={coForm.duration_sec} onChange={e => setCoForm(p => ({ ...p, duration_sec: e.target.value }))} placeholder="e.g. 120"/>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={logCheckout}>
                  {coSaved ? '✓ Logged!' : '📝 Log Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
