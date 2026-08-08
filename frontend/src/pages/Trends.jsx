/* pages/Trends.jsx — Historical Trends Dashboard */
import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { API_BASE } from '../utils/api';

const COLORS = {
  entries:  '#0057ff',
  exits:    '#e53e3e',
  Entrance: '#0057ff',
  Electronics: '#7c3aed',
  Grocery:  '#16a34a',
  Checkout: '#d97706',
  Apparel:  '#0891b2',
};

function StatCard({ label, value, sub, color = 'var(--brand)' }) {
  return (
    <div className="stat-card-premium" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }}/>
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Trends() {
  const [tab,     setTab]     = useState('daily');
  const [daily,   setDaily]   = useState([]);
  const [weekly,  setWeekly]  = useState([]);
  const [pattern, setPattern] = useState([]);
  const [zones,   setZones]   = useState({ zones: [], timeline: [], zone_totals: {} });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/trends/daily`).then(r => r.json()),
      fetch(`${API_BASE}/trends/weekly`).then(r => r.json()),
      fetch(`${API_BASE}/trends/day-pattern`).then(r => r.json()),
      fetch(`${API_BASE}/trends/zones`).then(r => r.json()),
      fetch(`${API_BASE}/trends/summary`).then(r => r.json()),
    ]).then(([d, w, p, z, s]) => {
      setDaily(d.days || []);
      setWeekly(w.weeks || []);
      setPattern(p.pattern || []);
      setZones(z);
      setSummary(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="stat-grid stat-grid-4 mb-20">
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 90, borderRadius: 'var(--r-lg)', background: 'var(--border)', animation: 'skeletonPulse 1.5s ease infinite' }}/>
          ))}
        </div>
        <div style={{ height: 300, borderRadius: 'var(--r-lg)', background: 'var(--border)', animation: 'skeletonPulse 1.5s ease infinite' }}/>
      </div>
    );
  }

  const hasData = daily.some(d => d.entries > 0 || d.exits > 0);

  return (
    <div>
      {/* Summary KPIs */}
      {summary && (
        <div className="stat-grid stat-grid-4 mb-20">
          <StatCard label="Total Jobs"       value={summary.total_jobs}          color="var(--text-secondary)" sub="Completed analyses"/>
          <StatCard label="Total Entries"    value={summary.total_entries}        color="var(--brand)"          sub="All time footfall"/>
          <StatCard label="Avg / Job"        value={summary.avg_entries_per_job}  color="var(--purple)"         sub="Entries per video"/>
          <StatCard label="Top Zone"         value={summary.top_zone || '—'}      color="var(--green)"          sub="Most visited zone"/>
        </div>
      )}

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'daily',   label: '📅 Daily (30d)' },
          { id: 'weekly',  label: '📆 Weekly (12w)' },
          { id: 'pattern', label: '🗓️ Day Pattern' },
          { id: 'zones',   label: '🗺️ Zone Trends' },
        ].map(t => (
          <button key={t.id}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      {!hasData && tab !== 'zones' && (
        <div className="card">
          <div className="empty-state" style={{ padding: 64 }}>
            <div className="empty-state-icon">📈</div>
            <div className="empty-state-title">No historical data yet</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Complete some video jobs to see trends here</div>
          </div>
        </div>
      )}

      {tab === 'daily' && hasData && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">📅 Daily Footfall — Last 30 Days</div>
              <div className="card-subtitle">Entries and exits per day</div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gEntries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0057ff" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0057ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gExits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#e53e3e" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#e53e3e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
                <Area type="monotone" dataKey="entries" name="Entries" stroke="#0057ff" strokeWidth={2} fill="url(#gEntries)"/>
                <Area type="monotone" dataKey="exits"   name="Exits"   stroke="#e53e3e" strokeWidth={2} fill="url(#gExits)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'weekly' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📆 Weekly Footfall — Last 12 Weeks</div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weekly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
                <Bar dataKey="entries" name="Entries" fill="#0057ff" radius={[4,4,0,0]}/>
                <Bar dataKey="exits"   name="Exits"   fill="#e53e3e" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'pattern' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🗓️ Day-of-Week Pattern</div>
              <div className="card-subtitle">Average footfall by weekday</div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={pattern} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
                <Bar dataKey="avg_entries" name="Avg Entries" fill="#0057ff" radius={[4,4,0,0]}/>
                <Bar dataKey="avg_exits"   name="Avg Exits"   fill="#e53e3e" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--brand-light)', borderRadius: 'var(--r)', border: '1px solid rgba(0,87,255,.1)', fontSize: 12, color: 'var(--text-secondary)' }}>
              💡 <strong>Insight:</strong> Use this to plan staffing — schedule more staff on high-footfall days.
            </div>
          </div>
        </div>
      )}

      {tab === 'zones' && (
        <div>
          {/* Zone totals */}
          <div className="stat-grid stat-grid-4 mb-16">
            {Object.entries(zones.zone_totals || {})
              .sort((a, b) => b[1] - a[1])
              .map(([zone, count]) => (
                <div key={zone} className="stat-card-premium" style={{ borderTop: `3px solid ${COLORS[zone] || 'var(--brand)'}` }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{zone}</div>
                  <div style={{ fontFamily: 'var(--font-d)', fontSize: 26, fontWeight: 700, color: COLORS[zone] || 'var(--brand)' }}>{count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>total visitors</div>
                </div>
              ))}
          </div>

          {/* Zone timeline */}
          {zones.timeline?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">🗺️ Zone Visitors — Last 14 Days</div>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={zones.timeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Legend wrapperStyle={{ fontSize: 12 }}/>
                    {(zones.zones || []).map(z => (
                      <Line key={z} type="monotone" dataKey={z} name={z}
                        stroke={COLORS[z] || '#94a3b8'} strokeWidth={2}
                        dot={false} activeDot={{ r: 4 }}/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!zones.timeline?.length && (
            <div className="card">
              <div className="empty-state" style={{ padding: 64 }}>
                <div className="empty-state-icon">🗺️</div>
                <div className="empty-state-title">No zone data yet</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Complete video jobs with zones configured</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
