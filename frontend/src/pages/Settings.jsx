/* pages/Settings.jsx — Retail AI Settings */
import React, { useState } from 'react';
import useAppStore from '../store/appStore';

const API_BASE = 'http://localhost:8000';

export default function Settings() {
  const { apiKey, setApiKey, user, company } = useAppStore();
  const [keyInput, setKeyInput] = useState(apiKey);
  const [saved,    setSaved]    = useState(false);
  const [backendOk, setBackendOk] = useState(null);

  React.useEffect(() => {
    fetch(`${API_BASE}/`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setBackendOk(!!d))
      .catch(() => setBackendOk(false));
  }, []);

  const saveKey = () => {
    setApiKey(keyInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* AI Config */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🤖 AI Configuration</div>
              <div className="card-subtitle">Anthropic API key for advanced AI agents</div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Anthropic API Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" type="password" value={keyInput}
                  onChange={e => setKeyInput(e.target.value)} placeholder="sk-ant-api03-..." style={{ flex: 1 }}/>
                <button className="btn btn-primary btn-sm" onClick={saveKey}>
                  {saved ? '✓ Saved!' : 'Save'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                Optional — agents work without API key using built-in KB.{' '}
                <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">Get key →</a>
              </p>
            </div>
            {apiKey && (
              <div style={{ padding: '8px 12px', background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>
                ✓ API key active — all 5 AI agents enabled
              </div>
            )}
          </div>
        </div>

        {/* Account */}
        <div className="card">
          <div className="card-header"><div className="card-title">👤 Account</div></div>
          <div className="card-body">
            {[
              ['Name',  user?.name  || '—'],
              ['Email', user?.email || '—'],
              ['Role',  user?.role?.replace('_', ' ') || '—'],
              ['Store', user?.store || '—'],
              ['Plan',  company?.plan || '—'],
            ].map(([l, v]) => (
              <div key={l} className="info-row">
                <span className="info-label">{l}</span>
                <span className="info-value">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Backend Status */}
        <div className="card">
          <div className="card-header"><div className="card-title">🔌 Backend Connection</div></div>
          <div className="card-body">
            {[
              ['API Server',  API_BASE],
              ['Status',      backendOk === null ? 'Checking...' : backendOk ? '✅ Online' : '❌ Offline'],
              ['API Docs',    `${API_BASE}/docs`],
              ['SSE Stream',  `${API_BASE}/dashboard/stream`],
            ].map(([l, v]) => (
              <div key={l} className="info-row">
                <span className="info-label">{l}</span>
                {v.startsWith('http') ? (
                  <a href={v} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--brand)' }}>{v}</a>
                ) : (
                  <span className="info-value mono" style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>{v}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Agents */}
        <div className="card">
          <div className="card-header"><div className="card-title">🤖 AI Agents</div></div>
          <div className="card-body">
            {[
              ['Agent 1', 'Zone Inspector',       'Crowd density per zone',          true],
              ['Agent 2', 'Store Alert Manager',  'Shelf empty / crowd surge alerts', true],
              ['Agent 3', 'Store Analyst',        'Root cause in Hindi + English',    true],
              ['Agent 4', 'Store Optimizer',      'Peak hours, layout suggestions',   true],
              ['Agent 5', 'Shift Report Writer',  'End-of-shift auto report',         true],
            ].map(([id, name, desc, active]) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{id}: {name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                </div>
                <span style={{ fontSize: 10, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid var(--green-border)', padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>
                  ACTIVE
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
