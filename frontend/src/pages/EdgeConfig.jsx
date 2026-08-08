/* pages/EdgeConfig.jsx — Camera Health, Night Mode, Edge Devices, Deployment */
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';

function KpiCard({ label, value, color = 'var(--brand)', sub }) {
  return (
    <div className="stat-card-premium" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-d)', fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

const DEVICE_TYPE_ICONS = { jetson_nano: '🟢', jetson_orin: '🔵', oak_d: '🟣', raspberry_pi: '🔴' };
const DEVICE_TYPE_LABELS = { jetson_nano: 'Jetson Nano', jetson_orin: 'Jetson Orin NX', oak_d: 'OAK-D', raspberry_pi: 'Raspberry Pi 5' };

export default function EdgeConfig() {
  const [tab, setTab] = useState('health');

  // Camera health
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Devices
  const [devices, setDevices] = useState([]);
  const [newDevice, setNewDevice] = useState({ device_id: '', device_type: 'jetson_nano', ip_address: '', night_mode: false, night_threshold: 60, model_variant: 'yolov8n' });
  const [deviceSaved, setDeviceSaved] = useState(false);

  // Night mode
  const [nightStatus, setNightStatus] = useState(null);

  // Deployment guide
  const [guide, setGuide] = useState(null);
  const [guideDevice, setGuideDevice] = useState('jetson_nano');

  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [devRes, nightRes, guideRes] = await Promise.allSettled([
        fetch(`${API_BASE}/edge/devices`).then(r => r.json()),
        fetch(`${API_BASE}/edge/night-mode/status`).then(r => r.json()),
        fetch(`${API_BASE}/edge/deployment/guide`).then(r => r.json()),
      ]);
      if (devRes.status === 'fulfilled') setDevices(devRes.value?.devices || []);
      if (nightRes.status === 'fulfilled') setNightStatus(nightRes.value);
      if (guideRes.status === 'fulfilled') setGuide(guideRes.value);
    } catch (_) {}
    setLoading(false);
  };

  const runHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/edge/camera-health/auto-check`).then(r => r.json());
      setHealth(res);
    } catch (_) {}
    setHealthLoading(false);
  };

  useEffect(() => { load(); runHealthCheck(); }, []);

  const registerDevice = async () => {
    if (!newDevice.device_id.trim()) return;
    await fetch(`${API_BASE}/edge/devices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDevice),
    });
    setDeviceSaved(true); setTimeout(() => setDeviceSaved(false), 2000);
    setNewDevice({ device_id: '', device_type: 'jetson_nano', ip_address: '', night_mode: false, night_threshold: 60, model_variant: 'yolov8n' });
    load();
  };

  const toggleNightMode = async (deviceId, enabled) => {
    await fetch(`${API_BASE}/edge/night-mode/toggle?device_id=${deviceId}&enabled=${enabled}`, { method: 'POST' });
    load();
  };

  const updateDevice = async (id, field, value) => {
    await fetch(`${API_BASE}/edge/devices/${id}?${field}=${value}`, { method: 'PATCH' });
    load();
  };

  const TABS = [
    { id: 'health',     label: '📷 Camera Health' },
    { id: 'devices',    label: `🖥️ Devices (${devices.length})` },
    { id: 'nightmode',  label: '🌙 Night Mode' },
    { id: 'deployment', label: '🚀 Deployment Guide' },
  ];

  const healthColor = health?.status === 'HEALTHY' ? 'var(--green)' : health?.status === 'DEGRADED' ? 'var(--amber)' : 'var(--red)';

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
        <KpiCard label="Camera Health"   value={health ? `${health.health_score}%` : '—'}  color={healthColor}          sub={health?.status || 'Run check'}/>
        <KpiCard label="Total Devices"   value={devices.length}                              color="var(--brand)"         sub="Registered edge devices"/>
        <KpiCard label="Night Mode On"   value={nightStatus?.night_mode_on ?? '—'}           color="var(--purple)"        sub={`of ${nightStatus?.total_devices ?? 0} devices`}/>
        <KpiCard label="Issues Found"    value={health?.issue_count ?? '—'}                  color={health?.issue_count > 0 ? 'var(--red)' : 'var(--green)'} sub="Camera issues"/>
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

      {/* ── Camera Health Tab ── */}
      {tab === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={runHealthCheck} disabled={healthLoading}>
              {healthLoading ? <><span className="spinner"/>Checking...</> : '🔍 Run Health Check'}
            </button>
          </div>

          {health && (
            <>
              {/* Score banner */}
              <div style={{ padding: '20px 24px', background: `linear-gradient(135deg, ${health.status === 'HEALTHY' ? 'var(--green-light)' : 'var(--amber-light)'} 0%, var(--bg-card) 100%)`, border: `1px solid ${health.status === 'HEALTHY' ? 'var(--green-border)' : 'var(--amber-border)'}`, borderRadius: 'var(--r-lg)', display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-d)', fontSize: 52, fontWeight: 800, color: healthColor, lineHeight: 1 }}>{health.health_score}%</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Health Score</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-d)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                    {health.status === 'HEALTHY' ? '✅' : health.status === 'DEGRADED' ? '⚠️' : '🚨'} {health.status}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {health.healthy_count} healthy · {health.issue_count} issues · {health.total_checked} total checked
                  </div>
                  {health.recommendations?.filter(Boolean).map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--amber)', marginTop: 3 }}>💡 {r}</div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-m)' }}>
                  {health.checked_at?.slice(0, 16)}
                </div>
              </div>

              {/* Issues */}
              {health.issues?.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">🚨 Camera Issues</div>
                    <span className="badge badge-CRITICAL">{health.issues.length} issues</span>
                  </div>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {health.issues.map((issue, i) => (
                      <div key={i} style={{ padding: '12px 16px', background: issue.severity === 'CRITICAL' ? 'var(--red-light)' : 'var(--amber-light)', border: `1px solid ${issue.severity === 'CRITICAL' ? 'var(--red-border)' : 'var(--amber-border)'}`, borderRadius: 'var(--r)', display: 'flex', gap: 14 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{issue.severity === 'CRITICAL' ? '🔴' : '🟡'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{issue.filename} — {issue.issue}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{issue.detail}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔧 {issue.action}</div>
                        </div>
                        <span className={`badge badge-${issue.severity}`}>{issue.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Healthy cameras */}
              {health.healthy_cameras?.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">✅ Healthy Cameras</div>
                    <span className="badge badge-active">{health.healthy_count} healthy</span>
                  </div>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead><tr><th>Job ID</th><th>File</th><th>Avg People/Frame</th><th>Entries</th><th>Checked At</th></tr></thead>
                      <tbody>
                        {health.healthy_cameras.map((c, i) => (
                          <tr key={i}>
                            <td className="cell-mono">{c.job_id}</td>
                            <td>{c.filename}</td>
                            <td style={{ color: 'var(--green)', fontWeight: 600 }}>{c.avg_pf}</td>
                            <td>{c.entries}</td>
                            <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.timestamp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Devices Tab ── */}
      {tab === 'devices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Register form */}
          <div className="card">
            <div className="card-header"><div className="card-title">➕ Register Edge Device</div></div>
            <div className="card-body">
              <div className="grid-3" style={{ gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Device ID</label>
                  <input className="form-input" value={newDevice.device_id} onChange={e => setNewDevice(p => ({ ...p, device_id: e.target.value }))} placeholder="cam_001"/>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Device Type</label>
                  <select className="form-input form-select" value={newDevice.device_type} onChange={e => setNewDevice(p => ({ ...p, device_type: e.target.value }))}>
                    <option value="jetson_nano">Jetson Nano</option>
                    <option value="jetson_orin">Jetson Orin NX</option>
                    <option value="oak_d">OAK-D</option>
                    <option value="raspberry_pi">Raspberry Pi 5</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">IP Address</label>
                  <input className="form-input" value={newDevice.ip_address} onChange={e => setNewDevice(p => ({ ...p, ip_address: e.target.value }))} placeholder="192.168.1.100"/>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Model Variant</label>
                  <select className="form-input form-select" value={newDevice.model_variant} onChange={e => setNewDevice(p => ({ ...p, model_variant: e.target.value }))}>
                    <option value="yolov8n">YOLOv8n (Fast)</option>
                    <option value="yolov8s">YOLOv8s (Accurate)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Night Threshold (brightness)</label>
                  <input type="number" className="form-input" value={newDevice.night_threshold} onChange={e => setNewDevice(p => ({ ...p, night_threshold: parseInt(e.target.value) }))} min={0} max={255}/>
                </div>
                <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label className="form-label">Night Mode</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6 }}>
                    <div className={`toggle-switch ${newDevice.night_mode ? 'on' : ''}`} onClick={() => setNewDevice(p => ({ ...p, night_mode: !p.night_mode }))}/>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{newDevice.night_mode ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={registerDevice} disabled={!newDevice.device_id.trim()}>
                {deviceSaved ? '✅ Registered!' : '➕ Register Device'}
              </button>
            </div>
          </div>

          {/* Devices list */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🖥️ Registered Devices</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{devices.length} total</span>
            </div>
            {devices.length === 0 ? (
              <div className="empty-state" style={{ padding: 48 }}>
                <div className="empty-state-icon">🖥️</div>
                <div className="empty-state-title">No devices registered</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Register a Jetson, OAK-D, or Raspberry Pi above</div>
              </div>
            ) : (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {devices.map(d => (
                  <div key={d.id} style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r-lg)', border: `1px solid ${d.status === 'online' ? 'var(--green-border)' : 'var(--border)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <span style={{ fontSize: 24 }}>{DEVICE_TYPE_ICONS[d.device_type] || '🖥️'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{d.device_id}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.device_name} · {d.ip_address || 'No IP'}</div>
                      </div>
                      <span className={`badge badge-${d.status === 'online' ? 'active' : 'inactive'}`}>{d.status}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last: {d.last_heartbeat}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Model', value: d.model_variant },
                        { label: 'Night Mode', value: d.night_mode ? '🌙 ON' : '☀️ OFF' },
                        { label: 'Threshold', value: d.night_threshold },
                        { label: 'Max Cameras', value: d.specs?.max_cameras },
                        { label: 'FPS', value: d.specs?.fps_capability },
                      ].map(s => (
                        <div key={s.label} style={{ fontSize: 11 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{s.label}: </span>
                          <span style={{ fontWeight: 600 }}>{s.value ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => updateDevice(d.id, 'night_mode', !d.night_mode)}>
                        {d.night_mode ? '☀️ Disable Night' : '🌙 Enable Night'}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => updateDevice(d.id, 'model_variant', d.model_variant === 'yolov8n' ? 'yolov8s' : 'yolov8n')}>
                        Switch to {d.model_variant === 'yolov8n' ? 'yolov8s' : 'yolov8n'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Night Mode Tab ── */}
      {tab === 'nightmode' && nightStatus && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="stat-grid stat-grid-3 mb-4">
            <KpiCard label="Total Devices"   value={nightStatus.total_devices}  color="var(--brand)"/>
            <KpiCard label="Night Mode ON"   value={nightStatus.night_mode_on}  color="var(--purple)" sub="Low-light enhanced"/>
            <KpiCard label="Night Mode OFF"  value={nightStatus.night_mode_off} color="var(--text-muted)"/>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">🌙 Night Mode Settings</div></div>
              <div className="card-body">
                {Object.entries(nightStatus.settings || {}).map(([key, val]) => (
                  <div key={key} className="info-row">
                    <span className="info-label">{key.replace(/_/g, ' ')}</span>
                    <span className="info-value mono">{val}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--purple-light)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--purple)' }}>
                  💡 {nightStatus.schedule_tip}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">🖥️ Per-Device Night Mode</div></div>
              <div style={{ padding: 12 }}>
                {nightStatus.devices?.length === 0 ? (
                  <div className="empty-state" style={{ padding: 32 }}>
                    <div className="empty-state-icon">🌙</div>
                    <div>No devices registered yet</div>
                  </div>
                ) : nightStatus.devices?.map(d => (
                  <div key={d.device_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--r)', marginBottom: 8, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 18 }}>{d.night_mode ? '🌙' : '☀️'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{d.device_id}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Threshold: {d.threshold}</div>
                    </div>
                    <div className={`toggle-switch ${d.night_mode ? 'on' : ''}`} onClick={() => toggleNightMode(d.device_id, !d.night_mode)}/>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Deployment Guide Tab ── */}
      {tab === 'deployment' && guide && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Device selector */}
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.keys(guide.devices || {}).map(d => (
              <button key={d} className={`btn btn-sm ${guideDevice === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGuideDevice(d)}>
                {DEVICE_TYPE_ICONS[d]} {DEVICE_TYPE_LABELS[d]}
              </button>
            ))}
          </div>

          {guide.devices?.[guideDevice] && (
            <div className="grid-2">
              <div className="card">
                <div className="card-header"><div className="card-title">📋 Setup Steps — {DEVICE_TYPE_LABELS[guideDevice]}</div></div>
                <div style={{ padding: 16 }}>
                  {(guide.setup_steps?.[guideDevice] || []).map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < (guide.setup_steps[guideDevice].length - 1) ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ fontFamily: 'var(--font-m)', fontSize: 12, color: 'var(--text-secondary)', paddingTop: 3 }}>{step}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="card">
                  <div className="card-header"><div className="card-title">🖥️ Device Specs</div></div>
                  <div className="card-body">
                    {Object.entries(guide.devices[guideDevice]).map(([k, v]) => (
                      <div key={k} className="info-row">
                        <span className="info-label">{k.replace(/_/g, ' ')}</span>
                        <span className="info-value">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><div className="card-title">🔒 Privacy Benefits</div></div>
                  <div className="card-body">
                    {guide.privacy_benefits?.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--green)', flexShrink: 0 }}>✅</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cost savings */}
          <div className="card">
            <div className="card-header"><div className="card-title">💰 Cost Savings — Edge vs Cloud</div></div>
            <div className="card-body">
              <div className="stat-grid stat-grid-3">
                {Object.entries(guide.cost_savings || {}).map(([k, v]) => (
                  <div key={k} style={{ padding: '14px 16px', background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-lg)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.replace(/_/g, ' ')}</div>
                    <div style={{ fontFamily: 'var(--font-d)', fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommended setup */}
          <div className="card">
            <div className="card-header"><div className="card-title">🏪 Recommended Setup by Store Size</div></div>
            <div className="card-body">
              {Object.entries(guide.recommended_setup || {}).map(([size, rec]) => (
                <div key={size} className="info-row">
                  <span className="info-label">{size.replace(/_/g, ' ')}</span>
                  <span className="info-value" style={{ color: 'var(--brand)', fontWeight: 600 }}>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
