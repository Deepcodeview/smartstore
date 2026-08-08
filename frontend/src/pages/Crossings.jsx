/* pages/Crossings.jsx — Footfall Log (standalone) */
import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

export default function Crossings() {
  const [jobs,    setJobs]    = useState([]);
  const [selJob,  setSelJob]  = useState(null);
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState('all');

  useEffect(() => {
    fetch(`${API_BASE}/jobs/`)
      .then(r => r.ok ? r.json() : { jobs: [] })
      .then(d => {
        const completed = (d.jobs || []).filter(j => j.status === 'completed');
        setJobs(completed);
        if (completed.length > 0) setSelJob(completed[0].job_id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selJob) return;
    setLoading(true);
    fetch(`${API_BASE}/jobs/${selJob}/crossings`)
      .then(r => r.ok ? r.json() : { events: [] })
      .then(d => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [selJob]);

  const filtered = filter === 'all' ? events : events.filter(e => e.event_type === filter);
  const entries  = events.filter(e => e.event_type === 'entry').length;
  const exits    = events.filter(e => e.event_type === 'exit').length;

  return (
    <div>
      {/* Job selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', flexShrink: 0 }}>Select Job:</label>
        <select className="form-input" style={{ maxWidth: 320 }} value={selJob || ''} onChange={e => setSelJob(e.target.value)}>
          {jobs.length === 0 && <option value="">No completed jobs</option>}
          {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.filename}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ padding: '4px 12px', background: 'var(--green-light)', color: 'var(--green)', border: '1px solid var(--green-border)', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            ↓ {entries} Entries
          </span>
          <span style={{ padding: '4px 12px', background: 'var(--red-light)', color: 'var(--red)', border: '1px solid var(--red-border)', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            ↑ {exits} Exits
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'entry', 'exit'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? `All (${events.length})` : f === 'entry' ? `Entries (${entries})` : `Exits (${exits})`}
          </button>
        ))}
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🚶</div>
          <div className="empty-state-title">No completed jobs</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Upload and process a video first</div>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" style={{ width: 32, height: 32 }}/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">No crossing events found</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="data-table">
              <thead><tr>
                <th>#</th><th>Person ID</th><th>Event</th><th>Time (sec)</th><th>Wall Time</th>
              </tr></thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id}>
                    <td className="text-muted text-sm">{i + 1}</td>
                    <td><span className="badge badge-blue cell-mono">ID #{e.global_id}</span></td>
                    <td>
                      {e.event_type === 'entry'
                        ? <span className="badge badge-APPROVE">↓ Entry</span>
                        : <span className="badge badge-REJECT">↑ Exit</span>}
                    </td>
                    <td className="cell-mono text-sm">{e.timestamp_sec?.toFixed(2)}s</td>
                    <td className="text-sm text-muted">{e.wall_time?.slice(0, 19).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
