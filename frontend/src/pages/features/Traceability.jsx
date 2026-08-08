/**
 * Traceability.jsx — Board Traceability (QR → Batch → History)
 * Scan or enter Board ID to see full manufacturing history.
 * Production-level: links board to batch, operator, shift, defects.
 */
import React, { useState } from 'react';
import useAppStore from '../../store/appStore';

export default function Traceability() {
  const { boards: storeBoards } = useAppStore();
  const API_BASE = 'http://localhost:8000';
  const [dbBoards, setDbBoards] = React.useState([]);
  const [dbLoaded, setDbLoaded] = React.useState(false);

  React.useEffect(() => {
    // Fetch real boards from DB on load
    fetch(`${API_BASE}/inspect/history?limit=500`)
      .then(r => r.json())
      .then(d => {
        if (d.boards?.length) { setDbBoards(d.boards); setDbLoaded(true); }
      })
      .catch(() => {});
  }, []);

  // Merge: prefer DB data (real), fill with store data (session)
  const boards = dbLoaded ? dbBoards : storeBoards;
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = boards.filter(b =>
    b.board_id.toLowerCase().includes(search.toLowerCase()) ||
    (b.batch_id||'').toLowerCase().includes(search.toLowerCase())
  ).reverse().slice(0,50);

  const select = (b) => setSelected(b);

  const decColor = { APPROVE:'var(--green)', REJECT:'var(--red)', FLAG_FOR_REVIEW:'var(--amber)', PASS_WITH_LOG:'var(--brand)' };

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'var(--font-d)', fontSize:20, fontWeight:700, marginBottom:4 }}>🔍 Traceability — Board History</div>
        <div style={{ color:'var(--text-muted)', fontSize:13 }}>Search any board ID or batch number to view complete manufacturing history</div>
      </div>

      {/* Search */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <input className="form-input" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search Board ID (PCB-10042) or Batch (BATCH-001)…"
          style={{ flex:1, fontFamily:'var(--font-m)', fontSize:13 }}/>
        <button className="btn btn-secondary" onClick={() => setSearch('')}>Clear</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:16, alignItems:'start' }}>
        {/* Board list */}
        <div className="card" style={{ maxHeight:600, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div className="card-header">
            <div className="card-title">Boards ({filtered.length})</div>
          </div>
          <div style={{ overflowY:'auto', flex:1 }}>
            {filtered.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-title">No boards yet</div></div>
            ) : filtered.map(b => (
              <div key={b.board_id} onClick={() => select(b)} style={{
                padding:'10px 16px', cursor:'pointer', borderBottom:'1px solid var(--border)',
                background: selected?.board_id===b.board_id ? 'var(--brand-light)' : '#fff',
                borderLeft: selected?.board_id===b.board_id ? '3px solid var(--brand)' : '3px solid transparent',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontFamily:'var(--font-m)', fontWeight:700, fontSize:13, color:'var(--brand)' }}>{b.board_id}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                      {b.batch_id||'—'} · {b.shift||'—'} shift · {b.timestamp ? new Date(b.timestamp).toLocaleTimeString('en-GB',{hour12:false}) : '—'}
                    </div>
                  </div>
                  <span className={`badge badge-${b.decision||"APPROVE"}`} style={{ fontSize:10 }}>{(b.decision||"").replace('_',' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Board detail */}
        <div>
          {!selected ? (
            <div className="card">
              <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
                <div style={{ fontSize:40, marginBottom:12, opacity:.3 }}>🔍</div>
                <div style={{ fontSize:14, fontWeight:600 }}>Select a board to view traceability</div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ fontFamily:'var(--font-m)', color:'var(--brand)' }}>{selected.board_id}</div>
                  <div className="card-subtitle">{selected.batch_id||'—'} · {selected.line_id||'LINE-A'}</div>
                </div>
                <span className={`badge badge-${selected.decision||"APPROVE"}`}>{(selected.decision||"").replace('_',' ')}</span>
              </div>
              <div className="card-body">
                {/* Traceability timeline */}
                <div style={{ marginBottom:16 }}>
                  <div className="section-title mb-8">Manufacturing Journey</div>
                  {[
                    { step:'📥 Board Received',      time: selected.timestamp, status:'done', detail:`Batch ${selected.batch_id||'?'} · Line ${selected.line_id||'?'}` },
                    { step:'⚙ AOI Inspection',       time: selected.timestamp, status:'done', detail:`${selected.inference_ms}ms · CAM-01 · YOLOv11` },
                    { step:selected.total_defects>0?'⚠ Defects Detected':'✅ Quality Check',
                      time: selected.timestamp, status: selected.total_defects>0?'warn':'done',
                      detail: selected.total_defects>0
                        ? `${selected.total_defects} defect(s): ${selected.defects_found?.map(d=>d.class_name).join(', ')}`
                        : 'No defects detected — clear to proceed' },
                    { step: selected.decision==='REJECT'?'⊘ Rejected — Rework Queue':
                             selected.decision==='FLAG_FOR_REVIEW'?'👀 Human Review Queue':
                             '✅ Passed — To Assembly',
                      time: selected.timestamp, status: selected.decision==='REJECT'?'fail': selected.decision==='FLAG_FOR_REVIEW'?'warn':'done',
                      detail: selected.decision==='REJECT'?'Board sent for rework/scrap analysis':
                              selected.decision==='FLAG_FOR_REVIEW'?'Awaiting QC Manager review':
                              'Board cleared for next assembly stage' },
                  ].map((s,i) => (
                    <div key={i} style={{ display:'flex', gap:12, paddingBottom:12, borderBottom:i<3?'1px dashed var(--border)':'none', marginBottom:i<3?12:0 }}>
                      <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center' }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                          background: s.status==='done'?'var(--green-light)':s.status==='warn'?'var(--amber-light)':'var(--red-light)',
                          border: `2px solid ${s.status==='done'?'var(--green-border)':s.status==='warn'?'var(--amber-border)':'var(--red-border)'}` }}>
                          {s.status==='done'?'✓':s.status==='warn'?'!':'✗'}
                        </div>
                        {i<3 && <div style={{ width:1, flex:1, background:'var(--border)', marginTop:4 }}/>}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{s.step}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-m)', marginBottom:2 }}>
                          {s.time ? new Date(s.time).toLocaleTimeString('en-GB',{hour12:false}) : '—'}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{s.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Key metrics */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  {[
                    ['Board ID',    selected.board_id,          'var(--brand)'],
                    ['Batch',       selected.batch_id||'—',     'var(--text-primary)'],
                    ['Shift',       selected.shift||'Morning',   'var(--text-primary)'],
                    ['Line',        selected.line_id||'LINE-A',  'var(--text-primary)'],
                    ['Inference',   `${selected.inference_ms}ms`,'var(--text-primary)'],
                    ['Defects',     selected.total_defects,      selected.total_defects>0?'var(--red)':'var(--green)'],
                  ].map(([l,v,c]) => (
                    <div key={l} style={{ padding:'8px 12px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:2 }}>{l}</div>
                      <div style={{ fontFamily:'var(--font-m)', fontWeight:700, fontSize:13, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Defects detail */}
                {selected.defects_found?.length > 0 && (
                  <div>
                    <div className="section-title mb-8">Detected Defects</div>
                    {selected.defects_found?.map((d,i) => (
                      <div key={i} style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${d.color}25`, background:`${d.color}08`, marginBottom:6, display:'flex', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:d.color, flexShrink:0 }}/>
                          <div>
                            <span style={{ fontWeight:700, color:d.color, fontSize:12 }}>{d.class_name}</span>
                            <span className={`badge badge-${d.severity}`} style={{ fontSize:9, marginLeft:6 }}>{d.severity}</span>
                          </div>
                        </div>
                        <span style={{ fontFamily:'var(--font-m)', fontWeight:600, fontSize:12 }}>{(d.confidence*100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
