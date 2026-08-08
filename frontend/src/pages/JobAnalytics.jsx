/* pages/JobAnalytics.jsx — Full Zone-wise Analytics Dashboard */
import { useState, useEffect } from 'react';
import BASE from '../utils/api';

const API_BASE = 'http://localhost:8000';

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div className="stat-card-premium">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '14px 14px 0 0' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="stat-card-icon" style={{ background: color + '18' }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
        </div>
      </div>
      <div className="stat-value" style={{ color, fontSize: 28 }}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-xs text-muted" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ShelfBadge({ status }) {
  const map = {
    'NORMAL':            { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', icon: '✅' },
    'LOW STOCK':         { bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: '⚠️' },
    'EMPTY':             { bg: '#fff5f5', color: '#dc2626', border: '#fed7d7', icon: '🚨' },
    'NO SHELF DETECTED': { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', icon: '❓' },
  };
  const s = map[status] || map['NO SHELF DETECTED'];
  return (
    <span className="badge" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 13, padding: '6px 14px' }}>
      {s.icon} {status || '—'}
    </span>
  );
}

function SparkLine({ data, color = '#2563eb', height = 60 }) {
  if (!data || data.length < 2) return null;
  const counts = data.map(d => d.count);
  const max = Math.max(...counts, 1);
  const w = 100, h = height;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.count / max) * (h - 8)) - 4;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${pts} 100,${h}`} fill="url(#sparkGrad)" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => {
          if (d.count !== max) return null;
          const x = (i / (data.length - 1)) * w;
          const y = h - ((d.count / max) * (h - 8)) - 4;
          return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span className="text-xs text-muted">{data[0]?.time_sec}s</span>
        <span className="text-xs" style={{ color, fontWeight: 600 }}>Peak: {max}</span>
        <span className="text-xs text-muted">{data[data.length - 1]?.time_sec}s</span>
      </div>
    </div>
  );
}

function DensityChart({ histogram }) {
  if (!histogram || Object.keys(histogram).length === 0) return null;
  const entries = Object.entries(histogram).map(([k, v]) => ({ count: parseInt(k), frames: v }));
  const maxFrames = Math.max(...entries.map(e => e.frames), 1);
  const total = entries.reduce((a, b) => a + b.frames, 0);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
      {entries.map(({ count, frames }) => {
        const pct = (frames / maxFrames) * 100;
        const color = count === 0 ? '#e2e8f0' : count <= 5 ? '#22c55e' : count <= 9 ? '#f59e0b' : '#ef4444';
        return (
          <div key={count} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span className="text-xs text-muted">{Math.round((frames / total) * 100)}%</span>
            <div style={{ width: '100%', height: `${pct}%`, minHeight: 4, background: color, borderRadius: '3px 3px 0 0', transition: 'height .3s' }} title={`${count} persons: ${frames} frames`} />
            <span className="text-xs text-muted">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function HeatmapGrid({ data }) {
  if (!data || data.length === 0) return <div className="text-muted text-sm">No heatmap data</div>;
  const max = Math.max(...data.flat(), 1);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data[0].length}, 1fr)`, gap: 2 }}>
        {data.map((row, r) =>
          row.map((val, c) => {
            const intensity = val / max;
            return (
              <div key={`${r}-${c}`}
                title={`Row ${r + 1}, Col ${c + 1}: ${val} detections`}
                style={{
                  height: 20, borderRadius: 2,
                  background: intensity > 0 ? `rgba(239,68,68,${Math.max(intensity, 0.08).toFixed(2)})` : '#f1f5f9',
                  border: '1px solid rgba(0,0,0,0.04)', cursor: 'default',
                }}
              />
            );
          })
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span className="text-xs text-muted">Low traffic</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[0.08, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
            <div key={v} style={{ width: 22, height: 12, borderRadius: 2, background: `rgba(239,68,68,${v})` }} />
          ))}
        </div>
        <span className="text-xs text-muted">High traffic</span>
      </div>
    </div>
  );
}

