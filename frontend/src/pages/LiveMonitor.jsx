/* pages/LiveMonitor.jsx — Exact PCB Guardian interface connected to Retail AI backend */
import React, { useState, useEffect, useRef } from 'react';
import useAppStore from '../store/appStore';
import { useShallow } from 'zustand/react/shallow';
import PCBCanvas from '../components/PCBCanvas';
import SystemConsole from '../components/SystemConsole';

const API_BASE = 'http://localhost:8000';

/* ── Simulation engine (seeded random — no model needed) ── */
const CLASSES = ['person', 'space_na', 'space_a'];
const SEV_MAP  = { space_a:'CRITICAL', person:'INFO', space_na:'INFO' };
let _simSeed = 42;
function seededRand() { _simSeed = (_simSeed * 1664525 + 1013904223) & 0xffffffff; return Math.abs(_simSeed) / 0x7fffffff; }
function genSimResult() {
  const frameId = `FRM-${String(Math.floor(seededRand()*9999)).padStart(4,'0')}`;
  const nDetections = Math.floor(2 + seededRand() * 6);
  const detections = [];
  let personCount = 0;
  for (let i = 0; i < nDetections; i++) {
    const cls  = CLASSES[Math.floor(seededRand() * CLASSES.length)];
    if (cls === 'person') personCount++;
    const conf = 0.55 + seededRand() * 0.40;
    const x1   = 10 + seededRand() * 60, y1 = 10 + seededRand() * 60;
    detections.push({ class_name:cls, confidence:conf, severity:SEV_MAP[cls]||'INFO',
      bbox:[x1, y1, x1 + 12 + seededRand()*18, y1 + 12 + seededRand()*18] });
  }
  const hasCrit = detections.some(d => d.severity === 'CRITICAL');
  const decision = hasCrit ? 'REJECT' : 'APPROVE';
  return {
    board_id: frameId, decision, total_defects: detections.length, defects_found: detections,
    inference_ms: Math.floor(8 + seededRand()*15), fps: 30,
    zone: 'Zone A · Section 1', line_halt_required: false,
    person_count: personCount, density: personCount >= 4 ? 'High' : personCount >= 2 ? 'Medium' : 'Low',
    timestamp: new Date().toISOString(), model_mode: 'simulation',
  };
}

