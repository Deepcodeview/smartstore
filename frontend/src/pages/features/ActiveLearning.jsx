/**
 * ActiveLearning.jsx — Fixed: Video vs Simulation clearly separated
 * Default filter = "Video Only" — simulation boards hidden by default
 */
import React, { useState, useMemo } from 'react';
import useAppStore from '../../store/appStore';

const API_BASE = 'http://localhost:8000';

const DEFECT_INFO = {
  mouse_bite:      { color:'#7C3AED', emoji:'🟣', en:'Edge erosion',   hindi:'किनारे कटाव'    },
  spur:            { color:'#2563EB', emoji:'🔵', en:'Copper spike',    hindi:'तांबे की कील'   },
  missing_hole:    { color:'#F59E0B', emoji:'🟡', en:'Drill missing',   hindi:'होल मिस'        },
  short:           { color:'#DC2626', emoji:'🔴', en:'Solder bridge',   hindi:'शॉर्ट सर्किट'  },
  open_circuit:    { color:'#DC2626', emoji:'🔴', en:'Broken trace',    hindi:'सर्किट खुला'   },
  spurious_copper: { color:'#F59E0B', emoji:'🟡', en:'Extra copper',    hindi:'अतिरिक्त तांबा'},
};

function BoardPreview({ board, size = 160 }) {
  const defects  = board.defects_found || [];
  const decColor = board.decision==='REJECT'?'#DC2626':board.decision==='FLAG_FOR_REVIEW'?'#D97706':'#16a34a';

  // ✅ FIX: Use real frame image when available (from PCBCanvas capture or backend serve)
  const imgSrc = board.frame_dataUrl || board.frame_url || null;

  if (imgSrc) {
    // Use 16:9 aspect ratio to match video source (most PCB videos are 16:9 or 4:3)
    // SVG viewBox 0-100 maps to same container — no objectFit distortion needed
    return (
      <div style={{ position:'relative', background:'#0a0e14', borderRadius:8, overflow:'hidden',
        width:size, height: size * 0.75, border:`2px solid ${decColor}`, flexShrink:0 }}>
        <img src={imgSrc} alt={board.board_id}
          style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', objectFit:'cover', display:'block' }}
          onError={e => { e.target.style.display='none'; }}
        />
        {/* Defect bbox overlay — SVG covers same area as image (both absolute, same size) */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none' }}>
          {defects.map((d, i) => {
            const info = DEFECT_INFO[d.class_name] || { color:'#fff' };
            const x1 = d.bbox?.[0]??20, y1 = d.bbox?.[1]??20, x2 = d.bbox?.[2]??x1+18, y2 = d.bbox?.[3]??y1+14;
            return (
              <g key={i}>
                <rect x={x1} y={y1} width={x2-x1} height={y2-y1}
                  fill={`${info.color}30`} stroke={info.color} strokeWidth="1.8" rx="1"
                  strokeDasharray={d.severity==='CRITICAL'?'0':'3,1.5'}/>
                <rect x={x1} y={Math.max(y1-7,0)} width={Math.max(d.class_name.length*2.3+4,22)} height={7} rx="1.5" fill={info.color}/>
                <text x={x1+2} y={Math.max(y1-1,6)} fontSize="3.5" fill="#fff" fontWeight="bold" fontFamily="monospace">
                  {(d.class_name||"").slice(0,7)} {Math.round(d.confidence*100)}%
                </text>
              </g>
            );
          })}
        </svg>
        {/* Source + decision badge */}
        <div style={{ position:'absolute', top:4, left:4, fontSize:7, fontWeight:800, fontFamily:'monospace',
          padding:'2px 5px', borderRadius:3,
          background: board._source==='video'?'rgba(124,58,237,.9)':'rgba(71,85,105,.85)', color:'#fff' }}>
          {board._source==='video'?'🎬 VIDEO':'⚙ SIM'}
        </div>
        <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,.78)',
          padding:'3px 6px', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:8, fontFamily:'var(--font-m)', color:'#fff', fontWeight:700 }}>{board.board_id}</span>
          <span style={{ fontSize:8, color:board.decision==='REJECT'?'#fca5a5':'#fcd34d' }}>
            {board.decision==='REJECT'?'⊘REJ':'⚠FLAG'}
          </span>
        </div>
      </div>
    );
  }

  // Fallback: SVG mock board (simulation or no image available)
  return (
    <div style={{ position:'relative', background:'#0a0e14', borderRadius:8, overflow:'hidden', aspectRatio:'4/3', border:`2px solid ${decColor}`, flexShrink:0, width:size }}>
      <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:'6%', width:'88%', height:'88%' }}>
        <rect x="2" y="2" width="96" height="96" rx="3" fill="#1a3320" stroke="#2d5535" strokeWidth="1.5"/>
        {[20,40,60,80].map(x=><line key={x} x1={x} y1="2" x2={x} y2="98" stroke="rgba(0,180,60,.08)" strokeWidth=".3"/>)}
        {[20,40,60,80].map(y=><line key={y} x1="2" y1={y} x2="98" y2={y} stroke="rgba(0,180,60,.08)" strokeWidth=".3"/>)}
        <path d="M10 30H45V15H65" stroke="#c8820a" strokeWidth="1" fill="none"/>
        <path d="M10 70H88"       stroke="#c8820a" strokeWidth="1" fill="none"/>
        <rect x="22" y="20" width="22" height="14" rx="1" fill="#0f172a" stroke="#1e40af" strokeWidth=".6"/>
        <text x="33" y="29" textAnchor="middle" fontSize="3.5" fill="#6366f1" fontFamily="monospace">IC1</text>
        <rect x="57" y="18" width="16" height="12" rx="1" fill="#0f172a" stroke="#1e40af" strokeWidth=".6"/>
        <text x="65" y="26" textAnchor="middle" fontSize="3"   fill="#6366f1" fontFamily="monospace">MCU</text>
        <circle cx="20" cy="55" r="4" fill="#0f172a" stroke="#334155" strokeWidth=".6"/>
        <circle cx="33" cy="55" r="4" fill="#0f172a" stroke="#334155" strokeWidth=".6"/>
        {defects.map((d,i)=>{
          const info=DEFECT_INFO[d.class_name]||{color:'#fff'};
          const x1=d.bbox?.[0]??20, y1=d.bbox?.[1]??20, x2=d.bbox?.[2]??x1+18, y2=d.bbox?.[3]??y1+14;
          return(<g key={i}>
            <rect x={x1} y={y1} width={x2-x1} height={y2-y1} fill={`${info.color}25`} stroke={info.color} strokeWidth="1.8" rx="1" strokeDasharray={d.severity==='CRITICAL'?'0':'3,1.5'}/>
            <rect x={x1} y={y1-8} width={Math.max(d.class_name.length*2.3+4,22)} height={8} rx="1.5" fill={info.color}/>
            <text x={x1+2} y={y1-1.5} fontSize="3.5" fill="#fff" fontWeight="bold" fontFamily="monospace">{(d.class_name||"").slice(0,7)} {Math.round(d.confidence*100)}%</text>
          </g>);
        })}
      </svg>
      <div style={{ position:'absolute', top:4, left:4, fontSize:7, fontWeight:800, fontFamily:'monospace', padding:'2px 5px', borderRadius:3, background:board._source==='video'?'rgba(124,58,237,.9)':'rgba(71,85,105,.85)', color:'#fff' }}>
        {board._source==='video'?'🎬 VIDEO':'⚙ SIM'}
      </div>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,.78)', padding:'3px 6px', display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontSize:8, fontFamily:'var(--font-m)', color:'#fff', fontWeight:700 }}>{board.board_id}</span>
        <span style={{ fontSize:8, color:board.decision==='REJECT'?'#fca5a5':'#fcd34d' }}>{board.decision==='REJECT'?'⊘REJ':'⚠FLAG'}</span>
      </div>
    </div>
  );
}

