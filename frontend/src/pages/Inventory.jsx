/* pages/Inventory.jsx — Inventory & Shelf Management */
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';

function StatCard({ label, value, unit = '', color = 'var(--brand)', sub }) {
  return (
    <div className="stat-card-premium" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-d)', fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 3 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

const URGENCY_COLOR = { CRITICAL: 'var(--red)', HIGH: 'var(--amber)', MEDIUM: 'var(--purple)', LOW: 'var(--green)' };
const SPEED_COLOR   = { FAST: 'var(--red)', MODERATE: 'var(--amber)', SLOW: 'var(--text-muted)' };

export default function Inventory() {
  const [tab,       setTab]       = useState('alerts');
  const [alerts,    setAlerts]    = useState(null);
  const [oos,       setOos]       = useState(null);
  const [shelves,   setShelves]   = useState(null);
  const [planogram, setPlanogram] = useState(null);
  const [lostSales, setLostSales] = useState(null);
  const [loading,   setLoading]   = useState(true);

  // Log shelf event form
  const [evForm, setEvForm]   = useState({ zone: 'Grocery', event_type: 'EMPTY' });
  const [evSaved, setEvSaved] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/inventory/restock-alerts`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/inventory/oos-duration`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/inventory/fast-slow-shelves`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/inventory/planogram`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/inventory/lost-sales`).then(r => r.json()).catch(() => null),
    ]).then(([a, o, s, p, l]) => {
      setAlerts(a); setOos(o); setShelves(s); setPlanogram(p); setLostSales(l);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const logEvent = async () => {
    await fetch(`${API_BASE}/inventory/shelf-event`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evForm),
    });
    setEvSaved(true); setTimeout(() => setEvSaved(false), 2000);
    load();
  };

  const markRestocked = async (id) => {
    if (typeof id === 'string' && id.startsWith('log_')) return;
    await fetch(`${API_BASE}/inventory/restock/${id}`, { method: 'POST' });
    load();
  };

  const TABS = [
    { id: 'alerts',    label: '🚨 Restock Alerts' },
    { id: 'oos',       label: '⏱️ OOS Duration' },
    { id: 'shelves',   label: '📦 Fast/Slow Shelves' },
    { id: 'planogram', label: '📐 Planogram' },
    { id: 'lost',      label: '💸 Lost Sales' },
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
        <StatCard label="Open Alerts"    value={alerts?.total_alerts ?? 0}                color="var(--red)"    sub="Unresolved restock"/>
        <StatCard label="Est. Lost Sales" value={`₹${alerts?.total_estimated_lost ?? 0}`} color="var(--amber)"  sub="From open alerts"/>
        <StatCard label="Total Lost"     value={`₹${lostSales?.total_lost_sales ?? 0}`}   color="var(--red)"    sub="All OOS events"/>
        <StatCard label="Planogram Score" value={`${planogram?.compliance_score ?? 100}%`} color="var(--green)"  sub="Layout compliance"/>
      </div>

      {/* Log shelf event */}
      <div className="card mb-20">
        <div className="card-header">
          <div className="card-title">📝 Log Shelf Event</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-input form-select" style={{ width: 140, padding: '6px 10px', fontSize: 12 }}
              value={evForm.zone} onChange={e => setEvForm(p => ({ ...p, zone: e.target.value }))}>
              {['Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
            </select>
            <select className="form-input form-select" style={{ width: 140, padding: '6px 10px', fontSize: 12 }}
              value={evForm.event_type} onChange={e => setEvForm(p => ({ ...p, event_type: e.target.value }))}>
              {['EMPTY','LOW_STOCK','RESTOCKED'].map(t => <option key={t}>{t}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={logEvent}>
              {evSaved ? '✓ Logged!' : '+ Log Event'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Restock Alerts */}
      {tab === 'alerts' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🚨 Active Restock Alerts</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click "Restocked" to resolve</span>
          </div>
          {!alerts?.alerts?.length ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">All shelves stocked</div>
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              {alerts.alerts.map((a, i) => (
                <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--r)', border: `1px solid var(--border)`, borderLeft: `4px solid ${URGENCY_COLOR[a.urgency] || 'var(--amber)'}`, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span className={`badge badge-${a.urgency}`}>{a.urgency}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{a.zone}</span>
                      <span className={`badge badge-${a.event_type === 'EMPTY' ? 'CRITICAL' : 'HIGH'}`}>{a.event_type}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Empty for <strong>{a.age_minutes} min</strong>
                      {a.estimated_lost_sales > 0 && <> · Est. lost: <strong style={{ color: 'var(--red)' }}>₹{a.estimated_lost_sales}</strong></>}
                    </div>
                    {a.message && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.message}</div>}
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={() => markRestocked(a.id)}>
                    ✓ Restocked
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OOS Duration */}
      {tab === 'oos' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">⏱️ Out-of-Stock Duration by Zone</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total OOS: <strong>{oos?.total_oos_min ?? 0} min</strong> · Lost: <strong style={{ color: 'var(--red)' }}>₹{oos?.total_lost_sales ?? 0}</strong></div>
          </div>
          {!oos?.zones?.length ? (
            <div className="empty-state" style={{ padding: 48 }}><div className="empty-state-icon">⏱️</div><div>No OOS events recorded yet</div></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Zone</th><th>Incidents</th><th>Total OOS (min)</th><th>Avg OOS (min)</th><th>Max OOS (min)</th><th>Est. Lost (₹)</th><th>Priority</th></tr></thead>
                <tbody>
                  {oos.zones.map(z => (
                    <tr key={z.zone}>
                      <td style={{ fontWeight: 600 }}>{z.zone}</td>
                      <td>{z.incidents}</td>
                      <td style={{ fontFamily: 'var(--font-m)' }}>{z.total_oos_min}</td>
                      <td style={{ fontFamily: 'var(--font-m)' }}>{z.avg_oos_min}</td>
                      <td style={{ fontFamily: 'var(--font-m)' }}>{z.max_oos_min}</td>
                      <td style={{ color: 'var(--red)', fontWeight: 700 }}>₹{z.estimated_lost}</td>
                      <td><span className={`badge badge-${z.priority}`}>{z.priority}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fast/Slow Shelves */}
      {tab === 'shelves' && (
        <div className="card">
          <div className="card-header"><div className="card-title">📦 Fast vs Slow Moving Shelves</div></div>
          {!shelves?.shelves?.length ? (
            <div className="empty-state" style={{ padding: 48 }}><div className="empty-state-icon">📦</div><div>No shelf data yet</div></div>
          ) : (
            <div style={{ padding: 16 }}>
              {shelves.shelves.map(s => (
                <div key={s.zone} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)', marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: SPEED_COLOR[s.speed], flexShrink: 0 }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{s.zone}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: SPEED_COLOR[s.speed] }}>{s.speed}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {s.empty_count} empty events · {s.footfall} visitors
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 200, textAlign: 'right' }}>{s.recommendation}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Planogram */}
      {tab === 'planogram' && planogram && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📐 Planogram Compliance</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Score:</span>
              <span style={{ fontFamily: 'var(--font-d)', fontSize: 18, fontWeight: 700, color: planogram.compliance_score >= 80 ? 'var(--green)' : 'var(--amber)' }}>{planogram.compliance_score}%</span>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {planogram.zones.map(z => (
              <div key={z.zone} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px', background: z.compliant ? 'var(--green-light)' : 'var(--red-light)', borderRadius: 'var(--r)', border: `1px solid ${z.compliant ? 'var(--green-border)' : 'var(--red-border)'}`, marginBottom: 8 }}>
                <div style={{ fontSize: 18 }}>{z.compliant ? '✅' : '⚠️'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{z.zone}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{z.footfall_share}% footfall share</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Expected: {z.expected_product} · Margin: {z.expected_margin}</div>
                  {z.issue && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{z.issue}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lost Sales */}
      {tab === 'lost' && lostSales && (
        <div className="grid-2">
          {[
            { label: 'Resolved Incidents',   value: lostSales.resolved_incidents,   color: 'var(--green)' },
            { label: 'Unresolved Incidents', value: lostSales.unresolved_incidents, color: 'var(--red)' },
            { label: 'Resolved Lost Sales',  value: `₹${lostSales.resolved_lost_sales}`,   color: 'var(--amber)' },
            { label: 'Active Lost Sales',    value: `₹${lostSales.unresolved_lost_sales}`,  color: 'var(--red)' },
          ].map(s => (
            <div key={s.label} className="stat-card-premium" style={{ borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-body">
              <div style={{ padding: '14px 16px', background: 'var(--amber-light)', border: '1px solid var(--amber-border)', borderRadius: 'var(--r)', fontSize: 13 }}>
                <strong>Total Estimated Lost Revenue: ₹{lostSales.total_lost_sales}</strong>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Based on ₹{lostSales.avg_per_minute}/min average sale rate during OOS periods
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
