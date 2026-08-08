/**
 * GoldenBoard.jsx — Golden Board Comparison (Enterprise)
 * Compare current PCB against reference "golden" board image.
 * Highlights structural differences using pixel diff visualization.
 */
import React, { useRef, useState, useEffect } from 'react';
import useAppStore from '../../store/appStore';

const DIFF_COLORS = {
  missing:  '#DC2626',
  extra:    '#D97706',
  shifted:  '#7C3AED',
  ok:       '#16a34a',
};

/* Mini PCB visual for golden board comparison */
function BoardPreview({ defects = [], label = '', borderColor = 'var(--border)' }) {
  return (
    <div style={{ position:'relative', background:'#0a0e14', borderRadius:10, overflow:'hidden',
      aspectRatio:'4/3', border:`2px solid ${borderColor}`, width:'100%' }}>
      <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:'8%', width:'84%', height:'84%' }}>
        <rect x="2" y="2" width="96" height="96" rx="3" fill="#1a3320" stroke="#2d5535" strokeWidth="1.5"/>
        {[20,40,60,80].map(x=><line key={x} x1={x} y1="2" x2={x} y2="98" stroke="rgba(0,180,60,.08)" strokeWidth=".3"/>)}
        {[20,40,60,80].map(y=><line key={y} x1="2" y1={y} x2="98" y2={y} stroke="rgba(0,180,60,.08)" strokeWidth=".3"/>)}
        <path d="M10 30H45V15H65" stroke="#c8820a" strokeWidth="1" fill="none"/>
        <path d="M10 70H88" stroke="#c8820a" strokeWidth="1" fill="none"/>
        <rect x="22" y="20" width="22" height="14" rx="1" fill="#0f172a" stroke="#1e40af" strokeWidth=".6"/>
        <text x="33" y="29" textAnchor="middle" fontSize="3.5" fill="#6366f1" fontFamily="monospace">IC1</text>
        <rect x="57" y="18" width="16" height="12" rx="1" fill="#0f172a" stroke="#1e40af" strokeWidth=".6"/>
        <text x="65" y="26" textAnchor="middle" fontSize="3" fill="#6366f1" fontFamily="monospace">MCU</text>
        <circle cx="20" cy="55" r="4" fill="#0f172a" stroke="#334155" strokeWidth=".6"/>
        <circle cx="33" cy="55" r="4" fill="#0f172a" stroke="#334155" strokeWidth=".6"/>
        {defects.map((d,i)=>(
          <rect key={i} x={20+i*15} y={30+i*10} width={12} height={8} fill="rgba(220,38,38,.3)" stroke="#DC2626" strokeWidth="1.2" rx="1"/>
        ))}
      </svg>
      {label && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,.75)', padding:'3px 8px', fontSize:9, fontFamily:'var(--font-m)', color:'#fff', textAlign:'center' }}>
          {label}
        </div>
      )}
    </div>
  );
}

