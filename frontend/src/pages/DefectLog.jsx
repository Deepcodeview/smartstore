/* pages/DefectLog.jsx — From HTML demo (exact match) */
import React, { useState } from 'react';
import useAppStore from '../store/appStore';
import api from '../utils/api';

const DECISIONS = ['ALL','REJECT','FLAG_FOR_REVIEW','PASS_WITH_LOG'];

export default function DefectLog() {
  const { boards: storeBoards } = useAppStore();
  const [dbBoards, setDbBoards] = React.useState([]);
  const [dbLoaded, setDbLoaded] = React.useState(false);

  React.useEffect(() => {
    api.get('/inspect/history?limit=500')
      .then(r => {
        if (r.data.boards?.length) {
          setDbBoards(r.data.boards);
          setDbLoaded(true);
        }
      })
      .catch(() => {});
  }, []);

  // Use real DB data when available, fall back to session store
  const boards = dbLoaded ? dbBoards : storeBoards;
  const [filter, setFilter] = useState('ALL');

  const defectiveBoards = boards.filter(b => (b.defects_found?.length ?? 0) > 0).reverse();
  const filtered = filter==='ALL' ? defectiveBoards : defectiveBoards.filter(b => b.decision===filter);
  const counts = { ALL: defectiveBoards.length, REJECT:0, FLAG_FOR_REVIEW:0, PASS_WITH_LOG:0 };
  defectiveBoards.forEach(b => { if (b.decision) counts[b.decision] = (counts[b.decision]||0)+1; });

  const dlCSV = () => {
    const rows = [['Board ID','Zone','Decision','Defect','Severity','Confidence','Line Halt','Time']];
    filtered.forEach(b => (b.defects_found||[]).forEach(d => rows.push([
      b.board_id, b.zone, b.decision, d.class_name, d.severity,
      (d.confidence*100).toFixed(1)+'%', b.line_halt_required?'Yes':'No',
      b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : '—',
    ])));
    const blob = new Blob([rows.map(r=>r.join(',')).join('\n')], {type:'text/csv'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='defect-log.csv'; a.click();
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {DECISIONS.map(d => (
            <button key={d} onClick={() => setFilter(d)} style={{
              padding:'7px 14px', borderRadius:20, cursor:'pointer', fontFamily:'var(--font-b)', fontSize:12, fontWeight:600,
              border: filter===d ? 'none' : '1px solid var(--border)',
              background: filter===d ? (d==='REJECT'?'var(--red)':d==='FLAG_FOR_REVIEW'?'var(--amber)':d==='PASS_WITH_LOG'?'var(--brand)':'var(--text-primary)') : '#fff',
              color: filter===d ? '#fff' : 'var(--text-secondary)', transition:'all .15s',
            }}>
              {d.replace('_',' ')} ({counts[d]||0})
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={dlCSV}>⬇ Export CSV</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Defect Log</div>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>{filtered.length} records</span>
        </div>
        <div className="table-wrapper" style={{ borderRadius:'0 0 var(--r-lg) var(--r-lg)', border:'none' }}>
          <table className="data-table">
            <thead>
              <tr><th>Board ID</th><th>Zone</th><th>Decision</th><th>Defect</th><th>Severity</th><th>Confidence</th><th>Line Halt</th><th>Time</th></tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>No defects recorded yet</td></tr>
              ) : filtered.slice(0,100).flatMap(b =>
                (b.defects_found||[]).map((d,i) => (
                  <tr key={`${b.board_id}-${i}`}>
                    <td className="cell-mono" style={{ color:'var(--brand)', fontWeight:600 }}>{b.board_id}</td>
                    <td style={{ fontSize:12 }}>{b.zone}</td>
                    <td><span className={`badge badge-${b.decision||"APPROVE"}`} style={{ fontSize:10 }}>{(b.decision||"").replace('_',' ')}</span></td>
                    <td style={{ fontWeight:600, color:d.color }}>{d.class_name}</td>
                    <td><span className={`badge badge-${d.severity}`} style={{ fontSize:10 }}>{d.severity}</span></td>
                    <td className="cell-mono">{(d.confidence*100).toFixed(1)}%</td>
                    <td>{b.line_halt_required ? <span style={{ color:'var(--red)', fontWeight:700, fontSize:12 }}>⊘ Yes</span> : <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>}</td>
                    <td className="cell-mono" style={{ color:'var(--text-muted)' }}>{b.timestamp ? new Date(b.timestamp).toLocaleTimeString('en-GB',{hour12:false}) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
