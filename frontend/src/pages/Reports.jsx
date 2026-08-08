/* pages/Reports.jsx — PDF & Excel Report Export */
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';

function DownloadBtn({ href, label, icon, color }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res  = await fetch(href);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = href.split('/').pop() + (href.includes('pdf') ? '.pdf' : '.xlsx');
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <button
      className="btn btn-sm"
      style={{ background: color + '15', color, border: `1px solid ${color}40` }}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? <span className="spinner"/> : icon} {label}
    </button>
  );
}

export default function Reports() {
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/jobs/`)
      .then(r => r.ok ? r.json() : { jobs: [] })
      .then(d => { setJobs((d.jobs || []).filter(j => j.status === 'completed')); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Shift Summary */}
      <div className="card mb-20">
        <div className="card-header">
          <div>
            <div className="card-title">📊 Shift Summary Report</div>
            <div className="card-subtitle">All completed jobs combined into one document</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <DownloadBtn
              href={`${API_BASE}/reports/shift/pdf`}
              label="Download PDF"
              icon="📄"
              color="var(--red)"
            />
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { icon: '📹', label: 'Completed Jobs', value: jobs.length },
              { icon: '📄', label: 'PDF Report',     value: 'Footfall + Zones + Alerts' },
              { icon: '📊', label: 'Excel Report',   value: '6 sheets — full data' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, minWidth: 160, padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-Job Reports */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📹 Per-Job Reports</div>
          <div className="card-subtitle" style={{ marginTop: 2 }}>Download PDF or Excel for each completed analysis</div>
        </div>

        {loading ? (
          <div style={{ padding: 32 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-row" style={{ height: 52, marginBottom: 8, borderRadius: 'var(--r)', background: 'var(--border)', animation: 'skeletonPulse 1.5s ease infinite' }}/>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No completed jobs yet</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Upload and process a video to generate reports</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Entries</th>
                  <th>Exits</th>
                  <th>Peak</th>
                  <th>Shelf</th>
                  <th>Completed</th>
                  <th>Export</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.job_id}>
                    <td style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>{j.filename}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{j.entries ?? '—'}</td>
                    <td style={{ color: 'var(--red)', fontWeight: 600 }}>{j.exits ?? '—'}</td>
                    <td>{j.peak ?? '—'}</td>
                    <td>
                      <span className={`badge badge-${j.shelf_status === 'EMPTY' ? 'CRITICAL' : j.shelf_status === 'LOW STOCK' ? 'HIGH' : 'active'}`}>
                        {j.shelf_status || 'NORMAL'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {j.completed_at ? new Date(j.completed_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <DownloadBtn
                          href={`${API_BASE}/reports/${j.job_id}/pdf`}
                          label="PDF"
                          icon="📄"
                          color="var(--red)"
                        />
                        <DownloadBtn
                          href={`${API_BASE}/reports/${j.job_id}/excel`}
                          label="Excel"
                          icon="📊"
                          color="var(--green)"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