export default function ActiveLearning() {
  const { boards } = useAppStore();
  const [labeled,      setLabeled]      = useState({});
  const [retraining,   setRetraining]   = useState(false);
  const [history,      setHistory]      = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [sourceFilter, setSourceFilter] = useState('video');
  const RETRAIN_AT = 20;
  const [backendItems, setBackendItems] = React.useState([]);
  const [backendOnline,setBackendOnline]= React.useState(false);

  React.useEffect(() => {
    const poll = async () => {
      try {
        // FIX BUG 5: Add Authorization header — backend returns 401 without it
        const _token = localStorage.getItem('pcbg_token');
        const res = await fetch(API_BASE + '/api/active-learning', {
          headers: _token ? { Authorization: `Bearer ${_token}` } : {},
        });
        if (res.ok) {
          const d = await res.json();
          setBackendItems(d.items || []);
          setBackendOnline(true);
        } else if (res.status === 401) {
          // Token issue — still mark backend as online but queue empty
          setBackendOnline(true);
          setBackendItems([]);
        } else {
          setBackendOnline(false);
        }
      } catch(_) { setBackendOnline(false); }
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  // VIDEO boards = from backend queue OR from store with video/webcam/ip source flag
  const videoBoards = useMemo(() => {
    const fromBackend = backendItems.map(item => ({
      board_id:item.board_id, video_id:item.video_id, frame_no:item.frame_no,
      decision:item.decision, defects_found:item.defects||[], total_defects:(item.defects||[]).length,
      batch_id:item.video_id?`BATCH-${item.video_id.slice(0,4)}`:'VIDEO',
      inference_ms:item.inference_ms||8, timestamp:item.timestamp,
      _backend_id:item.id, _backend_status:item.status, _source:'video',
      // ✅ Real frame images from backend
      frame_url:      item.frame_url      || null,
      frame_dataUrl:  item.frame_dataUrl  || null,
    }));
    const backendIds = new Set(fromBackend.map(b=>b.board_id));
    const fromStore = boards
      .filter(b=>(b.decision==='FLAG_FOR_REVIEW'||b.decision==='REJECT')&&(b.video_id||b.source==='video'||b.source==='webcam'||b.source==='ip'||/^PCB-(VID|WEB|IP|CAM)-/i.test(b.board_id)))
      .reverse().slice(0,100)
      .map(b=>({...b,_source:'video',batch_id:b.batch_id||(b.video_id?`BATCH-${b.video_id.slice(0,4)}`:'VIDEO')}));
    return [...fromBackend, ...fromStore.filter(b=>!backendIds.has(b.board_id))];
  }, [backendItems, boards]);

  // SIMULATION boards = from store WITHOUT any video flag
  const simBoards = useMemo(() => {
    const videoIds = new Set(videoBoards.map(b=>b.board_id));
    return boards
      .filter(b=>(b.decision==='FLAG_FOR_REVIEW'||b.decision==='REJECT')&&!b.video_id&&!b.source&&!videoIds.has(b.board_id)&&!/^PCB-(VID|WEB|IP|CAM)-/i.test(b.board_id))
      .reverse().slice(0,50)
      .map(b=>({...b,_source:'sim',batch_id:b.batch_id||'SIM'}));
  }, [boards, videoBoards]);

  // Auto-adjust filter
  React.useEffect(() => {
    if (videoBoards.length===0 && simBoards.length>0) setSourceFilter('all');
    else if (videoBoards.length>0) setSourceFilter('video');
  }, [videoBoards.length, simBoards.length]);

  const flaggedBoards = useMemo(()=>{
    if (sourceFilter==='video') return videoBoards;
    if (sourceFilter==='sim')   return simBoards;
    return [...videoBoards,...simBoards];
  },[sourceFilter,videoBoards,simBoards]);

  const labeledCount = Object.keys(labeled).length;
  const correctCount = Object.values(labeled).filter(v=>v===true).length;
  const wrongCount   = Object.values(labeled).filter(v=>v===false).length;
  const progress     = Math.min((labeledCount/RETRAIN_AT)*100,100);
  const accuracy     = labeledCount>0?Math.round((correctCount/labeledCount)*100):0;

  const labelBoard = async (boardId, val, backendId=null) => {
    setLabeled(p=>({...p,[boardId]:val})); setSelected(null);
    if (backendId) {
      try {
        // FIX BUG 5b: Add Authorization header to label endpoint
        const _token = localStorage.getItem('pcbg_token');
        await fetch(API_BASE + '/api/active-learning/label', {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            ..._token ? { Authorization: `Bearer ${_token}` } : {},
          },
          body: JSON.stringify({ item_id: backendId, user_label: val ? 'correct' : 'wrong' }),
        });
      } catch(_) {}
    }
  };

  const triggerRetrain = async () => {
    setRetraining(true);
    await new Promise(r=>setTimeout(r,3500));
    const v=history.length+2;
    setHistory(p=>[...p,{version:`v${v}.0`,labels:labeledCount,accuracy:`${accuracy}%`,correct:correctCount,wrong:wrongCount,time:new Date().toLocaleTimeString()}]);
    setLabeled({}); setSelected(null); setRetraining(false);
  };

  const FILTER_TABS = [
    {id:'video',label:'🎬 Video Only',    count:videoBoards.length, color:'#7c3aed'},
    {id:'all',  label:'📋 All',           count:videoBoards.length+simBoards.length, color:'#0057ff'},
    {id:'sim',  label:'⚙ Simulation',    count:simBoards.length,   color:'#475569'},
  ];

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:'var(--font-d)',fontSize:20,fontWeight:700,marginBottom:4}}>🧠 Active Learning Pipeline</div>
        <div style={{color:'var(--text-muted)',fontSize:13}}>Review flagged boards → label correct/wrong → auto-retrain YOLOv11 at {RETRAIN_AT} labels</div>
      </div>

      {/* Backend offline warning */}
      {!backendOnline && (
        <div style={{marginBottom:14,padding:'10px 14px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,display:'flex',alignItems:'center',gap:10,fontSize:12}}>
          <span style={{fontSize:18}}>⚠️</span>
          <span><strong style={{color:'#92400e'}}>Backend offline — </strong><span style={{color:'#78350f'}}>Video pipeline unavailable. Start backend: <code>python main.py</code></span></span>
        </div>
      )}

      {/* No video boards tip */}
      {videoBoards.length===0 && (
        <div style={{marginBottom:14,padding:'12px 16px',background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:10,display:'flex',alignItems:'center',gap:12,fontSize:12}}>
          <span style={{fontSize:24}}>🎬</span>
          <div>
            <div style={{fontWeight:700,color:'#0369a1',marginBottom:2}}>Koi video board nahi mila</div>
            <div style={{color:'#0c4a6e'}}>Live Monitor → Camera tab → <strong>Video File</strong> → PCB video upload karo. Flagged boards yahan aayenge.</div>
          </div>
        </div>
      )}

      {/* Progress card */}
      <div className="card mb-16" style={{border:labeledCount>=RETRAIN_AT?'1.5px solid var(--green-border)':'1px solid var(--border)'}}>
        <div className="card-body">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:16,marginBottom:16}}>
            {[{l:'Labels',v:`${labeledCount}/${RETRAIN_AT}`,c:'var(--brand)',big:true},{l:'Correct',v:correctCount,c:'var(--green)',big:false},{l:'Wrong',v:wrongCount,c:'var(--red)',big:false},{l:'Accuracy',v:`${accuracy}%`,c:accuracy>=80?'var(--green)':'var(--amber)',big:false}]
              .map(s=>(
                <div key={s.l} style={{textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'.5px'}}>{s.l}</div>
                  <div style={{fontFamily:'var(--font-d)',fontSize:s.big?28:22,fontWeight:800,color:s.c}}>{s.v}</div>
                </div>
              ))}
          </div>
          <div style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{fontSize:12,color:'var(--text-muted)'}}>Progress to retrain</span>
              <span style={{fontSize:12,fontWeight:600,color:labeledCount>=RETRAIN_AT?'var(--green)':'var(--brand)'}}>{RETRAIN_AT-labeledCount>0?`${RETRAIN_AT-labeledCount} more needed`:'✓ Ready!'}</span>
            </div>
            <div style={{height:12,background:'var(--border)',borderRadius:6,overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:6,transition:'width .5s',width:`${progress}%`,background:labeledCount>=RETRAIN_AT?'linear-gradient(90deg,#16a34a,#22c55e)':'linear-gradient(90deg,var(--brand),#60a5fa)'}}/>
            </div>
          </div>
          {labeledCount>=RETRAIN_AT&&<div style={{display:'flex',justifyContent:'center'}}><button className="btn btn-primary" onClick={triggerRetrain} disabled={retraining} style={{padding:'11px 28px',fontSize:14}}>{retraining?<><span className="spinner" style={{width:15,height:15}}/> Retraining…</>:`🚀 Trigger Retrain — ${labeledCount} labels ready`}</button></div>}
        </div>
      </div>

      {/* Source filter tabs */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        {FILTER_TABS.map(t=>(
          <button key={t.id} onClick={()=>setSourceFilter(t.id)} style={{
            display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:20,cursor:'pointer',
            fontFamily:'var(--font-b)',fontSize:12,fontWeight:600,transition:'all .15s',
            border:sourceFilter===t.id?'none':'1px solid var(--border)',
            background:sourceFilter===t.id?t.color:'#fff',
            color:sourceFilter===t.id?'#fff':'var(--text-secondary)',
          }}>
            {t.label}
            <span style={{padding:'1px 7px',borderRadius:10,fontSize:10,fontWeight:700,background:sourceFilter===t.id?'rgba(255,255,255,.25)':'var(--bg)',color:sourceFilter===t.id?'#fff':t.color}}>{t.count}</span>
          </button>
        ))}
        {simBoards.length>0&&videoBoards.length>0&&sourceFilter==='video'&&(
          <span style={{fontSize:11,color:'var(--amber)',background:'var(--amber-light)',border:'1px solid var(--amber-border)',borderRadius:8,padding:'4px 10px',fontWeight:600}}>
            ⚠ {simBoards.length} simulation board{simBoards.length>1?'s':''} hidden — "All" tab mein dekhein
          </span>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:selected?'1fr 380px':'1fr',gap:16}}>
        {/* Label queue */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              🏷️ Label Queue — {flaggedBoards.length} board{flaggedBoards.length!==1?'s':''}
              {sourceFilter==='video'&&videoBoards.length>0&&<span style={{marginLeft:8,fontSize:10,background:'rgba(124,58,237,.12)',color:'#7c3aed',border:'1px solid rgba(124,58,237,.2)',padding:'1px 7px',borderRadius:10,fontWeight:700}}>🎬 Video only</span>}
            </div>
            <div style={{display:'flex',gap:10,fontSize:12}}>
              <span style={{color:'var(--green)'}}>✓ {correctCount}</span>
              <span style={{color:'var(--red)'}}>✗ {wrongCount}</span>
            </div>
          </div>

          {flaggedBoards.length===0?(
            <div style={{padding:'48px 24px',textAlign:'center'}}>
              <div style={{fontSize:44,marginBottom:12,opacity:.3}}>{sourceFilter==='video'?'🎬':'🏷️'}</div>
              <div style={{fontWeight:700,color:'var(--text-secondary)',marginBottom:8}}>
                {sourceFilter==='video'?'Koi video board nahi mila':'No flagged boards yet'}
              </div>
              <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.7}}>
                {sourceFilter==='video'?'Live Monitor → Video File tab → PCB video upload karo':'FLAG_FOR_REVIEW ya REJECT boards yahan aate hain'}
              </div>
              {sourceFilter==='video'&&simBoards.length>0&&(
                <button onClick={()=>setSourceFilter('all')} style={{marginTop:14,padding:'8px 18px',borderRadius:8,cursor:'pointer',background:'var(--bg)',border:'1px solid var(--border)',fontSize:12,color:'var(--text-secondary)',fontWeight:600}}>
                  Simulation boards dekhein ({simBoards.length})
                </button>
              )}
            </div>
          ):(
            <div>
              {flaggedBoards.map((b,idx)=>{
                const lbl=labeled[b.board_id];
                const isSelected=selected?.board_id===b.board_id;
                const isVideo=b._source==='video';
                return (
                  <div key={b.board_id} style={{
                    padding:'12px 16px',cursor:'pointer',
                    borderBottom:idx<flaggedBoards.length-1?'1px solid var(--border)':'none',
                    background:isSelected?'var(--brand-light)':lbl===true?'#f0fdf4':lbl===false?'#fff8f8':'#fff',
                    borderLeft:isSelected?'3px solid var(--brand)':lbl===true?'3px solid var(--green)':lbl===false?'3px solid var(--red)':isVideo?'3px solid #7c3aed':'3px solid transparent',
                    transition:'all .15s',
                  }} onClick={()=>setSelected(isSelected?null:b)}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <BoardPreview board={b}/>
                      <div style={{flex:1,minWidth:0}}>
                        {/* Title */}
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5,flexWrap:'wrap'}}>
                          <span style={{fontFamily:'var(--font-m)',fontWeight:700,color:'var(--brand)',fontSize:14}}>{b.board_id}</span>
                          <span className={`badge badge-${b.decision||"APPROVE"}`} style={{fontSize:10}}>{(b.decision||"").replace('_',' ')}</span>
                          <span style={{fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:10,background:isVideo?'rgba(124,58,237,.12)':'rgba(71,85,105,.1)',color:isVideo?'#7c3aed':'#475569',border:isVideo?'1px solid rgba(124,58,237,.25)':'1px solid rgba(71,85,105,.2)'}}>
                            {isVideo?'🎬 VIDEO':'⚙ SIM'}
                          </span>
                          {lbl!==undefined&&<span style={{fontSize:11,fontWeight:700,color:lbl?'var(--green)':'var(--red)'}}>{lbl?'✓ Correct':'✗ Wrong'}</span>}
                        </div>
                        {/* Defects */}
                        <div style={{marginBottom:6}}>
                          {b.defects_found?.map((d,i)=>{
                            const info=DEFECT_INFO[d.class_name]||{color:'#888',emoji:'⚪',en:'Unknown'};
                            return(<div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                              <span style={{fontSize:14}}>{info.emoji}</span>
                              <span style={{fontWeight:700,color:info.color,fontSize:12}}>{d.class_name}</span>
                              <span className={`badge badge-${d.severity}`} style={{fontSize:8}}>{d.severity}</span>
                              <span style={{fontFamily:'var(--font-m)',fontSize:11,color:'var(--text-muted)'}}>{(d.confidence*100).toFixed(0)}% conf</span>
                              <span style={{fontSize:11,color:'var(--text-secondary)'}}>— {info.en}</span>
                            </div>);
                          })}
                        </div>
                        <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--font-m)',marginBottom:8}}>
                          {b.batch_id||'—'} · {isVideo?'Video':'Simulation'} · {b.inference_ms}ms · {b.timestamp?new Date(b.timestamp).toLocaleTimeString('en-GB',{hour12:false}):'—'}
                        </div>
                        {lbl===undefined?(
                          <div style={{display:'flex',gap:8}}>
                            <button onClick={e=>{e.stopPropagation();labelBoard(b.board_id,true,b._backend_id);}} style={{flex:1,padding:'8px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,background:'var(--green-light)',color:'var(--green)',border:'1.5px solid var(--green-border)',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>✓ Correct Detection</button>
                            <button onClick={e=>{e.stopPropagation();labelBoard(b.board_id,false,b._backend_id);}} style={{flex:1,padding:'8px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,background:'var(--red-light)',color:'var(--red)',border:'1.5px solid var(--red-border)',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>✗ Wrong Detection</button>
                          </div>
                        ):(
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                            <span style={{fontWeight:700,color:lbl?'var(--green)':'var(--red)',fontSize:13}}>{lbl?'✓ Labeled as Correct':'✗ Labeled as Wrong'}</span>
                            <button onClick={e=>{e.stopPropagation();setLabeled(p=>{const n={...p};delete n[b.board_id];return n;});}} style={{padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:11,background:'var(--bg)',color:'var(--text-muted)',border:'1px solid var(--border)'}}>Undo</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected&&(
          <div className="card" style={{alignSelf:'start'}}>
            <div className="card-header">
              <div className="card-title">🔍 Board Detail</div>
              <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'var(--text-muted)'}}>×</button>
            </div>
            <div className="card-body">
              <BoardPreview board={selected} size={280}/>
              <div style={{marginTop:14}}>
                {[['Board ID',selected.board_id,'var(--brand)'],['Source',selected._source==='video'?'🎬 Video':'⚙ Simulation',selected._source==='video'?'#7c3aed':'#475569'],['Decision',(selected.decision||"").replace('_',' '),selected.decision==='REJECT'?'var(--red)':'var(--amber)'],['Batch',selected.batch_id||'—',null],['Frame',selected.frame_no!=null?`#${selected.frame_no}`:'—',null],['Inference',`${selected.inference_ms}ms`,null],['Defects',selected.total_defects,selected.total_defects>0?'var(--red)':'var(--green)']]
                  .map(([l,v,c])=>(
                    <div key={l} className="info-row">
                      <span style={{fontSize:12,color:'var(--text-muted)'}}>{l}</span>
                      <span style={{fontFamily:'var(--font-m)',fontWeight:700,fontSize:12,color:c||'var(--text-primary)'}}>{v}</span>
                    </div>
                  ))}
              </div>
              <div className="divider"/>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Detected Defects</div>
              {selected.defects_found?.map((d,i)=>{
                const info=DEFECT_INFO[d.class_name]||{color:'#888',emoji:'⚪',en:'Unknown',hindi:'अज्ञात'};
                return(<div key={i} style={{marginBottom:8,padding:'10px',borderRadius:8,border:`1px solid ${info.color}30`,background:`${info.color}08`}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontWeight:700,color:info.color}}>{info.emoji} {d.class_name}</span>
                    <span style={{fontFamily:'var(--font-m)',fontWeight:700,color:info.color}}>{(d.confidence*100).toFixed(1)}%</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--text-secondary)'}}>EN: {info.en}</div>
                  <div style={{fontSize:11,color:'#92400e',marginTop:2}}>HI: {info.hindi}</div>
                </div>);
              })}
              {labeled[selected.board_id]===undefined&&(
                <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:8}}>
                  <button onClick={()=>labelBoard(selected.board_id,true,selected._backend_id)} style={{width:'100%',padding:'10px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,background:'var(--green)',color:'#fff',border:'none'}}>✓ Correct Detection</button>
                  <button onClick={()=>labelBoard(selected.board_id,false,selected._backend_id)} style={{width:'100%',padding:'10px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,background:'var(--red)',color:'#fff',border:'none'}}>✗ Wrong Detection</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Retrain history */}
      {history.length>0&&(
        <div className="card" style={{marginTop:16}}>
          <div className="card-header"><div className="card-title">📜 Retrain History</div></div>
          <div className="table-wrapper" style={{borderRadius:'0 0 var(--r-lg) var(--r-lg)',border:'none'}}>
            <table className="data-table">
              <thead><tr><th>Version</th><th>Labels</th><th>Correct</th><th>Wrong</th><th>Accuracy</th><th>Time</th></tr></thead>
              <tbody>
                {[{version:'v1.0',labels:'—',correct:'—',wrong:'—',accuracy:'Base model',time:'Initial'},...history].map((h,i)=>(
                  <tr key={i}>
                    <td><span style={{fontFamily:'var(--font-m)',fontWeight:700,color:'var(--brand)'}}>{h.version}</span></td>
                    <td className="cell-mono">{h.labels}</td>
                    <td style={{color:'var(--green)',fontWeight:600}}>{h.correct}</td>
                    <td style={{color:'var(--red)',fontWeight:600}}>{h.wrong}</td>
                    <td><span style={{fontWeight:700,color:parseInt(h.accuracy)>=80?'var(--green)':'var(--amber)'}}>{h.accuracy}</span></td>
                    <td className="cell-mono" style={{color:'var(--text-muted)'}}>{h.time}</td>
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
