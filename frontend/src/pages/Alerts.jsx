/* pages/Alerts.jsx — Retail AI Alert Center */
import React, { useState } from 'react';
import useAppStore from '../store/appStore';

const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export default function Alerts() {
  const { alerts, markAlertRead, markAllAlertsRead, getStats } = useAppStore();
  const [filter, setFilter] = useState('ALL');
  const stats = getStats();

  const filtered = filter === 'ALL' ? alerts
    : filter === 'UNREAD' ? alerts.filter(a => !a.read)
    : alerts.filter(a => a.severity === filter);

  const sorted = [...filtered].reverse();

  const sevIcon = { CRITICAL: '🔴', HIGH: '🟡', MEDIUM: '🟣', LOW: '🔵', INFO: '⚪' };

  return (
    <div>
      {/* Stats row */}
      <div className="stat-grid stat-grid-4 mb-20">
        {[
          { label: 'Total Alerts',    value: stats.total,    color: 'var(--text-secondary)' },
          { label: 'Unread',          value: stats.unread,   color: 'var(--brand)' },
          { label: 'Critical',        value: stats.critical, color: 'var(--red)' },
          { label: 'High',            value: alerts.filter(a => a.severity === 'HIGH').length, color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: 28 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">🔔 Alert Center</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Filters */}
            {['ALL', 'UNREAD', 'CRITICAL', 'HIGH'].map(f => (
              <button key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
            {stats.unread > 0 && (
              <button className="btn btn-sm btn-secondary" onClick={markAllAlertsRead}>
                ✓ Mark all read
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {sorted.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">No alerts</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {filter === 'ALL' ? 'System is running normally' : `No ${filter.toLowerCase()} alerts`}
              </div>
            </div>
          ) : (
            sorted.map(alert => (
              <div key={alert.id}
                className={`alert-item sev-${alert.severity}${!alert.read ? ' unread' : ''}`}
                onClick={() => markAlertRead(alert.id)}
                style={{ opacity: alert.read ? 0.7 : 1 }}
              >
                <div style={{ fontSize: 20, flexShrink: 0 }}>{sevIcon[alert.severity] || '⚪'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`badge badge-${alert.severity}`}>{alert.severity}</span>
                    {alert.zone && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {alert.zone}</span>}
                    {!alert.read && <span style={{ fontSize: 10, background: 'var(--brand-light)', color: 'var(--brand)', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>NEW</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{alert.message}</div>
                  {alert.timestamp && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-m)' }}>
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