export default function GoldenBoard() {
  const { cameraState, company } = useAppStore();
  const [goldenFile, setGoldenFile] = useState(null);
  const [goldenUrl,  setGoldenUrl]  = useState('');
  const [diffResult, setDiffResult] = useState(null);
  const [comparing,  setComparing]  = useState(false);
  const [liveFile,   setLiveFile]   = useState(null);
  const [liveUrl,    setLiveUrl]    = useState('');
  const [liveMode,   setLiveMode]   = useState('camera'); // 'camera' | 'image' | 'video'
  const fileRef     = useRef(null);
  const liveFileRef = useRef(null);
  const liveVideoRef= useRef(null);
  const goldenCanvasRef = useRef(null);
  const diffCanvasRef   = useRef(null);
  const isEnterprise = company?.plan?.toLowerCase() === 'enterprise';

  useEffect(() => {
    if (!goldenFile) { setGoldenUrl(''); return; }
    const u = URL.createObjectURL(goldenFile);
    setGoldenUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [goldenFile]);

  useEffect(() => {
    if (!liveFile) { setLiveUrl(''); return; }
    const u = URL.createObjectURL(liveFile);
    setLiveUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [liveFile]);

  const runComparison = async () => {
    if (!goldenFile) { alert('Please upload a Golden Board reference image first.'); return; }
    if (liveMode !== 'camera' && !liveFile) { alert('Please upload a Live Board image/video first.'); return; }
    setComparing(true);
    setDiffResult(null);
    try {
      const fd = new FormData();
      fd.append('golden', goldenFile, 'golden.jpg');
      if (liveMode === 'image' && liveFile) {
        fd.append('live', liveFile, 'live.jpg');
      } else if (liveMode === 'video' && liveVideoRef.current) {
        // Capture current video frame
        const v = liveVideoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = v.videoWidth || 640;
        canvas.height = v.videoHeight || 480;
        canvas.getContext('2d').drawImage(v, 0, 0);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
        if (blob) fd.append('live', blob, 'live_frame.jpg');
      } else if (cameraState?.board_id) {
        fd.append('board_id', cameraState.board_id);
      }
      const API_BASE = 'http://localhost:8000';
      const _token = localStorage.getItem('pcbg_token');
      const res = await fetch(`${API_BASE}/inspect/golden-compare`, {
        method:'POST', body:fd,
        headers: _token ? { Authorization: `Bearer ${_token}` } : {},
      });
      if (res.ok) setDiffResult(await res.json());
      else setDiffResult({ error:true, message:`Server error: ${res.status}` });
    } catch (e) {
      setDiffResult({ error:true, message: e.message });
    }
    setComparing(false);
  };

  if (!isEnterprise) {
    return (
      <div style={{ padding:32, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🥇</div>
        <div style={{ fontFamily:'var(--font-d)', fontSize:18, fontWeight:700, marginBottom:8 }}>Golden Board Comparison</div>
        <div style={{ color:'var(--text-muted)', marginBottom:16 }}>Compare live boards against a reference "golden" PCB to catch structural defects.</div>
        <span style={{ background:'var(--purple-light)', color:'var(--purple)', border:'1px solid rgba(124,58,237,.2)', padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>Enterprise Feature</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:'var(--font-d)', fontSize:20, fontWeight:700, marginBottom:4 }}>🥇 Golden Board Comparison</div>
          <div style={{ color:'var(--text-muted)', fontSize:13 }}>Upload a reference "golden" PCB image — AI detects structural deviations in real-time</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>📁 Upload Golden Board</button>
          <button className="btn btn-primary" onClick={runComparison}
            disabled={comparing || !goldenUrl || (liveMode==='image' && !liveUrl) || (liveMode==='video' && !liveUrl)}>
            {comparing ? <><span className="spinner" style={{width:14,height:14}}/> Comparing…</> : '🔍 Compare Now'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>setGoldenFile(e.target.files[0])}/>
      </div>

      <div className="grid-2 mb-16">
        {/* Golden (reference) board */}
        <div className="card">
          <div className="card-header"><div className="card-title">📋 Reference Board (Golden)</div></div>
          <div style={{ padding:16 }}>
            {goldenUrl ? (
              <img src={goldenUrl} alt="Golden Board" style={{ width:'100%', borderRadius:10, border:'2px solid var(--green-border)' }}/>
            ) : (
              <div style={{ aspectRatio:'4/3', background:'var(--bg)', border:'2px dashed var(--border)', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer' }} onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize:40, opacity:.3 }}>🥇</div>
                <div style={{ fontSize:13, fontWeight:600 }}>Click to upload reference board</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>JPEG, PNG, BMP · 1:1 resolution preferred</div>
              </div>
            )}
          </div>
        </div>

        {/* Current / live board */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🔴 Live Board (Current)</div>
            <div style={{ display:'flex', gap:6 }}>
              {['camera','image','video'].map(m => (
                <button key={m} onClick={()=>{setLiveMode(m);setLiveFile(null);}} style={{
                  padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600,
                  border: liveMode===m?'none':'1px solid var(--border)',
                  background: liveMode===m?'var(--brand)':'#fff',
                  color: liveMode===m?'#fff':'var(--text-muted)',
                }}>
                  {m==='camera'?'📹 Camera':m==='image'?'🖼️ Image':'🎬 Video'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding:16 }}>
            {/* Camera mode */}
            {liveMode === 'camera' && (
              <div style={{ aspectRatio:'4/3', background:'#1a3320', border:`2px solid ${cameraState?.decision==='REJECT'?'var(--red)':'var(--border)'}`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
                {cameraState ? (
                  <>
                    <div style={{ color:'rgba(255,255,255,.3)', fontSize:12, fontFamily:'var(--font-m)' }}>{cameraState.board_id} · LIVE FEED</div>
                    {cameraState.defects_found?.map((d,i) => (
                      <div key={i} style={{ position:'absolute', left:`${d.bbox[0]}%`, top:`${d.bbox[1]}%`, width:`${d.bbox[2]-d.bbox[0]}%`, height:`${d.bbox[3]-d.bbox[1]}%`, border:`2px solid ${d.color}`, background:`${d.color}20`, borderRadius:3 }}/>
                    ))}
                  </>
                ) : (
                  <div style={{ textAlign:'center', color:'rgba(255,255,255,.3)' }}>
                    <div style={{ fontSize:30, marginBottom:8 }}>⊙</div>
                    <div style={{ fontSize:12 }}>Waiting for live board…</div>
                  </div>
                )}
              </div>
            )}
            {/* Image upload mode */}
            {liveMode === 'image' && (
              liveUrl ? (
                <img src={liveUrl} alt="Live Board" style={{ width:'100%', borderRadius:10, border:'2px solid var(--brand)' }}/>
              ) : (
                <div style={{ aspectRatio:'4/3', background:'var(--bg)', border:'2px dashed var(--border)', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer' }}
                  onClick={() => liveFileRef.current?.click()}>
                  <div style={{ fontSize:40, opacity:.3 }}>🖼️</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>Upload Live Board Image</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>JPEG, PNG, BMP</div>
                </div>
              )
            )}
            {/* Video upload mode */}
            {liveMode === 'video' && (
              liveUrl ? (
                <div style={{ position:'relative', borderRadius:10, overflow:'hidden', border:'2px solid var(--purple)' }}>
                  <video ref={liveVideoRef} src={liveUrl} controls style={{ width:'100%', display:'block' }}/>
                  <div style={{ marginTop:6, fontSize:11, color:'var(--text-muted)', textAlign:'center' }}>Pause video at desired frame, then click Compare</div>
                </div>
              ) : (
                <div style={{ aspectRatio:'4/3', background:'var(--bg)', border:'2px dashed var(--border)', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, cursor:'pointer' }}
                  onClick={() => liveFileRef.current?.click()}>
                  <div style={{ fontSize:40, opacity:.3 }}>🎬</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>Upload Live Board Video</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>MP4, AVI, MOV — pause at frame to compare</div>
                </div>
              )
            )}
            {/* Upload button for image/video */}
            {liveMode !== 'camera' && liveUrl && (
              <button className="btn btn-secondary" style={{ marginTop:8, width:'100%' }}
                onClick={() => liveFileRef.current?.click()}>
                📁 Change {liveMode === 'image' ? 'Image' : 'Video'}
              </button>
            )}
          </div>
        </div>
      </div>
      <input ref={liveFileRef} type="file" accept={liveMode==='video'?'video/*':'image/*'} style={{display:'none'}}
        onChange={e => setLiveFile(e.target.files?.[0] || null)}/>

      {/* Diff result */}
      {diffResult?.error && (
        <div style={{ padding:'16px', background:'#fff5f5', border:'1px solid #fecaca', borderRadius:12, marginTop:16 }}>
          <div style={{ fontWeight:700, color:'#dc2626', marginBottom:4 }}>⚠ Comparison Error</div>
          <div style={{ fontSize:13, color:'#7f1d1d' }}>{diffResult.message}</div>
          {diffResult.instruction && <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>{diffResult.instruction}</div>}
        </div>
      )}
      {diffResult && !diffResult.error && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📊 Comparison Result</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:'var(--font-m)', fontSize:20, fontWeight:800, color:diffResult.verdict==='PASS'?'var(--green)':'var(--red)' }}>{diffResult.verdict}</span>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{diffResult.analysis_ms}ms</span>
            </div>
          </div>
          <div className="card-body">
            <div className="stat-grid stat-grid-4 mb-16">
              {[
                ['Overall Score',  `${diffResult.similarity_pct}%`,   parseFloat(diffResult.similarity_pct)>=85?'var(--green)':'var(--red)'],
                ['SSIM',           `${diffResult.ssim_score||0}%`,    parseFloat(diffResult.ssim_score||0)>=85?'var(--green)':'var(--red)'],
                ['Edge Match',     `${diffResult.edge_similarity||0}%`, parseFloat(diffResult.edge_similarity||0)>=85?'var(--green)':'var(--amber)'],
                ['Pixel Match',    `${diffResult.pixel_similarity||0}%`, parseFloat(diffResult.pixel_similarity||0)>=85?'var(--green)':'var(--amber)'],
                ['Diff Regions',   diffResult.diff_regions,            diffResult.diff_regions===0?'var(--green)':'var(--amber)'],
                ['Verdict',        diffResult.verdict,                  diffResult.verdict==='PASS'?'var(--green)':'var(--red)'],
              ].map(([l,v,c]) => (
                <div key={l} className="stat-card">
                  <div className="stat-label">{l}</div>
                  <div style={{ fontFamily:'var(--font-d)', fontSize:22, fontWeight:700, color:c }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Diff Visualization Image */}
            {diffResult.diff_image && (
              <div style={{ marginBottom:16 }}>
                <div className="section-title mb-8">🔍 Difference Visualization</div>
                <div style={{ position:'relative', borderRadius:10, overflow:'hidden', border:'2px solid var(--border)' }}>
                  <img src={diffResult.diff_image} alt="Diff" style={{ width:'100%', display:'block' }}/>
                  <div style={{ position:'absolute', top:8, left:8, background:'rgba(0,0,0,.75)', borderRadius:6, padding:'4px 10px', fontSize:11, color:'#fff' }}>
                    🟥 Red = Different areas &nbsp;|│&nbsp; 🟦 Blue = Missing &nbsp;|│&nbsp; 🟧 Orange = Shifted
                  </div>
                </div>
              </div>
            )}

            {(diffResult.issues?.length || 0) > 0 ? (
              <div>
                <div className="section-title mb-8">Detected Issues</div>
                {diffResult.issues.map((issue,i) => (
                  <div key={i} style={{ padding:'12px 14px', borderRadius:10,
                    border:`1px solid ${DIFF_COLORS[issue.type]||'#888'}30`,
                    borderLeft:`4px solid ${DIFF_COLORS[issue.type]||'#888'}`,
                    marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:600, color:DIFF_COLORS[issue.type]||'#888', fontSize:13, textTransform:'uppercase', marginBottom:3 }}>
                        {issue.type==='missing'?'🔴 Missing Component':issue.type==='trace_break'?'🟠 Trace Break':'🟣 Component Shift'}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                        {issue.region} · {issue.pct}% area
                        {issue.center && ` · Center: (${issue.center[0]}%, ${issue.center[1]}%)`}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:'var(--font-m)', fontWeight:700, color:DIFF_COLORS[issue.type]||'#888' }}>
                        {(issue.confidence*100).toFixed(0)}%
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>confidence</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding:'16px', background:'var(--green-light)', border:'1px solid var(--green-border)', borderRadius:10, textAlign:'center', color:'var(--green)', fontWeight:600 }}>
                ✅ Board matches golden reference — no structural deviations detected
              </div>
            )}
          </div>
        </div>
        )}
    </div>
  );
}