/* pages/Login.jsx — Retail AI Auth Page */
import React, { useState } from 'react';
import useAppStore from '../store/appStore';

const API_BASE = 'http://localhost:8000';

const DEMO_USERS = [
  { email: 'manager@store.com', password: 'manager123', name: 'Rahul Sharma',  role: 'store_manager', store: 'Store #1 - Andheri', plan: 'Pro' },
  { email: 'analyst@store.com', password: 'analyst123', name: 'Priya Patel',   role: 'analyst',       store: 'All Stores',        plan: 'Pro' },
  { email: 'admin@store.com',   password: 'admin123',   name: 'Admin User',    role: 'admin',         store: 'HQ',                plan: 'Enterprise' },
];

export default function Login() {
  const { login } = useAppStore();
  const [mode,    setMode]    = useState('login');
  const [form,    setForm]    = useState({ email: '', password: '', name: '', store: '', role: 'store_manager', plan: 'starter' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError(''); };

  const doLogin = async e => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      if (res.ok) {
        const data = await res.json();
        login(data.user, data.company, data.access_token);
        setLoading(false); return;
      }
    } catch (_) {}

    // Demo fallback
    const u = DEMO_USERS.find(u => u.email === form.email && u.password === form.password);
    if (u) {
      login(
        { id: 'local', name: u.name, email: u.email, role: u.role, store: u.store },
        { name: 'RetailVision India', plan: u.plan, store: u.store },
        'demo-token'
      );
    } else {
      setError('Invalid credentials. Use a demo account below.');
    }
    setLoading(false);
  };

  const doRegister = async e => {
    e.preventDefault(); setLoading(true); setError('');
    if (!form.name || !form.email || !form.password || !form.store) {
      setError('Fill all required fields.'); setLoading(false); return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        login(data.user, data.company, data.access_token);
        setLoading(false); return;
      }
    } catch (_) {}
    login(
      { id: 'reg', name: form.name, email: form.email, role: form.role, store: form.store },
      { name: form.store, plan: form.plan, store: form.store },
      'local-token'
    );
    setLoading(false);
  };

  return (
    <div className="auth-wrap">
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, background: 'var(--brand)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 8px 20px rgba(0,87,255,.25)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 24, fontWeight: 800, letterSpacing: '-.5px' }}>RetailVision AI</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Smart Store Analytics Platform</p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            {['login', 'register'].map(t => (
              <button key={t} className={`auth-tab${mode === t ? ' active' : ''}`}
                onClick={() => { setMode(t); setError(''); }}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="auth-body">
            {mode === 'login' ? (
              <form onSubmit={doLogin}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" name="email" value={form.email} onChange={handle} placeholder="you@store.com" autoFocus/>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" name="password" value={form.password} onChange={handle} placeholder="••••••••"/>
                </div>
                {error && <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</p>}
                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                  {loading && <span className="spinner"/>}{loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={doRegister}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" name="name" value={form.name} onChange={handle} placeholder="Rahul Sharma"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" name="email" value={form.email} onChange={handle} placeholder="you@store.com"/>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Store Name *</label>
                  <input className="form-input" name="store" value={form.store} onChange={handle} placeholder="Store #1 - Mumbai"/>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-input" name="role" value={form.role} onChange={handle}>
                      <option value="store_manager">Store Manager</option>
                      <option value="analyst">Analyst</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plan</label>
                    <select className="form-input" name="plan" value={form.plan} onChange={handle}>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input className="form-input" type="password" name="password" value={form.password} onChange={handle} placeholder="Min. 6 characters"/>
                </div>
                {error && <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</p>}
                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                  {loading && <span className="spinner"/>}{loading ? 'Creating...' : 'Create Account'}
                </button>
              </form>
            )}

            {mode === 'login' && (
              <div style={{ marginTop: 20, padding: 14, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                  Demo Accounts
                </p>
                {DEMO_USERS.map(u => (
                  <button key={u.email}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 10px', marginBottom: 6, background: '#fff', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-b)', textAlign: 'left' }}
                    onClick={() => setForm(f => ({ ...f, email: u.email, password: u.password }))}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-m)' }}>{u.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className={`badge badge-${u.plan}`}>{u.plan}</span>
                      <span style={{ fontSize: 10, background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 16 }}>
          Backend: <code style={{ fontFamily: 'var(--font-m)', color: 'var(--brand)' }}>{API_BASE}</code> · Demo mode works offline
        </p>
      </div>
    </div>
  );
}
