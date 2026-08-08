/* pages/Sales.jsx — Sales & Marketing Analytics */
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { API_BASE } from '../utils/api';

const TIER_COLOR = { peak: '#e53e3e', moderate: '#d97706', low: '#16a34a' };

function StatCard({ label, value, unit = '', color = 'var(--brand)', sub }) {
  return (
    <div className="stat-card-premium" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 3 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

const Tip = ({ content }) => (
  <div style={{ padding: '10px 14px', background: 'var(--brand-light)', border: '1px solid rgba(0,87,255,.12)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
    💡 {content}
  </div>
);

export default function Sales() {
  const [tab,        setTab]        = useState('conversion');
  const [conversion, setConversion] = useState(null);
  const [peakHours,  setPeakHours]  = useState(null);
  const [zoneInt,    setZoneInt]    = useState(null);
  const [promos,     setPromos]     = useState([]);
  const [repeat,     setRepeat]     = useState(null);
  const [loading,    setLoading]    = useState(true);

  // POS form
  const [posForm, setPosForm] = useState({ amount: '', items_count: 1, zone: 'Grocery', bill_number: '' });
  const [posSaved, setPosSaved] = useState(false);

  // Promo form
  const [promoForm, setPromoForm] = useState({ name: '', zone: '', discount_pct: 10, start_date: '', end_date: '' });
  const [promoSaved, setPromoSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/sales/conversion`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/sales/peak-hours`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/sales/zone-interest`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/sales/promotions`).then(r => r.json()).catch(() => ({ promotions: [] })),
      fetch(`${API_BASE}/sales/repeat-visitors`).then(r => r.json()).catch(() => null),
    ]).then(([c, p, z, pr, rv]) => {
      setConversion(c); setPeakHours(p); setZoneInt(z);
      setPromos(pr?.promotions || []); setRepeat(rv);
      setLoading(false);
    });
  }, []);

  const savePOS = async () => {
    await fetch(`${API_BASE}/sales/pos/transaction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...posForm, amount: parseFloat(posForm.amount) || 0 }),
    });
    setPosSaved(true); setTimeout(() => setPosSaved(false), 2000);
  };

  const savePromo = async () => {
    await fetch(`${API_BASE}/sales/promotions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...promoForm, discount_pct: parseFloat(promoForm.discount_pct) }),
    });
    setPromoSaved(true); setTimeout(() => setPromoSaved(false), 2000);
    const pr = await fetch(`${API_BASE}/sales/promotions`).then(r => r.json()).catch(() => ({ promotions: [] }));
    setPromos(pr.promotions || []);
  };

  const TABS = [
    { id: 'conversion', label: '💰 Conversion' },
    { id: 'peak',       label: '⏰ Peak Hours' },
    { id: 'zones',      label: '🗺️ Zone Interest' },
    { id: 'promos',     label: '🎯 Promotions' },
    { id: 'repeat',     label: '🔄 Repeat Visitors' },
  ];

  if (loading) return (
    <div>
      <div className="stat-grid stat-grid-4 mb-20">
        {[1,2,3,4].map(i => <div key={i} className="skeleton-kpi"/>)}
      </div>
      <div className="skeleton-chart"/>
    </div>
  );

  return (
    <div>
      {/* KPI row */}
      <div className="stat-grid stat-grid-4 mb-20">
        <StatCard label="Conversion Rate"  value={conversion?.conversion_rate ?? '—'} unit="%" color="var(--brand)"  sub="Footfall → purchase"/>
        <StatCard label="Total Revenue"    value={`₹${conversion?.total_revenue ?? 0}`}  color="var(--green)"  sub="From POS data"/>
        <StatCard label="Avg Bill Value"   value={`₹${conversion?.avg_bill_value ?? 0}`} color="var(--purple)" sub="Per transaction"/>
        <StatCard label="Repeat Rate"      value={repeat?.repeat_rate ?? '—'} unit="%" color="var(--amber)"  sub="Same-day re-entry"/>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Conversion Tab */}
      {tab === 'conversion' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">💰 Zone Conversion Rates</div>
            </div>
            <div className="card-body">
              {conversion?.zone_conversion && Object.entries(conversion.zone_conversion).map(([zone, d]) => (
                <div key={zone} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{zone}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.footfall} visitors</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: d.conversion > 15 ? 'var(--green)' : 'var(--amber)' }}>{d.conversion}%</span>
                      {d.gap === 'HIGH' && <span className="badge badge-HIGH">Gap</span>}
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(d.conversion * 3, 100)}%`, background: d.conversion > 15 ? 'var(--green)' : 'var(--amber)' }}/>
                  </div>
                </div>
              ))}
              {conversion?.insight && <Tip content={conversion.insight}/>}
            </div>
          </div>

          {/* Log POS Transaction */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🧾 Log POS Transaction</div>
              <div className="card-subtitle">Manually add sale data</div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Bill Number</label>
                <input className="form-input" value={posForm.bill_number} onChange={e => setPosForm(p => ({ ...p, bill_number: e.target.value }))} placeholder="BILL-001"/>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input className="form-input" type="number" value={posForm.amount} onChange={e => setPosForm(p => ({ ...p, amount: e.target.value }))} placeholder="450"/>
              </div>
              <div className="form-group">
                <label className="form-label">Zone</label>
                <select className="form-input form-select" value={posForm.zone} onChange={e => setPosForm(p => ({ ...p, zone: e.target.value }))}>
                  {['Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={savePOS}>
                {posSaved ? '✓ Saved!' : '+ Log Transaction'}
              </button>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Or use <strong>POST /enterprise/pos/sync</strong> for bulk POS import
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Peak Hours Tab */}
      {tab === 'peak' && peakHours && (
        <div>
          <div className="stat-grid stat-grid-3 mb-16">
            <StatCard label="Peak Hour"  value={peakHours.peak_hour}  color="var(--red)"   sub="Busiest time of day"/>
            <StatCard label="Peak Day"   value={peakHours.peak_day}   color="var(--amber)" sub="Busiest day of week"/>
            <StatCard label="Best Promo" value={peakHours.staffing_recommendation?.best_promo_time} color="var(--brand)" sub="Launch offers here"/>
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">⏰ Hourly Footfall Pattern</div></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={peakHours.hours} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} interval={2}/>
                    <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                    <Tooltip/>
                    <Bar dataKey="entries" name="Entries" radius={[3,3,0,0]}>
                      {peakHours.hours.map((h, i) => (
                        <Cell key={i} fill={TIER_COLOR[h.tier] || 'var(--brand)'}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">📅 Day-of-Week Pattern</div></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={peakHours.dow} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                    <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                    <Tooltip/>
                    <Bar dataKey="entries" name="Entries" fill="var(--brand)" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--r)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>📋 Staffing Recommendation</div>
                  <div style={{ color: 'var(--text-muted)' }}>Peak: <strong>{peakHours.staffing_recommendation?.peak_hours}</strong> — {peakHours.staffing_recommendation?.staff_needed}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zone Interest Tab */}
      {tab === 'zones' && zoneInt && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🗺️ Zone Interest vs Sales Gap</div>
            <div className="card-subtitle">High footfall + low conversion = display/pricing improvement needed</div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Zone</th><th>Footfall</th><th>Share</th><th>Bills</th><th>Conversion</th><th>Gap Score</th><th>Action</th></tr></thead>
              <tbody>
                {(zoneInt.zones || []).map(z => (
                  <tr key={z.zone}>
                    <td style={{ fontWeight: 600 }}>{z.zone}</td>
                    <td>{z.footfall}</td>
                    <td>{z.foot_share}%</td>
                    <td>{z.bills}</td>
                    <td><span style={{ color: z.conversion > 15 ? 'var(--green)' : 'var(--amber)', fontWeight: 700 }}>{z.conversion}%</span></td>
                    <td><span style={{ color: z.gap_score > 20 ? 'var(--red)' : z.gap_score > 10 ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>{z.gap_score}</span></td>
                    <td style={{ fontSize: 11 }}>{z.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Promotions Tab */}
      {tab === 'promos' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">🎯 Active Promotions</div></div>
            <div className="card-body">
              {promos.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">🎯</div><div>No promotions yet</div></div>
              ) : promos.map(p => (
                <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                    <span className={`badge badge-${p.status === 'active' ? 'active' : p.status === 'upcoming' ? 'LOW' : 'MEDIUM'}`}>{p.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {p.zone && `Zone: ${p.zone} · `}{p.discount_pct}% off · {p.start_date} → {p.end_date}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    <span>Before: <strong>{p.pre_footfall}</strong></span>
                    <span>During: <strong>{p.post_footfall}</strong></span>
                    <span style={{ color: p.footfall_lift > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                      {p.footfall_lift > 0 ? '↑' : '↓'} {Math.abs(p.footfall_lift)}% lift
                    </span>
                    {p.effective && <span className="badge badge-active">Effective</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">➕ Add Promotion</div></div>
            <div className="card-body">
              {[
                { label: 'Promotion Name', key: 'name', type: 'text', placeholder: 'Diwali Sale' },
                { label: 'Discount %',     key: 'discount_pct', type: 'number', placeholder: '20' },
                { label: 'Start Date',     key: 'start_date', type: 'date' },
                { label: 'End Date',       key: 'end_date',   type: 'date' },
              ].map(f => (
                <div key={f.key} className="form-group">
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" type={f.type} value={promoForm[f.key]}
                    onChange={e => setPromoForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}/>
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Zone (optional)</label>
                <select className="form-input form-select" value={promoForm.zone} onChange={e => setPromoForm(p => ({ ...p, zone: e.target.value }))}>
                  <option value="">All Zones</option>
                  {['Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={savePromo}>
                {promoSaved ? '✓ Saved!' : '+ Create Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repeat Visitors Tab */}
      {tab === 'repeat' && repeat && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">🔄 Repeat Visitor Analysis</div></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
                {[
                  { label: 'Total Visitors',   value: repeat.total_visitors,  color: 'var(--brand)' },
                  { label: 'Repeat Visitors',  value: repeat.repeat_visitors, color: 'var(--green)' },
                  { label: 'Repeat Rate',      value: `${repeat.repeat_rate}%`, color: 'var(--amber)' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '14px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-d)', fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <Tip content={repeat.insight}/>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">📹 By Job</div></div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>File</th><th>Visitors</th><th>Repeats</th><th>Rate</th></tr></thead>
                <tbody>
                  {(repeat.by_job || []).map(j => (
                    <tr key={j.job_id}>
                      <td style={{ fontSize: 11, fontFamily: 'var(--font-m)' }}>{j.filename?.slice(0, 20)}</td>
                      <td>{j.total_visitors}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 600 }}>{j.repeat_visitors}</td>
                      <td>{j.repeat_rate}%</td>
                    </tr>
                  ))}
                  {!repeat.by_job?.length && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
