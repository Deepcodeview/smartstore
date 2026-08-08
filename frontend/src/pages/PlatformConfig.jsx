/* pages/PlatformConfig.jsx — Whitelabel, API Keys, Language, Role Dashboards */
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';
import { setLanguage, getLanguage, LANGUAGES } from '../utils/i18n';

function KpiCard({ label, value, color = 'var(--brand)', sub }) {
  return (
    <div className="stat-card-premium" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-d)', fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export default function PlatformConfig() {
  const [tab, setTab] = useState('whitelabel');

  // Whitelabel state
  const [wl, setWl] = useState({ client_id: 'default', brand_name: 'RetailVision', primary_color: '#0057ff', accent_color: '#7c3aed', custom_domain: '', support_email: '', language: 'en' });
  const [wlSaved, setWlSaved] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState([]);
  const [newKey, setNewKey] = useState({ key_name: '', scopes: ['read'] });
  const [createdKey, setCreatedKey] = useState(null);

  // Language state
  const [currentLang, setCurrentLang] = useState(getLanguage());

  // Role dashboard state
  const [roleDash, setRoleDash] = useState(null);
  const [selectedRole, setSelectedRole] = useState('store_manager');

  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [wlRes, keysRes, roleRes] = await Promise.allSettled([
        fetch(`${API_BASE}/platform/whitelabel?client_id=default`).then(r => r.json()),
        fetch(`${API_BASE}/platform/api-keys`).then(r => r.json()),
        fetch(`${API_BASE}/platform/role-dashboards`).then(r => r.json()),
      ]);
      if (wlRes.status === 'fulfilled' && wlRes.value) setWl(v => ({ ...v, ...wlRes.value }));
      if (keysRes.status === 'fulfilled') setApiKeys(keysRes.value?.keys || []);
      if (roleRes.status === 'fulfilled') setRoleDash(roleRes.value?.dashboards || null);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveWhitelabel = async () => {
    await fetch(`${API_BASE}/platform/whitelabel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wl),
    });
    setWlSaved(true); setTimeout(() => setWlSaved(false), 2000);
  };

  const generateKey = async () => {
    if (!newKey.key_name.trim()) return;
    const res = await fetch(`${API_BASE}/platform/api-keys`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newKey),
    }).then(r => r.json());
    setCreatedKey(res);
    setNewKey({ key_name: '', scopes: ['read'] });
    load();
  };

  const revokeKey = async (id) => {
    await fetch(`${API_BASE}/platform/api-keys/${id}`, { method: 'DELETE' });
    load();
  };

  const handleLangChange = async (lang) => {
    setLanguage(lang);
    setCurrentLang(lang);
    await fetch(`${API_BASE}/platform/language/set?store_id=store_1&language=${lang}`, { method: 'POST' });
  };

  const toggleWidget = async (role, widgetId) => {
    if (!roleDash) return;
    const updated = roleDash[role].map(w => w.id === widgetId ? { ...w, enabled: !w.enabled } : w);
    const newDash = { ...roleDash, [role]: updated };
    setRoleDash(newDash);
    await fetch(`${API_BASE}/platform/role-dashboards`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, widgets: updated }),
    });
  };

  const TABS = [
    { id: 'whitelabel', label: '🎨 Whitelabel' },
    { id: 'apikeys',    label: `🔑 API Keys (${apiKeys.length})` },
    { id: 'language',   label: '🌐 Language' },
    { id: 'roles',      label: '👤 Role Dashboards' },
  ];

  const SCOPE_OPTIONS = ['read', 'write', 'alerts', 'admin'];

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
        <KpiCard label="API Keys"        value={apiKeys.length}                              color="var(--brand)"  sub="Active integrations"/>
        <KpiCard label="Active Keys"     value={apiKeys.filter(k => k.active).length}        color="var(--green)"  sub="Currently enabled"/>
        <KpiCard label="Language"        value={LANGUAGES[currentLang]?.native || 'English'} color="var(--purple)" sub="Current UI language"/>
        <KpiCard label="Whitelabel"      value={wl.brand_name}                               color="var(--amber)"  sub="Brand name"/>
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

      {/* ── Whitelabel Tab ── */}
      {tab === 'whitelabel' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">🎨 Brand Configuration</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Client ID</label>
                <input className="form-input" value={wl.client_id} onChange={e => setWl(p => ({ ...p, client_id: e.target.value }))} placeholder="default"/>
              </div>
              <div className="form-group">
                <label className="form-label">Brand Name</label>
                <input className="form-input" value={wl.brand_name} onChange={e => setWl(p => ({ ...p, brand_name: e.target.value }))} placeholder="RetailVision"/>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Primary Color</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={wl.primary_color} onChange={e => setWl(p => ({ ...p, primary_color: e.target.value }))} style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }}/>
                    <input className="form-input" value={wl.primary_color} onChange={e => setWl(p => ({ ...p, primary_color: e.target.value }))} style={{ flex: 1 }}/>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Accent Color</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={wl.accent_color} onChange={e => setWl(p => ({ ...p, accent_color: e.target.value }))} style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }}/>
                    <input className="form-input" value={wl.accent_color} onChange={e => setWl(p => ({ ...p, accent_color: e.target.value }))} style={{ flex: 1 }}/>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Custom Domain</label>
                <input className="form-input" value={wl.custom_domain} onChange={e => setWl(p => ({ ...p, custom_domain: e.target.value }))} placeholder="analytics.yourstore.com"/>
              </div>
              <div className="form-group">
                <label className="form-label">Support Email</label>
                <input className="form-input" value={wl.support_email} onChange={e => setWl(p => ({ ...p, support_email: e.target.value }))} placeholder="support@yourstore.com"/>
              </div>
              <button className="btn btn-primary" onClick={saveWhitelabel}>
                {wlSaved ? '✅ Saved!' : '💾 Save Branding'}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="card">
            <div className="card-header"><div className="card-title">👁️ Brand Preview</div></div>
            <div className="card-body">
              <div style={{ padding: 20, background: 'var(--bg)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: wl.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: 16 }}>🏪</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: 15, color: wl.primary_color }}>{wl.brand_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>AI Analytics Platform</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ padding: '8px 16px', background: wl.primary_color, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Primary Button</div>
                  <div style={{ padding: '8px 16px', background: wl.accent_color, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Accent Button</div>
                </div>
                {wl.custom_domain && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🌐 {wl.custom_domain}</div>}
                {wl.support_email && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>📧 {wl.support_email}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── API Keys Tab ── */}
      {tab === 'apikeys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Created key banner */}
          {createdKey && (
            <div style={{ padding: '16px 20px', background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-lg)' }}>
              <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>✅ API Key Created — Copy it now, it won't be shown again!</div>
              <div style={{ fontFamily: 'var(--font-m)', fontSize: 13, background: '#fff', padding: '10px 14px', borderRadius: 'var(--r)', border: '1px solid var(--green-border)', wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                {createdKey.api_key}
              </div>
              <button className="btn btn-sm btn-secondary" style={{ marginTop: 10 }} onClick={() => { navigator.clipboard.writeText(createdKey.api_key); }}>
                📋 Copy Key
              </button>
              <button className="btn btn-sm btn-secondary" style={{ marginTop: 10, marginLeft: 8 }} onClick={() => setCreatedKey(null)}>✕ Dismiss</button>
            </div>
          )}

          <div className="grid-2">
            {/* Generate new key */}
            <div className="card">
              <div className="card-header"><div className="card-title">🔑 Generate New API Key</div></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Key Name</label>
                  <input className="form-input" value={newKey.key_name} onChange={e => setNewKey(p => ({ ...p, key_name: e.target.value }))} placeholder="e.g. POS Integration, Mobile App"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Scopes</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {SCOPE_OPTIONS.map(s => (
                      <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: `1px solid ${newKey.scopes.includes(s) ? 'var(--brand)' : 'var(--border)'}`, background: newKey.scopes.includes(s) ? 'var(--brand-light)' : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: newKey.scopes.includes(s) ? 'var(--brand)' : 'var(--text-muted)' }}>
                        <input type="checkbox" checked={newKey.scopes.includes(s)} onChange={() => setNewKey(p => ({ ...p, scopes: p.scopes.includes(s) ? p.scopes.filter(x => x !== s) : [...p.scopes, s] }))} style={{ display: 'none' }}/>
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--amber-light)', border: '1px solid var(--amber-border)', borderRadius: 'var(--r-sm)', fontSize: 11, color: 'var(--amber)', marginBottom: 14 }}>
                  ⚠️ The full key is shown ONCE on creation. Store it securely.
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={generateKey} disabled={!newKey.key_name.trim()}>
                  🔑 Generate Key
                </button>
              </div>
            </div>

            {/* Integration examples */}
            <div className="card">
              <div className="card-header"><div className="card-title">📖 Integration Examples</div></div>
              <div className="card-body">
                {[
                  { label: 'cURL', code: 'curl -H "X-API-Key: rvai_..." http://localhost:8000/jobs/' },
                  { label: 'Python', code: 'requests.get("/jobs/", headers={"X-API-Key": "rvai_..."})' },
                  { label: 'JavaScript', code: 'fetch("/jobs/", { headers: { "X-API-Key": "rvai_..." } })' },
                ].map(ex => (
                  <div key={ex.label} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{ex.label}</div>
                    <div style={{ fontFamily: 'var(--font-m)', fontSize: 11, background: 'var(--bg)', padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{ex.code}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Keys list */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🗝️ Your API Keys</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{apiKeys.length} total</span>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Key Prefix</th><th>Scopes</th><th>Status</th><th>Last Used</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>
                  {apiKeys.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No API keys yet — generate one above</td></tr>
                  ) : apiKeys.map(k => (
                    <tr key={k.id}>
                      <td style={{ fontWeight: 600 }}>{k.key_name}</td>
                      <td className="cell-mono">{k.key_prefix}</td>
                      <td>{k.scopes?.map(s => <span key={s} className="badge badge-blue" style={{ marginRight: 4 }}>{s}</span>)}</td>
                      <td><span className={`badge badge-${k.active ? 'active' : 'inactive'}`}>{k.active ? 'Active' : 'Revoked'}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.last_used || 'Never'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.created_at}</td>
                      <td>
                        {k.active && (
                          <button className="btn btn-sm btn-danger" onClick={() => revokeKey(k.id)}>Revoke</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Language Tab ── */}
      {tab === 'language' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">🌐 Select Language</div></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(LANGUAGES).map(([code, lang]) => (
                  <div key={code} onClick={() => handleLangChange(code)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 'var(--r-lg)', border: `2px solid ${currentLang === code ? 'var(--brand)' : 'var(--border)'}`, background: currentLang === code ? 'var(--brand-light)' : 'var(--bg-card)', cursor: 'pointer', transition: 'all .15s' }}>
                    <span style={{ fontSize: 28 }}>{lang.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: currentLang === code ? 'var(--brand)' : 'var(--text-primary)' }}>{lang.native}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lang.name}</div>
                    </div>
                    {currentLang === code && <span style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 18 }}>✓</span>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--brand-light)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--text-secondary)' }}>
                💡 Language change applies immediately to all UI labels. Preference saved to localStorage.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📝 Translation Coverage</div></div>
            <div className="card-body">
              {[
                { section: 'Navigation', keys: 18, status: '✅' },
                { section: 'KPI Labels', keys: 6, status: '✅' },
                { section: 'Alert Types', keys: 4, status: '✅' },
                { section: 'Zone Names', keys: 5, status: '✅' },
                { section: 'Report Labels', keys: 3, status: '✅' },
                { section: 'Status Labels', keys: 8, status: '✅' },
                { section: 'Common Actions', keys: 12, status: '✅' },
              ].map(r => (
                <div key={r.section} className="info-row">
                  <span className="info-label">{r.section}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.keys} keys</span>
                    <span>{r.status}</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                ✅ 3 languages × ~56 keys = 168 translations ready
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Role Dashboards Tab ── */}
      {tab === 'roles' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['store_manager', 'analyst', 'admin'].map(r => (
              <button key={r} className={`btn btn-sm ${selectedRole === r ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelectedRole(r)}>
                {r === 'store_manager' ? '🏪 Store Manager' : r === 'analyst' ? '📊 Analyst' : '🌐 Admin'}
              </button>
            ))}
          </div>

          {roleDash && roleDash[selectedRole] && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">🧩 Dashboard Widgets — {selectedRole.replace('_', ' ')}</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {roleDash[selectedRole].filter(w => w.enabled).length} of {roleDash[selectedRole].length} enabled
                </span>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {roleDash[selectedRole].sort((a, b) => a.order - b.order).map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--r)', border: `1px solid ${w.enabled ? 'var(--green-border)' : 'var(--border)'}` }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: w.enabled ? 'var(--green-light)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: w.enabled ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0 }}>
                      {w.order}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{w.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-m)' }}>{w.id}</div>
                    </div>
                    <div className={`toggle-switch ${w.enabled ? 'on' : ''}`} onClick={() => toggleWidget(selectedRole, w.id)}/>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                💡 Changes saved automatically to server. Widgets control what each role sees on their dashboard.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