export default function JobAnalytics({ jobId, onBack }) {
  const [job,       setJob]       = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    fetch(`${API_BASE}/result/${jobId}`)
      .then(r => r.ok ? r.json() : Promise.reject('Not found'))
      .then(d => {
        setJob({ job_id: jobId, filename: d.filename || jobId, status: d.status });
        setAnalytics(d.analytics);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [jobId]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  if (error || !analytics) return (
    <div className="empty-state" style={{ padding: '80px 24px' }}>
      <div className="empty-state-icon">⚠️</div>
      <div className="empty-state-title">Analytics load nahi ho paya</div>
      <p className="text-muted text-sm">{error || 'Job completed nahi hai ya analytics missing hai'}</p>
      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={onBack}>← Wapas Jao</button>
    </div>
  );

  const { dwell, zones, shelf_breakdown, timeline, peak_crowd, crowd_density_histogram, video_meta } = analytics;

  const crowdLevel = analytics.avg_people_per_frame >= 10
    ? { label: 'High', color: '#dc2626' }
    : analytics.avg_people_per_frame >= 6
    ? { label: 'Medium', color: '#d97706' }
    : { label: 'Low', color: '#16a34a' };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back</button>
          <div>
            <h1 className="page-title">📊 Analytics Dashboard</h1>
            <p className="page-subtitle">
              {job?.filename}
              {video_meta && ` — ${video_meta.width}×${video_meta.height} @ ${video_meta.fps}fps — ${(video_meta.total_frames / video_meta.fps).toFixed(1)}s`}
              {analytics.processing_time_sec && ` — processed in ${analytics.processing_time_sec}s`}
            </p>
          </div>
        </div>
        <a href={`${API_BASE}/jobs/${jobId}/video`} target="_blank" rel="noreferrer" className="btn btn-primary">
          🎬 Download Annotated Video
        </a>
      </div>

      {/* Top Stats */}
      <div className="stat-grid stat-grid-4 mb-24">
        <StatCard label="Total Unique People" value={analytics.total_unique_people} icon="👥" color="#2563eb" sub="Unique global IDs" />
        <StatCard label="Peak Crowd" value={peak_crowd?.count ?? '—'} icon="🔝" color="#7c3aed" sub={peak_crowd ? `at ${peak_crowd.time_sec}s` : ''} />
        <StatCard label="Avg People / Frame" value={analytics.avg_people_per_frame} icon="📈" color={crowdLevel.color} sub={`${crowdLevel.label} density`} />
        <StatCard label="Total Frames" value={analytics.total_frames_processed} icon="🎞️" color="#0284c7" sub={`${analytics.processing_time_sec}s processing`} />
        <StatCard label="Entries" value={analytics.entries} icon="🚶‍♂️" color="#16a34a" sub="Entry zone crossings" />
        <StatCard label="Exits" value={analytics.exits} icon="🚶" color="#dc2626" sub="Exit zone crossings" />
        <StatCard label="Currently Inside" value={analytics.currently_inside} icon="🏪" color="#d97706" sub="At video end" />
        <StatCard label="Shelf Status" value={<ShelfBadge status={analytics.shelf_status} />} icon="🏬" color="#f59e0b" />
      </div>

      {/* Crowd Timeline */}
      {timeline && timeline.length > 0 && (
        <div className="card mb-24">
          <div className="card-header">
            <div>
              <div className="card-title">📈 Crowd Timeline</div>
              <div className="card-subtitle">Har frame mein kitne log the — time ke saath</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid rgba(124,58,237,.2)' }}>
                Peak: {peak_crowd?.count} @ {peak_crowd?.time_sec}s
              </span>
              <span className="badge badge-blue">Avg: {analytics.avg_people_per_frame}/frame</span>
            </div>
          </div>
          <div className="card-body">
            <SparkLine data={timeline} color="#2563eb" height={80} />
          </div>
        </div>
      )}

      <div className="grid-2 mb-24">
        {/* Dwell Time */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">⏱️ Dwell Time</div>
              <div className="card-subtitle">Kitni der log store mein ruke</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Min', value: dwell?.min_sec, color: '#16a34a' },
                { label: 'Avg', value: dwell?.avg_sec, color: '#2563eb' },
                { label: 'Max', value: dwell?.max_sec, color: '#dc2626' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex: 1, background: color + '10', border: `1px solid ${color}30`, borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'var(--font-d)' }}>{value}s</div>
                  <div className="text-xs text-muted">{label}</div>
                </div>
              ))}
            </div>
            <div className="info-row">
              <span className="info-label">People Tracked</span>
              <span className="info-value font-bold">{dwell?.total_people_tracked}</span>
            </div>
          </div>
        </div>

        {/* Crowd Density Histogram */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">👥 Crowd Density Distribution</div>
              <div className="card-subtitle">Kitne frames mein kitne log the</div>
            </div>
          </div>
          <div className="card-body">
            <DensityChart histogram={crowd_density_histogram} />
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              {[
                { label: 'Empty', color: '#e2e8f0' },
                { label: '1–5', color: '#22c55e' },
                { label: '6–9', color: '#f59e0b' },
                { label: '10+', color: '#ef4444' },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                  <span className="text-xs text-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Shelf Breakdown */}
      {shelf_breakdown && (
        <div className="card mb-24">
          <div className="card-header">
            <div>
              <div className="card-title">🏪 Shelf Status Breakdown</div>
              <div className="card-subtitle">Frame-wise shelf occupancy analysis</div>
            </div>
            <ShelfBadge status={analytics.shelf_status} />
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              {Object.entries(shelf_breakdown).map(([k, v]) => {
                const total = Object.values(shelf_breakdown).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                const colors = { 'NORMAL': '#16a34a', 'LOW STOCK': '#d97706', 'EMPTY': '#dc2626', 'NO SHELF DETECTED': '#94a3b8' };
                const c = colors[k] || '#94a3b8';
                return (
                  <div key={k} style={{ background: c + '10', border: `1px solid ${c}30`, borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: 'var(--font-d)' }}>{pct}%</div>
                    <div className="text-xs" style={{ color: c, fontWeight: 600, marginBottom: 2 }}>{k}</div>
                    <div className="text-xs text-muted">{v} frames</div>
                  </div>
                );
              })}
            </div>
            {Object.entries(shelf_breakdown).map(([k, v]) => {
              const total = Object.values(shelf_breakdown).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              const colors = { 'NORMAL': '#16a34a', 'LOW STOCK': '#d97706', 'EMPTY': '#dc2626', 'NO SHELF DETECTED': '#94a3b8' };
              return (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div className="flex-between mb-8">
                    <span className="text-sm" style={{ fontWeight: 500 }}>{k}</span>
                    <span className="text-sm text-muted">{v} frames ({pct}%)</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: colors[k] || 'var(--brand)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Zone Analytics */}
      {zones && (
        <div className="card mb-24">
          <div className="card-header">
            <div>
              <div className="card-title">📍 Zone Analytics</div>
              <div className="card-subtitle">Custom zones mein traffic breakdown</div>
            </div>
            {zones.most_popular && (
              <span className="badge badge-blue">🔥 Most Popular: {zones.most_popular}</span>
            )}
          </div>
          <div className="card-body">
            {Object.keys(zones.avg_per_frame || {}).length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-icon">📍</div>
                <div className="empty-state-title">Koi zone data nahi</div>
                <p className="text-muted text-sm">Video process karte waqt zones draw karo</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {Object.keys(zones.avg_per_frame || {}).map((zone, i) => {
                  const colors = ['#2563eb', '#16a34a', '#d97706', '#a855f7', '#ef4444'];
                  const c = colors[i % colors.length];
                  const isPopular = zones.most_popular === zone;
                  const totalVisitors = Object.values(zones.unique_visitors || {}).reduce((a, b) => a + b, 0);
                  const sharePct = totalVisitors > 0 ? Math.round(((zones.unique_visitors[zone] || 0) / totalVisitors) * 100) : 0;
                  return (
                    <div key={zone} style={{
                      background: isPopular ? '#eff6ff' : '#f8fafc',
                      border: `1.5px solid ${isPopular ? 'rgba(37,99,235,.3)' : 'var(--border)'}`,
                      borderRadius: 'var(--r-lg)', padding: 20,
                      borderTop: `4px solid ${c}`,
                    }}>
                      <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: 16, color: c, marginBottom: 14 }}>
                        {zone} {isPopular && '🔥'}
                      </div>
                      <div className="info-row">
                        <span className="info-label">Avg / Frame</span>
                        <span className="info-value font-bold">{zones.avg_per_frame[zone]}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Unique Visitors</span>
                        <span className="info-value font-bold" style={{ color: c }}>{zones.unique_visitors?.[zone] ?? 0}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Traffic Share</span>
                        <span className="info-value font-bold">{sharePct}%</span>
                      </div>
                      <div className="progress-bar" style={{ marginTop: 10 }}>
                        <div className="progress-fill" style={{ width: `${sharePct}%`, background: c }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Heatmap */}
      {zones?.heatmap && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🌡️ Movement Heatmap</div>
              <div className="card-subtitle">Store mein log kahan zyada gaye — red = high traffic area</div>
            </div>
            {video_meta && (
              <span className="badge" style={{ background: '#f8fafc', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                {video_meta.width}×{video_meta.height}
              </span>
            )}
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="text-xs text-muted">← Left side of store</span>
              <span className="text-xs text-muted">Right side of store →</span>
            </div>
            <HeatmapGrid data={zones.heatmap} />
          </div>
        </div>
      )}
    </div>
  );
}