/* ── Root Cause Agent 3 panel ── */
function RootCausePanel({ apiKey, inspection }) {
  const [query,    setQuery]    = useState('');
  const [response, setResponse] = useState('');
  const [loading,  setLoading]  = useState(false);

  const analyze = async () => {
    if (!apiKey) { setResponse('⚠ Set your Claude API key in Settings → Platform Config → API Keys.'); return; }
    if (!inspection) { setResponse('⚠ No inspection data yet. Start camera or simulation first.'); return; }
    setLoading(true);
    const prompt = query.trim() ||
      `Analyze this retail store inspection result and provide root cause analysis:\n${JSON.stringify(inspection, null, 2)}`;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307', max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      setResponse(data.content?.[0]?.text || JSON.stringify(data));
    } catch (e) {
      setResponse(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <div className="card-title">🔍 Agent 3 — Root Cause Analyzer</div>
            <div className="card-subtitle">Claude AI · Deep inspection analysis · Hindi + English</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', background:'var(--brand-light)', borderRadius:8, fontSize:11, color:'var(--brand)', fontWeight:600 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--brand)', display:'inline-block' }}/>
            Agent 3 Ready
          </div>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Ask Agent 3</label>
            <textarea className="form-input" rows={3} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="e.g. Why is crowd density high at checkout? What zones need attention?"
              style={{ fontFamily:'var(--font-m)', fontSize:12, resize:'vertical' }}/>
          </div>
          <button className="btn btn-primary" onClick={analyze} disabled={loading}
            style={{ display:'flex', alignItems:'center', gap:8 }}>
            {loading ? <><span className="spinner" style={{width:14,height:14}}/>Analyzing…</> : '🔍 Analyze'}
          </button>
        </div>
      </div>

      {response && (
        <div className="card">
          <div className="card-header"><div className="card-title">📋 Agent 3 Analysis</div></div>
          <div className="card-body">
            <div style={{ fontFamily:'var(--font-m)', fontSize:12, color:'var(--text-secondary)', lineHeight:1.8,
              whiteSpace:'pre-wrap', padding:'12px 16px', background:'var(--bg)', borderRadius:'var(--r)',
              border:'1px solid var(--border)', maxHeight:400, overflowY:'auto' }}>
              {response}
            </div>
          </div>
        </div>
      )}

      {!response && inspection && (
        <div className="card">
          <div className="card-header"><div className="card-title">📊 Last Inspection Summary</div></div>
          <div className="card-body">
            {[
              { label:'Frame ID',      value: inspection.board_id },
              { label:'Decision',      value: inspection.decision },
              { label:'Person Count',  value: inspection.person_count ?? inspection.total_defects },
              { label:'Density',       value: inspection.density || '—' },
              { label:'Inference',     value: `${inspection.inference_ms}ms` },
              { label:'Model',         value: inspection.model_mode || 'retail-yolov8n' },
              { label:'Timestamp',     value: inspection.timestamp ? new Date(inspection.timestamp).toLocaleTimeString('en-IN') : '—' },
            ].map(r => (
              <div key={r.label} className="info-row">
                <span className="info-label">{r.label}</span>
                <span className="info-value mono">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── AI Console pipeline stages ── */
const PIPELINE_STAGES = [
  { id:'capture',  label:'Frame Capture',    icon:'📷', desc:'Camera → JPEG frame' },
  { id:'preproc',  label:'Pre-processing',   icon:'⚙',  desc:'Resize · Normalize' },
  { id:'infer',    label:'YOLO Inference',   icon:'🧠', desc:'YOLOv8n · Person detection' },
  { id:'track',    label:'Zone Mapping',     icon:'🗺️', desc:'Bbox → Store zone' },
  { id:'decision', label:'Crowd Decision',   icon:'⚖',  desc:'Density → Alert level' },
  { id:'alert',    label:'Alert Dispatch',   icon:'🔔', desc:'WebSocket · Dashboard' },
];

function AIPipelinePanel({ inspection, simRunning }) {
  const alerts = useAppStore(s => s.alerts);
  const unread   = alerts.filter(a => !a.read).length;
  const critical = alerts.filter(a => a.severity === 'CRITICAL').length;
  const total    = alerts.length;
  const active = inspection ? 'alert' : simRunning ? 'infer' : 'capture';
  const activeIdx = PIPELINE_STAGES.findIndex(s => s.id === active);

  return (
    <div>
      {/* Pipeline stages */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">⬡ AI Detection Pipeline</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>Retail YOLOv8n · Person Detection</div>
        </div>
        <div className="card-body">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {PIPELINE_STAGES.map((stage, i) => {
              const isDone    = i < activeIdx;
              const isCurrent = i === activeIdx;
              return (
                <div key={stage.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                  borderRadius:'var(--r)', border:`1px solid ${isCurrent ? 'var(--brand)' : isDone ? 'var(--green-border)' : 'var(--border)'}`,
                  background: isCurrent ? 'var(--brand-light)' : isDone ? 'var(--green-light)' : 'var(--bg)',
                  transition:'all .2s' }}>
                  <span style={{ fontSize:20, minWidth:28 }}>{stage.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color: isCurrent ? 'var(--brand)' : isDone ? 'var(--green)' : 'var(--text-primary)' }}>
                      {stage.label}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{stage.desc}</div>
                  </div>
                  <div style={{ fontSize:18 }}>
                    {isCurrent ? <span style={{ animation:'livePulse 1s infinite', display:'inline-block' }}>⚡</span>
                      : isDone ? '✅' : '○'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid stat-grid-4">
        {[
          { label:'Total Alerts',  value: total,    color:'var(--brand)' },
          { label:'Critical',      value: critical, color:'var(--red)'   },
          { label:'Unread',        value: unread,   color:'var(--amber)' },
          { label:'Pass Rate',     value: `100%`,   color:'var(--green)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ borderTop:`3px solid ${s.color}` }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Console */}
      <div style={{ marginTop:16 }}>
        <SystemConsole maxHeight={280} showFilter={true}/>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN LiveMonitor — exact PCB Guardian 3-tab layout
══════════════════════════════════════════════════ */
export default function LiveMonitor() {
  const { user, company, simRunning, startSim, stopSim, apiKey, addConsoleEntry, setSystemStatus } = useAppStore(useShallow(s => ({
    user:            s.user,
    company:         s.company,
    simRunning:      s.simRunning,
    startSim:        s.startSim,
    stopSim:         s.stopSim,
    apiKey:          s.apiKey,
    addConsoleEntry: s.addConsoleEntry,
    setSystemStatus: s.setSystemStatus,
  })));

  const [tab,        setTab]        = useState('camera');
  const [inspection, setInspection] = useState(null);
  const [scanning,   setScanning]   = useState(false);
  const [showZoneCfg, setShowZoneCfg] = useState(false);
  const [zones, setZones] = useState([
    { id:1, name:'Entrance',   type:'entry',  color:'#22c55e' },
    { id:2, name:'Section A',  type:'zone',   color:'#6366f1' },
    { id:3, name:'Section B',  type:'zone',   color:'#a855f7' },
    { id:4, name:'Section C',  type:'zone',   color:'#f59e0b' },
    { id:5, name:'Checkout',   type:'exit',   color:'#ef4444' },
  ]);
  const [newZoneName, setNewZoneName] = useState('');
  const simTimerRef = useRef(null);
  const zoneIdRef   = useRef(6);

  /* Simulation loop */
  useEffect(() => {
    if (!simRunning) {
      clearInterval(simTimerRef.current);
      setScanning(false);
      return;
    }
    setScanning(true);
    setSystemStatus('RUNNING');
    simTimerRef.current = setInterval(() => {
      const result = genSimResult();
      setInspection(result);
      const ts = new Date().toLocaleTimeString('en-GB', { hour12:false });
      const tc = result.decision === 'REJECT' ? 'ALERT' : 'NORMAL';
      addConsoleEntry({ time:ts, tag:tc, tagClass:tc === 'ALERT' ? 'REJECT' : 'APPROVE',
        msg: `[${tc}] ${result.board_id} | People: ${result.person_count} | Detections: ${result.total_defects} | ${result.inference_ms}ms | simulation`,
      });
    }, 2000);
    return () => clearInterval(simTimerRef.current);
  }, [simRunning]);

  const TABS = [
    { id:'camera',  label:'📷 Camera'     },
    { id:'console', label:'🖥 AI Console'  },
    { id:'root',    label:'🔍 Root Cause'  },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'var(--font-b)', fontSize:22, fontWeight:800, color:'var(--text-primary)', marginBottom:4 }}>
          Live Monitor
        </div>
        <div style={{ fontSize:13, color:'var(--text-muted)' }}>
          {company?.name || 'SmartRetail Solutions'} · {user?.role || 'store_associate'}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'9px 20px', borderRadius:'var(--r)', cursor:'pointer',
            fontSize:14, fontWeight:600, fontFamily:'var(--font-b)',
            border: tab === t.id ? 'none' : '1px solid var(--border)',
            background: tab === t.id ? 'var(--brand)' : '#fff',
            color: tab === t.id ? '#fff' : 'var(--text-secondary)',
            transition:'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Camera Tab ── */}
      {tab === 'camera' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Live AOI Camera — CAM-01</div>
              <div className="card-subtitle">YOLOv8n · Person &amp; Zone Detection · Retail AI</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px',
              background: scanning ? 'var(--green-light)' : 'var(--bg)',
              border:`1px solid ${scanning ? 'var(--green-border)' : 'var(--border)'}`,
              borderRadius:20, fontSize:12, fontWeight:700,
              color: scanning ? 'var(--green)' : 'var(--text-muted)' }}>
              <span style={{ width:8, height:8, borderRadius:'50%',
                background: scanning ? 'var(--green)' : 'var(--text-muted)',
                animation: scanning ? 'livePulse 1.5s infinite' : 'none',
                display:'inline-block' }}/>
              {scanning ? 'SCANNING' : 'IDLE'}
            </div>
          </div>
          <div className="card-body">
            {/* Zone Config Toggle */}
            <div style={{ marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={() => setShowZoneCfg(v => !v)} style={{
                display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8,
                cursor:'pointer', fontSize:12, fontWeight:600, border:'1px solid var(--border)',
                background: showZoneCfg ? 'var(--brand)' : 'var(--bg)',
                color: showZoneCfg ? '#fff' : 'var(--text-secondary)', transition:'all .15s',
              }}>🗺️ Configure Zones {showZoneCfg ? '▲' : '▼'}</button>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {zones.map(z => (
                  <span key={z.id} style={{
                    display:'inline-flex', alignItems:'center', gap:4,
                    padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                    background:`${z.color}18`, border:`1px solid ${z.color}55`, color:z.color,
                  }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:z.color, display:'inline-block' }}/>
                    {z.name}
                    {z.type!=='zone' && <span style={{ fontSize:9, opacity:.7 }}>({z.type})</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* Zone Config Panel */}
            {showZoneCfg && (
              <div style={{ marginBottom:14, border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                {/* Header */}
                <div style={{ padding:'12px 16px', background:'var(--bg)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>📍 Store Zones Configuration</div>
                  <button onClick={() => setZones([{id:1,name:'Entrance',type:'entry',color:'#22c55e'},{id:2,name:'Section A',type:'zone',color:'#6366f1'},{id:3,name:'Section B',type:'zone',color:'#a855f7'},{id:4,name:'Section C',type:'zone',color:'#f59e0b'},{id:5,name:'Checkout',type:'exit',color:'#ef4444'}])}
                    style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text-muted)', fontSize:11, cursor:'pointer' }}>↺ Reset</button>
                </div>

                {/* Zone rows */}
                <div style={{ background:'var(--white)' }}>
                  {zones.map((z, idx) => (
                    <div key={z.id} style={{
                      display:'grid', gridTemplateColumns:'auto 1fr auto auto auto',
                      alignItems:'center', gap:10, padding:'10px 16px',
                      borderBottom: idx < zones.length-1 ? '1px solid var(--border)' : 'none',
                      background:'var(--white)',
                    }}>
                      {/* Color dot + picker */}
                      <input type="color" value={z.color}
                        onChange={e => setZones(prev => prev.map(x => x.id===z.id ? {...x, color:e.target.value} : x))}
                        style={{ width:28, height:28, padding:2, borderRadius:6, border:'2px solid var(--border)', cursor:'pointer', background:'none' }}/>

                      {/* Name */}
                      <input value={z.name}
                        onChange={e => setZones(prev => prev.map(x => x.id===z.id ? {...x, name:e.target.value} : x))}
                        style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, fontWeight:600, fontFamily:'var(--font-b)', background:'var(--bg)', color:'var(--text-primary)', outline:'none' }}/>

                      {/* Type badge selector */}
                      <div style={{ display:'flex', gap:4 }}>
                        {['zone','entry','exit'].map(t => (
                          <button key={t} onClick={() => setZones(prev => prev.map(x => x.id===z.id ? {...x, type:t} : x))}
                            style={{
                              padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', border:'1.5px solid',
                              borderColor: z.type===t ? (t==='entry'?'#22c55e':t==='exit'?'#ef4444':'#6366f1') : 'var(--border)',
                              background:  z.type===t ? (t==='entry'?'#f0fdf4':t==='exit'?'#fff5f5':'#eef2ff') : 'transparent',
                              color:       z.type===t ? (t==='entry'?'#16a34a':t==='exit'?'#dc2626':'#4f46e5') : 'var(--text-muted)',
                            }}>
                            {t==='entry'?'▶':t==='exit'?'◀':'□'} {t}
                          </button>
                        ))}
                      </div>

                      {/* Delete */}
                      <button onClick={() => setZones(prev => prev.filter(x => x.id !== z.id))}
                        style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer', color:'var(--text-muted)', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
                    </div>
                  ))}
                </div>

                {/* Add new zone */}
                <div style={{ padding:'10px 16px', background:'var(--bg)', borderTop:'1px solid var(--border)', display:'flex', gap:8, alignItems:'center' }}>
                  <input value={newZoneName} onChange={e => setNewZoneName(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter' && newZoneName.trim()) { setZones(prev=>[...prev,{id:zoneIdRef.current++,name:newZoneName.trim(),type:'zone',color:'#0ea5e9'}]); setNewZoneName(''); }}}
                    placeholder="Zone name (e.g. Section D, Aisle 3)…"
                    style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, fontFamily:'var(--font-m)', background:'var(--white)', outline:'none' }}/>
                  <button onClick={() => { if(!newZoneName.trim()) return; setZones(prev=>[...prev,{id:zoneIdRef.current++,name:newZoneName.trim(),type:'zone',color:'#0ea5e9'}]); setNewZoneName(''); }}
                    className="btn btn-primary" style={{ padding:'8px 18px', fontSize:12, whiteSpace:'nowrap' }}>+ Add Zone</button>
                </div>
              </div>
            )}

            <PCBCanvas
              inspection={inspection}
              zones={zones}
              onSourceChange={(isReal) => {
                if (isReal) { setScanning(true); setSystemStatus('RUNNING'); }
                else { setScanning(simRunning); }
              }}
            />
          </div>
        </div>
      )}

      {/* ── AI Console Tab ── */}
      {tab === 'console' && (
        <AIPipelinePanel inspection={inspection} simRunning={simRunning}/>
      )}

      {/* ── Root Cause Tab ── */}
      {tab === 'root' && (
        <RootCausePanel apiKey={apiKey} inspection={inspection}/>
      )}
    </div>
  );
}
