/**
 * BatchExport.jsx — Batch Report Export (PDF / CSV / Excel)
 * Generate and download shift reports, defect logs, compliance docs.
 */
import React, { useState } from 'react';
import useAppStore from '../../store/appStore';
import api from '../../utils/api';

export default function BatchExport() {
  const { boards: storeBoards, getStats } = useAppStore();
  const [dbBoards, setDbBoards] = React.useState([]);
  const [dbLoaded, setDbLoaded] = React.useState(false);

  React.useEffect(() => {
    api.get('/inspect/history?limit=1000')
      .then(r => { if (r.data.boards?.length) { setDbBoards(r.data.boards); setDbLoaded(true); } })
      .catch(() => {});
  }, []);

  const boards = dbLoaded ? dbBoards : storeBoards;
  const storeStats = getStats();
  
  // Calculate stats from DB boards if available, otherwise use Zustand
  const stats = dbLoaded ? (() => {
    const total = dbBoards.length;
    const approved = dbBoards.filter(b => b.decision === 'APPROVE').length;
    const rejected = dbBoards.filter(b => b.decision === 'REJECT').length;
    const flagged = dbBoards.filter(b => b.decision === 'FLAG_FOR_REVIEW').length;
    const passRate = total > 0 ? ((approved / total) * 100).toFixed(1) : '0.0';
    const totalDef = dbBoards.reduce((s, b) => s + (b.total_defects || 0), 0);
    const dpmo = total > 0 ? Math.round((totalDef / (total * 6)) * 1_000_000) : 0;
    return { total, approved, rejected, flagged, passRate, dpmo };
  })() : storeStats;
  const [exporting, setExporting] = useState('');

  const exportCSV = () => {
    setExporting('csv');
    const rows = [['Board ID','Batch','Shift','Line','Zone','Decision','Defects','Defect Classes','Confidence','Inference ms','Line Halt','Timestamp']];
    boards.forEach(b => rows.push([
      b.board_id, b.batch_id||'—', b.shift||'Morning', b.line_id||'LINE-A', b.zone,
      b.decision,
      b.total_defects,
      b.defects_found?.map(d=>d.class_name).join(';') || '—',
      b.defects_found?.[0] ? (b.defects_found[0].confidence*100).toFixed(1)+'%' : '—',
      b.inference_ms,
      b.line_halt_required ? 'YES' : 'NO',
      new Date(b.timestamp).toLocaleString(),
    ]));
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `pcb-guardian-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    setTimeout(() => setExporting(''), 1200);
  };

  const exportJSON = () => {
    setExporting('json');
    const data = {
      exported_at: new Date().toISOString(),
      summary: { ...stats, dpmo: stats.dpmo },
      boards: boards.map(b => ({
        board_id:      b.board_id,
        batch_id:      b.batch_id,
        decision:      b.decision,
        total_defects: b.total_defects,
        defects:       b.defects_found,
        inference_ms:  b.inference_ms,
        timestamp:     b.timestamp,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `pcb-guardian-data-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    setTimeout(() => setExporting(''), 1200);
  };

  const exportPDF = async () => {
    setExporting('pdf');
    try {
      const token = localStorage.getItem('pcbg_token');
      const res = await fetch(('http://localhost:8000') + '/reports/shift/pdf', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ shift:'Current', total:stats.total, pass_rate:stats.passRate, rejected:stats.rejected }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const a    = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = `pcb-guardian-report-${new Date().toISOString().slice(0,10)}.pdf`;
        a.click();
      }
    } catch(_) { alert('Backend not running — PDF requires backend'); }
    setTimeout(() => setExporting(''), 1500);
  };

  const EXPORTS = [
    { id:'csv',  icon:'📊', label:'CSV Export',       sub:'All boards · defects · decisions · timestamps', color:'var(--green)',  action: exportCSV  },
    { id:'json', icon:'📋', label:'JSON Export',       sub:'Full structured data · API-ready format',       color:'var(--brand)',  action: exportJSON },
    { id:'pdf',  icon:'📄', label:'PDF Shift Report',  sub:'Formatted report · requires backend running',   color:'var(--red)',    action: exportPDF  },
  ];

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'var(--font-d)', fontSize:20, fontWeight:700, marginBottom:4 }}>📦 Batch Export Center</div>
        <div style={{ color:'var(--text-muted)', fontSize:13 }}>Export inspection data for compliance, ERP integration, and management reporting</div>
      </div>

      {/* Summary stats */}
      <div className="stat-grid stat-grid-4 mb-20">
        {[
          { l:'Total Boards',  v:stats.total,         c:'var(--brand)'    },
          { l:'Pass Rate',     v:`${stats.passRate}%`, c:parseFloat(stats.passRate)>=97?'var(--green)':'var(--amber)' },
          { l:'Rejected',      v:stats.rejected,       c:'var(--red)'      },
          { l:'DPMO',          v:(stats.dpmo||0).toLocaleString(), c:'var(--text-primary)' },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <div className="stat-label">{s.l}</div>
            <div style={{ fontFamily:'var(--font-d)', fontSize:26, fontWeight:700, color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Export options */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {EXPORTS.map(e => (
          <div key={e.id} className="card" style={{ border: `1px solid ${e.color}20` }}>
            <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:`${e.color}12`, border:`1px solid ${e.color}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                  {e.icon}
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{e.label}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{e.sub}</div>
                </div>
              </div>
              <button onClick={e.action} disabled={!!exporting || boards.length===0} style={{
                padding:'9px 20px', borderRadius:8, cursor: boards.length===0?'not-allowed':'pointer',
                fontFamily:'var(--font-b)', fontSize:13, fontWeight:600, border:'none',
                background: exporting===e.id ? 'var(--border)' : e.color,
                color: exporting===e.id ? 'var(--text-muted)' : '#fff',
                display:'flex', alignItems:'center', gap:6, opacity:boards.length===0?0.5:1,
              }}>
                {exporting===e.id ? <><span className="spinner" style={{width:13,height:13}}/> Exporting…</> : `⬇ Download ${e.id.toUpperCase()}`}
              </button>
            </div>
          </div>
        ))}
      </div>

      {boards.length === 0 && (
        <div style={{ marginTop:12, padding:'10px 14px', background:'var(--amber-light)', border:'1px solid var(--amber-border)', borderRadius:8, fontSize:12, color:'var(--amber)', fontWeight:500 }}>
          ⚠ No boards inspected yet — start the simulation or connect a camera to generate data
        </div>
      )}
    </div>
  );
}
