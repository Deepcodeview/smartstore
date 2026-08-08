/* pages/Engagement.jsx — Customer Engagement Dashboard */
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

const PATTERN_COLOR = { FRUSTRATION: 'var(--red)', AVOIDANCE: 'var(--amber)', ENGAGED: 'var(--green)', NEUTRAL: 'var(--text-muted)', INSUFFICIENT_DATA: 'var(--text-light)' };
const STARS = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export default function Engagement() {
  const [tab,      setTab]      = useState('signage');
  const [summary,  setSummary]  = useState(null);
  const [signage,  setSignage]  = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [offers,   setOffers]   = useState(null);
  const [loading,  setLoading]  = useState(true);

  // Signage trigger form
  const [sigForm, setSigForm] = useState({ zone: 'Electronics', offer_text: '', duration_sec: 30 });
  const [sigSaved, setSigSaved] = useState(false);

  // Feedback form
  const [fbForm, setFbForm] = useState({ zone: 'Checkout', rating: 4, comment: '', customer_id: '' });
  const [fbSaved, setFbSaved] = useState(false);

  // Loyalty register form
  const [loyForm, setLoyForm] = useState({ customer_id: '', name: '', phone: '', opt_in: true });
  const [loySaved, setLoySaved] = useState(false);

  // Offer trigger form
  const [offerForm, setOfferForm] = useState({ customer_id: '', zone: 'Electronics', offer_text: '' });
  const [offerSaved, setOfferSaved] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/engagement/summary`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/engagement/signage/active`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/engagement/feedback/analysis`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/engagement/offers`).then(r => r.json()).catch(() => null),
    ]).then(([s, sg, fb, o]) => {
      setSummary(s); setSignage(sg); setFeedback(fb); setOffers(o);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const triggerSignage = async () => {
    await fetch(`${API_BASE}/engagement/signage/trigger`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sigForm, triggered_by: 'manual' }),
    });
    setSigSaved(true); setTimeout(() => setSigSaved(false), 2000);
    load();
  };

  const submitFeedback = async () => {
    await fetch(`${API_BASE}/engagement/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fbForm),
    });
    setFbSaved(true); setTimeout(() => setFbSaved(false), 2000);
    load();
  };

  const registerLoyalty = async () => {
    await fetch(`${API_BASE}/engagement/offers/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loyForm),
    });
    setLoySaved(true); setTimeout(() => setLoySaved(false), 2000);
    load();
  };

  const triggerOffer = async () => {
    const res = await fetch(`${API_BASE}/engagement/offers/trigger`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offerForm),
    }).then(r => r.json()).catch(() => null);
    setOfferSaved(res?.status === 'sent' ? '✓ Notification sent!' : res?.error || 'Error');
    setTimeout(() => setOfferSaved(''), 3000);
    load();
  };

  const TABS = [
    { id: 'signage',  label: '📺 Digital Signage' },
    { id: 'feedback', label: '⭐ Feedback Analysis' },
    { id: 'offers',   label: '🎁 Personalized Offers' },
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
        <StatCard label="Avg Store Rating"    value={summary?.avg_rating ? `${summary.avg_rating}/5` : '—'} color={summary?.avg_rating >= 4 ? 'var(--green)' : summary?.avg_rating >= 3 ? 'var(--amber)' : 'var(--red)'} sub="Customer feedback score"/>
        <StatCard label="Loyalty Customers"   value={summary?.loyalty_customers ?? 0}                       color="var(--brand)"  sub={`${summary?.opted_in ?? 0} opted in`}/>
        <StatCard label="Active Signage"      value={summary?.active_signage ?? 0}                          color="var(--purple)" sub="Screens showing offers"/>
        <StatCard label="Notifications Sent"  value={summary?.total_notifications ?? 0}                     color="var(--green)"  sub="Push offers delivered"/>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Digital Signage */}
      {tab === 'signage' && (
        <div className="grid-2">
          <div>
            {/* Active triggers */}
            <div className="card mb-16">
              <div className="card-header">
                <div className="card-title">📺 Active Signage Triggers</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{signage?.total_active || 0} active</span>
              </div>
              {!signage?.active?.length ? (
                <div className="empty-state" style={{ padding: 32 }}>
                  <div className="empty-state-icon">📺</div>
                  <div>No active signage triggers</div>
                </div>
              ) : (
                <div style={{ padding: 16 }}>
                  {signage.active.map(t => (
                    <div key={t.id} style={{ padding: '10px 14px', background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>📺 {t.screen_id}</span>
                        <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>LIVE</span>
                      </div>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>{t.offer_text}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Zone: {t.zone} · Expires: {new Date(t.expires_at).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zone offers reference */}
            <div className="card">
              <div className="card-header"><div className="card-title">🏷️ Default Zone Offers</div></div>
              <div style={{ padding: 16 }}>
                {Object.entries(signage?.zone_offers || {}).map(([zone, offer]) => (
                  <div key={zone} className="info-row">
                    <span className="info-label">{zone}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{offer}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📺 Trigger Signage Manually</div></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Zone</label>
                <select className="form-input form-select" value={sigForm.zone} onChange={e => setSigForm(p => ({ ...p, zone: e.target.value }))}>
                  {['Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Custom Offer Text (optional)</label>
                <input className="form-input" value={sigForm.offer_text} onChange={e => setSigForm(p => ({ ...p, offer_text: e.target.value }))} placeholder="Leave blank to use zone default"/>
              </div>
              <div className="form-group">
                <label className="form-label">Duration (seconds)</label>
                <input className="form-input" type="number" value={sigForm.duration_sec} onChange={e => setSigForm(p => ({ ...p, duration_sec: parseInt(e.target.value) || 30 }))}/>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={triggerSignage}>
                {sigSaved ? '✓ Triggered!' : '📺 Trigger Signage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Analysis */}
      {tab === 'feedback' && (
        <div>
          {feedback?.insight && (
            <div style={{ padding: '10px 16px', background: 'var(--brand-light)', border: '1px solid rgba(0,87,255,.1)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              💡 {feedback.insight}
            </div>
          )}

          <div className="grid-2">
            <div>
              {/* Zone analysis */}
              <div className="card mb-16">
                <div className="card-header">
                  <div className="card-title">⭐ Zone Feedback Analysis</div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{feedback?.total || 0} responses</span>
                </div>
                {!feedback?.zones?.length ? (
                  <div className="empty-state" style={{ padding: 48 }}>
                    <div className="empty-state-icon">⭐</div>
                    <div className="empty-state-title">No feedback yet</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Submit feedback using the form to see zone analysis</div>
                  </div>
                ) : (
                  <div style={{ padding: 16 }}>
                    {feedback.zones.map(z => (
                      <div key={z.zone} style={{ padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{z.zone}</span>
                          <span style={{ fontSize: 11, color: PATTERN_COLOR[z.pattern], fontWeight: 600 }}>{z.pattern}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 4 }}>
                          {z.avg_rating != null && (
                            <span style={{ color: z.avg_rating >= 4 ? 'var(--green)' : z.avg_rating >= 3 ? 'var(--amber)' : 'var(--red)' }}>
                              {STARS(Math.round(z.avg_rating))} {z.avg_rating}/5
                            </span>
                          )}
                          {z.avg_dwell_min != null && <span style={{ color: 'var(--text-muted)' }}>⏱ {z.avg_dwell_min}min avg dwell</span>}
                          <span style={{ color: 'var(--text-muted)' }}>{z.feedback_count} responses</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{z.recommendation}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">⭐ Submit Feedback</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Last Zone Visited</label>
                  <select className="form-input form-select" value={fbForm.zone} onChange={e => setFbForm(p => ({ ...p, zone: e.target.value }))}>
                    {['Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Rating: {STARS(fbForm.rating)}</label>
                  <input type="range" min={1} max={5} value={fbForm.rating} onChange={e => setFbForm(p => ({ ...p, rating: parseInt(e.target.value) }))} style={{ width: '100%' }}/>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                    <span>1 - Poor</span><span>5 - Excellent</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Comment (optional)</label>
                  <input className="form-input" value={fbForm.comment} onChange={e => setFbForm(p => ({ ...p, comment: e.target.value }))} placeholder="Any feedback..."/>
                </div>
                <div className="form-group">
                  <label className="form-label">Loyalty ID (optional)</label>
                  <input className="form-input" value={fbForm.customer_id} onChange={e => setFbForm(p => ({ ...p, customer_id: e.target.value }))} placeholder="e.g. CUST001"/>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={submitFeedback}>
                  {fbSaved ? '✓ Submitted!' : '⭐ Submit Feedback'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Personalized Offers */}
      {tab === 'offers' && (
        <div>
          <div className="grid-2 mb-16">
            {/* Register loyalty customer */}
            <div className="card">
              <div className="card-header"><div className="card-title">🎁 Register Loyalty Customer</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Customer ID</label>
                  <input className="form-input" value={loyForm.customer_id} onChange={e => setLoyForm(p => ({ ...p, customer_id: e.target.value }))} placeholder="e.g. CUST001"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="form-input" value={loyForm.name} onChange={e => setLoyForm(p => ({ ...p, name: e.target.value }))} placeholder="Customer name"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={loyForm.phone} onChange={e => setLoyForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX"/>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={loyForm.opt_in} onChange={e => setLoyForm(p => ({ ...p, opt_in: e.target.checked }))}/>
                    Opt-in to personalized notifications
                  </label>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={registerLoyalty}>
                  {loySaved ? '✓ Registered!' : '🎁 Register Customer'}
                </button>
              </div>
            </div>

            {/* Trigger offer */}
            <div className="card">
              <div className="card-header"><div className="card-title">📲 Send Personalized Offer</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Customer ID</label>
                  <select className="form-input form-select" value={offerForm.customer_id} onChange={e => setOfferForm(p => ({ ...p, customer_id: e.target.value }))}>
                    <option value="">Select customer</option>
                    {(offers?.customers || []).map(c => <option key={c.customer_id} value={c.customer_id}>{c.name} ({c.customer_id})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Zone (customer is in)</label>
                  <select className="form-input form-select" value={offerForm.zone} onChange={e => setOfferForm(p => ({ ...p, zone: e.target.value }))}>
                    {['Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Custom Offer (optional)</label>
                  <input className="form-input" value={offerForm.offer_text} onChange={e => setOfferForm(p => ({ ...p, offer_text: e.target.value }))} placeholder="Leave blank for zone default"/>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={triggerOffer} disabled={!offerForm.customer_id}>
                  {offerSaved || '📲 Send Notification'}
                </button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                  Simulated — connect FCM/SMS API in production
                </div>
              </div>
            </div>
          </div>

          {/* Loyalty customers list */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">👥 Loyalty Customers</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{offers?.total_loyalty_customers || 0} registered · {offers?.opted_in || 0} opted in</span>
            </div>
            {!offers?.customers?.length ? (
              <div className="empty-state" style={{ padding: 48 }}>
                <div className="empty-state-icon">🎁</div>
                <div className="empty-state-title">No loyalty customers yet</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Register customers above to enable personalized offers</div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Customer ID</th><th>Name</th><th>Phone</th><th>Opt-in</th><th>Visits</th><th>Registered</th></tr></thead>
                  <tbody>
                    {offers.customers.map(c => (
                      <tr key={c.customer_id}>
                        <td style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>{c.customer_id}</td>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td style={{ fontSize: 12 }}>{c.phone || '—'}</td>
                        <td>{c.opt_in ? <span className="badge badge-active">Yes</span> : <span className="badge badge-inactive">No</span>}</td>
                        <td>{c.visit_count || 0}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(c.registered_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
