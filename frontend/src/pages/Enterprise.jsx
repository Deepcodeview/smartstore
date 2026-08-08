/* pages/Enterprise.jsx — Multi-Store & Integrations */
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

const INTG_META = {
  whatsapp: { icon: '💬', label: 'WhatsApp Business', desc: 'Instant alerts to staff phones', color: '#25D366' },
  pos:      { icon: '🧾', label: 'POS System',        desc: 'Sync billing data for conversion', color: 'var(--brand)' },
  erp:      { icon: '🏭', label: 'ERP / Inventory',   desc: 'Auto restock orders on shelf empty', color: 'var(--purple)' },
  slack:    { icon: '💼', label: 'Slack',              desc: 'Team notifications channel', color: '#4A154B' },
  email:    { icon: '📧', label: 'Email Alerts',       desc: 'Daily summary + critical alerts', color: 'var(--amber)' },
};

export default function Enterprise() {
  const [tab,       setTab]       = useState('central');
  const [central,   setCentral]   = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [weather,   setWeather]   = useState(null);
  const [intgs,     setIntgs]     = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Store form
  const [storeForm, setStoreForm] = useState({ id: '', name: '', location: '', manager_email: '', whatsapp_number: '' });
  const [storeSaved, setStoreSaved] = useState(false);

  // WhatsApp form
  const [waForm, setWaForm]   = useState({ phone: '', message: '', alert_type: 'INFO' });
  const [waSent, setWaSent]   = useState(null);

  // ERP form
  const [erpForm, setErpForm] = useState({ zone: 'Grocery', quantity: 1, urgency: 'NORMAL' });
  const [erpSent, setErpSent] = useState(null);

  // Integration config
  const [intgConfig, setIntgConfig] = useState({});
  const [intgSaved,  setIntgSaved]  = useState('');
  const [testResult, setTestResult] = useState({});

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/enterprise/central-ops`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/enterprise/benchmark`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/enterprise/weather-correlation`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/enterprise/integrations`).then(r => r.json()).catch(() => ({ integrations: [] })),
    ]).then(([c, b, w, i]) => {
      setCentral(c); setBenchmark(b); setWeather(w);
      const list = i?.integrations || [];
      setIntgs(list);
      const cfg = {};
      list.forEach(x => { cfg[x.integration] = { ...x.config }; });
      setIntgConfig(cfg);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const addStore = async () => {
    await fetch(`${API_BASE}/enterprise/stores`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeForm),
    });
    setStoreSaved(true); setTimeout(() => setStoreSaved(false), 2000);
  };

  const sendWhatsApp = async () => {
    const res = await fetch(`${API_BASE}/enterprise/whatsapp/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(waForm),
    }).then(r => r.json()).catch(() => null);
    setWaSent(res);
  };

  const sendERP = async () => {
    const res = await fetch(`${API_BASE}/enterprise/erp/restock-order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(erpForm),
    }).then(r => r.json()).catch(() => null);
    setErpSent(res);
  };

  const saveIntg = async (integration) => {
    await fetch(`${API_BASE}/enterprise/integrations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integration, enabled: true, config: intgConfig[integration] || {} }),
    });
    setIntgSaved(integration); setTimeout(() => setIntgSaved(''), 2000);
  };

  const testIntg = async (integration) => {
    const res = await fetch(`${API_BASE}/enterprise/integrations/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integration, enabled: true, config: intgConfig[integration] || {} }),
    }).then(r => r.json()).catch(() => ({ status: 'error', message: 'Connection failed' }));
    setTestResult(p => ({ ...p, [integration]: res }));
  };

  const TABS = [
    { id: 'central',    label: '🌐 Central Ops' },
    { id: 'benchmark',  label: '📊 Benchmarking' },
    { id: 'weather',    label: '🌦️ Weather/Season' },
    { id: 'integrations', label: '🔗 Integrations' },
    { id: 'stores',     label: '🏬 Stores' },
  ];

  if (loading) return (
    <div>
      <div className="stat-grid stat-grid-4 mb-20">{[1,2,3,4].map(i => <div key={i} className="skeleton-kpi"/>)}</div>
      <div className="skeleton-chart"/>
    </div>
  );

  const s = central?.summary;

  return (
    <div>
      {/* KPI row */}
      <div className="stat-grid stat-grid-4 mb-20">
        <StatCard label="Total Entries"   value={s?.total_entries ?? 0}    color="var(--brand)"  sub="All stores combined"/>
        <StatCard label="Total Revenue"   value={`₹${s?.total_revenue ?? 0}`} color="var(--green)"  sub="From POS data"/>
        <StatCard label="Critical Alerts" value={s?.critical_alerts ?? 0}  color="var(--red)"    sub="Unresolved"/>
        <StatCard label="Open Restock"    value={s?.open_restock ?? 0}     color="var(--amber)"  sub="Shelf alerts"/>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Central Ops */}
      {tab === 'central' && central && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">🔴 Recent Critical Alerts</div></div>
            <div style={{ padding: 16 }}>
              {!central.recent_alerts?.length ? (
                <div className="empty-state"><div className="empty-state-icon">✅</div><div>No recent alerts</div></div>
              ) : central.recent_alerts.map(a => (
                <div key={a.id} style={{ padding: '10px 14px', background: a.severity === 'CRITICAL' ? 'var(--red-light)' : 'var(--amber-light)', border: `1px solid ${a.severity === 'CRITICAL' ? 'var(--red-border)' : 'var(--amber-border)'}`, borderRadius: 'var(--r)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span className={`badge badge-${a.severity}`}>{a.severity}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-m)' }}>{new Date(a.time).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ fontSize: 12 }}>{a.message}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">📦 Open Restock Alerts</div></div>
            <div style={{ padding: 16 }}>
              {!central.open_restock_alerts?.length ? (
                <div className="empty-state"><div className="empty-state-icon">✅</div><div>All shelves stocked</div></div>
              ) : central.open_restock_alerts.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--amber-light)', border: '1px solid var(--amber-border)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.zone}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Empty for {r.age_min} min</div>
                  </div>
                  <span className="badge badge-HIGH">RESTOCK</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Benchmarking */}
      {tab === 'benchmark' && benchmark && (
        <div className="card">
          <div className="card-header"><div className="card-title">📊 Store Performance Benchmark</div></div>
          <div style={{ padding: 16 }}>
            {benchmark.stores?.map(s => (
              <div key={s.store_id} style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{s.badge?.split(' ')[0]}</span>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{s.store_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>#{s.rank}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.location}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 700, color: 'var(--brand)' }}>{s.score}</div>
                </div>
                <div className="grid-4">
                  {[
                    { label: 'Entries',    value: s.total_entries },
                    { label: 'Revenue',    value: `₹${s.total_revenue}` },
                    { label: 'Conversion', value: `${s.conversion_rate}%` },
                    { label: 'Alerts',     value: s.total_alerts },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-card)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.value}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weather/Season */}
      {tab === 'weather' && weather && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🌦️ Weather & Season Correlation</div>
              <div className="card-subtitle">{weather.insight}</div>
            </div>
            <span style={{ padding: '4px 10px', background: 'var(--amber-light)', border: '1px solid var(--amber-border)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'var(--amber)' }}>
              Peak: {weather.peak_season}
            </span>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Month</th><th>Season</th><th>Festival</th><th>Entries</th><th>Expected Boost</th></tr></thead>
              <tbody>
                {weather.monthly?.map(m => (
                  <tr key={m.month}>
                    <td style={{ fontWeight: 600 }}>{m.label}</td>
                    <td>{m.season}</td>
                    <td>{m.festival || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-m)', fontWeight: 600 }}>{m.entries}</td>
                    <td>
                      <span className={`badge badge-${m.expected_boost === 'HIGH' ? 'CRITICAL' : m.expected_boost === 'MEDIUM' ? 'HIGH' : 'active'}`}>
                        {m.expected_boost}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Integrations */}
      {tab === 'integrations' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {intgs.map(intg => {
              const meta = INTG_META[intg.integration] || { icon: '🔗', label: intg.integration, desc: '', color: 'var(--brand)' };
              const cfg  = intgConfig[intg.integration] || {};
              const test = testResult[intg.integration];
              return (
                <div key={intg.integration} className="card">
                  <div className="card-header">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 22 }}>{meta.icon}</span>
                      <div>
                        <div className="card-title">{meta.label}</div>
                        <div className="card-subtitle">{meta.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => testIntg(intg.integration)}>Test</button>
                      <button className="btn btn-sm btn-primary" onClick={() => saveIntg(intg.integration)}>
                        {intgSaved === intg.integration ? '✓ Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    {intg.integration === 'whatsapp' && (
                      <div className="form-group">
                        <label className="form-label">Phone Number</label>
                        <input className="form-input" placeholder="+91 98765 43210"
                          value={cfg.phone || ''}
                          onChange={e => setIntgConfig(p => ({ ...p, whatsapp: { ...p.whatsapp, phone: e.target.value } }))}/>
                      </div>
                    )}
                    {intg.integration === 'pos' && (
                      <div className="form-group">
                        <label className="form-label">POS API Endpoint</label>
                        <input className="form-input" placeholder="https://pos.yourstore.com/api"
                          value={cfg.endpoint || ''}
                          onChange={e => setIntgConfig(p => ({ ...p, pos: { ...p.pos, endpoint: e.target.value } }))}/>
                      </div>
                    )}
                    {intg.integration === 'erp' && (
                      <div className="form-group">
                        <label className="form-label">ERP Endpoint</label>
                        <input className="form-input" placeholder="https://erp.yourstore.com/api/restock"
                          value={cfg.endpoint || ''}
                          onChange={e => setIntgConfig(p => ({ ...p, erp: { ...p.erp, endpoint: e.target.value } }))}/>
                      </div>
                    )}
                    {intg.integration === 'slack' && (
                      <div className="form-group">
                        <label className="form-label">Slack Webhook URL</label>
                        <input className="form-input" placeholder="https://hooks.slack.com/services/..."
                          value={cfg.webhook || ''}
                          onChange={e => setIntgConfig(p => ({ ...p, slack: { ...p.slack, webhook: e.target.value } }))}/>
                      </div>
                    )}
                    {intg.integration === 'email' && (
                      <div className="form-group">
                        <label className="form-label">Alert Email</label>
                        <input className="form-input" placeholder="manager@store.com"
                          value={cfg.email || ''}
                          onChange={e => setIntgConfig(p => ({ ...p, email: { ...p.email, email: e.target.value } }))}/>
                      </div>
                    )}
                    {test && (
                      <div style={{ padding: '8px 12px', background: test.status === 'ok' ? 'var(--green-light)' : 'var(--red-light)', border: `1px solid ${test.status === 'ok' ? 'var(--green-border)' : 'var(--red-border)'}`, borderRadius: 'var(--r-sm)', fontSize: 12, color: test.status === 'ok' ? 'var(--green)' : 'var(--red)' }}>
                        {test.status === 'ok' ? '✅' : '❌'} {test.message}
                      </div>
                    )}
                    {intg.last_triggered && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>Last used: {new Date(intg.last_triggered).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">💬 Send WhatsApp Alert</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={waForm.phone} onChange={e => setWaForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Message</label>
                  <input className="form-input" value={waForm.message} onChange={e => setWaForm(p => ({ ...p, message: e.target.value }))} placeholder="Shelf empty in Grocery zone!"/>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={sendWhatsApp}>📤 Send</button>
                {waSent && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--green)' }}>
                    {waSent.simulated ? '🔵 Simulated' : '✅ Sent'} — {waSent.note || 'Message dispatched'}
                  </div>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">🏭 Trigger ERP Restock Order</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Zone</label>
                  <select className="form-input form-select" value={erpForm.zone} onChange={e => setErpForm(p => ({ ...p, zone: e.target.value }))}>
                    {['Entrance','Electronics','Apparel','Grocery','Checkout'].map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input className="form-input" type="number" value={erpForm.quantity} onChange={e => setErpForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Urgency</label>
                  <select className="form-input form-select" value={erpForm.urgency} onChange={e => setErpForm(p => ({ ...p, urgency: e.target.value }))}>
                    {['NORMAL','HIGH','CRITICAL'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={sendERP}>📦 Place Order</button>
                {erpSent && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--green)' }}>
                    {erpSent.simulated ? '🔵 Simulated' : '✅ Placed'} — Order ID: <strong>{erpSent.order_id}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stores */}
      {tab === 'stores' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">🏬 Registered Stores</div></div>
            <div className="card-body">
              {benchmark?.stores?.map(s => (
                <div key={s.store_id} className="info-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.store_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.location || 'No location'}</div>
                  </div>
                  <span className="badge badge-active">Active</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">➕ Add Store</div></div>
            <div className="card-body">
              {[
                { label: 'Store ID',    key: 'id',              placeholder: 'store_2' },
                { label: 'Name',        key: 'name',            placeholder: 'Branch 2 - Andheri' },
                { label: 'Location',    key: 'location',        placeholder: 'Andheri West, Mumbai' },
                { label: 'Manager Email', key: 'manager_email', placeholder: 'manager@store.com' },
                { label: 'WhatsApp',    key: 'whatsapp_number', placeholder: '+91 98765 43210' },
              ].map(f => (
                <div key={f.key} className="form-group">
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" value={storeForm[f.key]} onChange={e => setStoreForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}/>
                </div>
              ))}
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={addStore}>
                {storeSaved ? '✓ Added!' : '+ Add Store'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
