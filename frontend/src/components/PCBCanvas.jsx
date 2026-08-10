/**
 * PCBCanvas.jsx — Production Real-Time PCB Detection Component
 *
 * MODES:
 *   Simulation  — AI-simulated PCB (Start/Stop button controlled)
 *   Webcam      — getUserMedia live camera → YOLOv11 inference
 *   Video File  — Upload MP4/AVI → frame-by-frame → YOLOv11
 *   IP Camera   — HTTP/MJPEG stream → YOLOv11
 *
 * FEATURES:
 *   - Detection boxes with class name + confidence + severity
 *   - NMS handled server-side (no duplicate boxes)
 *   - Small defects (mouse_bite, spur) detected at conf=0.40
 *   - Alert dedup: same defect not repeated within 5 frames
 *   - FPS counter + inference ms shown in HUD
 *   - All 6 DeepPCB classes with distinct colors
 *   - Hindi + English defect explanation panel
 *   - Auto-screenshot on REJECT/FLAG
 *   - Adjustable confidence threshold slider
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import useAppStore from '../store/appStore';
import { useVideoDetections } from '../hooks/useVideoDetections';
import { useShallow } from 'zustand/react/shallow';
// simulation import removed — PCBCanvas only uses real YOLO inference

// ── Central API base — change once, applies everywhere ──────
const API_BASE = 'http://localhost:8000';

/* ── Retail Detection class colors and labels ── */
const DEFECT_INFO = {
  person:          { color:'#16a34a', emoji:'👥', en:'Customer detected in store zone',              hi:'स्टोर ज़ोन में ग्राहक पाया गया'         },
  space_na:        { color:'#2563eb', emoji:'📦', en:'Occupied Shelf Space — product is present',    hi:'भरा हुआ शेल्फ स्लॉट — उत्पाद मौजूद है'   },
  space_a:         { color:'#dc2626', emoji:'📭', en:'Vacant Shelf Space — RESTOCK REQUIRED',         hi:'खाली शेल्फ स्लॉट — रीस्टॉक आवश्यक है'   },
};

const CLASS_COLORS = {
  person:'#16a34a',
  space_na:'#2563eb',
  space_a:'#dc2626',
};

const DEC_COLOR = { APPROVE:'#16a34a', REJECT:'#DC2626', FLAG_FOR_REVIEW:'#D97706', PASS_WITH_LOG:'#0284C7' };
const DEC_BG    = { APPROVE:'rgba(22,163,74,.93)', REJECT:'rgba(220,38,38,.97)', FLAG_FOR_REVIEW:'rgba(217,119,6,.92)', PASS_WITH_LOG:'rgba(2,132,199,.92)' };
const DEC_LABEL = { APPROVE:'✓ NORMAL', REJECT:'🚨 ALERT', FLAG_FOR_REVIEW:'⚠ WARNING', PASS_WITH_LOG:'○ PASS' };

const TAG = {
  background:'rgba(0,0,0,.82)', backdropFilter:'blur(6px)',
  borderRadius:5, padding:'4px 9px',
  fontFamily:'var(--font-m)', fontSize:11, fontWeight:600, color:'#fff',
};

/* ═══════════════════════════════════════════════════
   DRAW DETECTIONS ON CANVAS
   Called after every inference — draws all defects
   from ONE scan in ONE pass (no re-scan)
═══════════════════════════════════════════════════ */
function drawBoxes(canvas, defects, srcW, srcH) {
  if (!canvas) return;
  const W = srcW || 640, H = srcH || 480;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  if (!defects?.length) return;

  defects.forEach(d => {
    const color = CLASS_COLORS[d.class_name] || '#fff';
    const isCrit = d.severity === 'CRITICAL';

    // Convert 0-100% bbox to pixels
    const x1 = (d.bbox[0] / 100) * W, y1 = (d.bbox[1] / 100) * H;
    const x2 = (d.bbox[2] / 100) * W, y2 = (d.bbox[3] / 100) * H;
    const bw = x2 - x1, bh = y2 - y1;

    /* ── Glow + border ── */
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = isCrit ? 22 : 12;
    ctx.strokeStyle = color; ctx.lineWidth = isCrit ? 3.5 : 2.5;
    ctx.setLineDash(isCrit ? [] : [9, 4]);
    ctx.strokeRect(x1, y1, bw, bh);
    ctx.setLineDash([]); ctx.shadowBlur = 0;
    ctx.restore();

    /* ── Fill ── */
    ctx.fillStyle = `${color}1c`;
    ctx.fillRect(x1, y1, bw, bh);

    /* ── Corner L-marks ── */
    const cs = Math.min(bw, bh) * 0.28;
    ctx.strokeStyle = color; ctx.lineWidth = 3.5;
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    [[x1,y1,1,1],[x2,y1,-1,1],[x1,y2,1,-1],[x2,y2,-1,-1]].forEach(([cx,cy,dx,dy]) => {
      ctx.beginPath();
      ctx.moveTo(cx+dx*cs, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy+dy*cs);
      ctx.stroke();
    });
    ctx.shadowBlur = 0;

    /* ── Label pill (class + confidence + severity) ── */
    const pctStr = `${(d.confidence * 100).toFixed(0)}%`;
    const label  = `${(d.class_name||"").replace(/_/g,' ')}  ${pctStr}`;
    const fs     = Math.max(11, Math.min(17, W / 52));
    ctx.font     = `700 ${fs}px monospace`;
    const tw     = ctx.measureText(label).width + 18;
    const ph     = fs + 12;
    const lx     = x1;
    const ly     = y1 >= ph + 4 ? y1 - ph - 2 : y2 + 2;

    // Pill background (cross-browser compatible — no roundRect)
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = 5;
    ctx.moveTo(lx + r, ly);
    ctx.lineTo(lx + tw - r, ly);
    ctx.quadraticCurveTo(lx + tw, ly, lx + tw, ly + r);
    ctx.lineTo(lx + tw, ly + ph - r);
    ctx.quadraticCurveTo(lx + tw, ly + ph, lx + tw - r, ly + ph);
    ctx.lineTo(lx + r, ly + ph);
    ctx.quadraticCurveTo(lx, ly + ph, lx, ly + ph - r);
    ctx.lineTo(lx, ly + r);
    ctx.quadraticCurveTo(lx, ly, lx + r, ly);
    ctx.closePath();
    ctx.fill();

    // Label text
    ctx.fillStyle = '#fff';
    ctx.fillText(label, lx + 9, ly + ph - 4);

    // Severity indicator dot
    const sevColors = { CRITICAL:'#FF4444', HIGH:'#FFAA00', MEDIUM:'#AA44FF', LOW:'#4488FF' };
    ctx.beginPath();
    ctx.arc(lx + tw + 8, ly + ph/2, 6, 0, Math.PI * 2);
    ctx.fillStyle = sevColors[d.severity] || '#888';
    ctx.shadowColor = sevColors[d.severity] || '#888';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

/* ═══════════════════════════════════════════════════
   RETAIL STORE SVG — Simulation Mode Only
   Top-down store layout with zones, shelves, people
═══════════════════════════════════════════════════ */
// Default zones if none passed
const DEFAULT_ZONES = [
  { id:1, name:'Entrance',  type:'entry', color:'#22c55e' },
  { id:2, name:'Section A', type:'zone',  color:'#6366f1' },
  { id:3, name:'Section B', type:'zone',  color:'#a855f7' },
  { id:4, name:'Section C', type:'zone',  color:'#f59e0b' },
  { id:5, name:'Checkout',  type:'exit',  color:'#ef4444' },
];

function RetailStoreBoard({ inspection, simRunning, onStartSim, onStopSim, zones: zonesProp }) {
  const zones = (zonesProp && zonesProp.length > 0) ? zonesProp : DEFAULT_ZONES;
  const dec     = inspection?.decision     || 'APPROVE';
  const persons = inspection?.defects_found || [];
  const fps     = inspection?.fps          || 24;
  const frameId = inspection?.board_id     || '---';
  const zone    = inspection?.zone         || 'Waiting…';
  const ms      = inspection?.inference_ms || 0;
  const count   = inspection?.person_count ?? persons.length;
  const density = inspection?.density      || 'LOW';
  const bc      = dec==='REJECT'?'#DC2626':dec==='FLAG_FOR_REVIEW'?'#D97706':'#16a34a';

  const DENSITY_COLOR = { LOW:'#16a34a', MEDIUM:'#0284C7', HIGH:'#D97706', CRITICAL:'#DC2626' };
  const dc = DENSITY_COLOR[density] || '#16a34a';

  // Dynamic zone layout — auto-tile zones in a grid
  const COLS = Math.ceil(Math.sqrt(zones.length));
  const ROWS = Math.ceil(zones.length / COLS);
  const PAD = 6; const W = 90; const H = 88;
  const zw = W / COLS; const zh = H / ROWS;
  const zoneRects = zones.map((z, i) => ({
    ...z,
    x: PAD + (i % COLS) * zw,
    y: PAD + Math.floor(i / COLS) * zh,
    w: zw - 1, h: zh - 1,
  }));

  // Sim persons — spread across zones
  const SIM_PERSONS = zoneRects.flatMap((z, i) => [
    { x: z.x + z.w*0.3, y: z.y + z.h*0.4, zone: z.name },
    { x: z.x + z.w*0.65, y: z.y + z.h*0.6, zone: z.name },
  ]);
  const visiblePersons = simRunning ? SIM_PERSONS.slice(0, Math.max(1, count)) : [];

  return (
    <div>
      {/* Controls */}
      <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center' }}>
        <button onClick={simRunning ? onStopSim : onStartSim} style={{
          display:'flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:8,
          cursor:'pointer', fontFamily:'var(--font-b)', fontSize:13, fontWeight:700, border:'none',
          background: simRunning ? 'var(--red)' : 'var(--green)', color:'#fff', transition:'all .15s',
        }}>
          {simRunning ? <><span style={{fontSize:14}}>⏹</span> Stop Simulation</> : <><span style={{fontSize:14}}>▶</span> Start Simulation</>}
        </button>
        {simRunning && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--green)', fontWeight:600 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)', display:'inline-block', animation:'livePulse 1s infinite' }}/>
            Live — {count} person{count!==1?'s':''} · {density} density · {ms}ms
          </div>
        )}
        {!simRunning && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Click to start retail store simulation — no model needed</span>}
      </div>

      {/* Store SVG */}
      <div style={{
        position:'relative', background:'#0f172a', borderRadius:14, overflow:'hidden',
        aspectRatio:'4/3', border:`2px solid ${simRunning ? bc : '#334155'}`,
        transition:'border-color .3s',
        opacity: simRunning ? 1 : 0.55,
        filter: simRunning ? 'none' : 'grayscale(0.6)',
      }}>
        <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>

          {/* Store floor */}
          <rect x="5" y="5" width="90" height="90" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="0.5"/>

          {/* Dynamic zones */}
          {zoneRects.map(z => {
            const hex = z.color;
            const typeIcon = z.type==='entry' ? '▶ ' : z.type==='exit' ? '◀ ' : '';
            return (
              <g key={z.id}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="1"
                  fill={`${hex}14`} stroke={`${hex}55`} strokeWidth="0.5"/>
                {/* Type badge for entry/exit */}
                {z.type !== 'zone' && (
                  <rect x={z.x+z.w-8} y={z.y+0.5} width={7.5} height={3.5} rx="0.5"
                    fill={z.type==='entry'?'rgba(34,197,94,.7)':'rgba(239,68,68,.7)'}/>
                )}
                {z.type !== 'zone' && (
                  <text x={z.x+z.w-4.2} y={z.y+3} textAnchor="middle" fontSize="2.2" fill="#fff" fontFamily="monospace" fontWeight="bold">
                    {z.type==='entry'?'IN':'OUT'}
                  </text>
                )}
                <text x={z.x+z.w/2} y={z.y+5.5} textAnchor="middle" fontSize="2.8" fill={`${hex}cc`} fontFamily="monospace" fontWeight="bold">
                  {z.name.toUpperCase()}
                </text>
                {/* Shelf lines */}
                {[0.25,0.5,0.75].map((f,si) => (
                  <rect key={si} x={z.x+z.w*f-1.5} y={z.y+z.h*0.35} width="3" height={z.h*0.35} rx="0.3"
                    fill={`${hex}22`} stroke={`${hex}55`} strokeWidth="0.3"/>
                ))}
              </g>
            );
          })}

          {/* Simulated persons */}
          {visiblePersons.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="2.8" fill={dc} opacity="0.9"
                style={{ filter:`drop-shadow(0 0 2px ${dc})` }}/>
              <circle cx={p.x} cy={p.y-1.2} r="1.2" fill="#fbbf24"/>
              <line x1={p.x} y1={p.y-0.1} x2={p.x} y2={p.y+2.5} stroke="#fbbf24" strokeWidth="0.6"/>
              <line x1={p.x-1.5} y1={p.y+1} x2={p.x+1.5} y2={p.y+1} stroke="#fbbf24" strokeWidth="0.5"/>
              <line x1={p.x-1} y1={p.y+2.5} x2={p.x} y2={p.y+1.8} stroke="#fbbf24" strokeWidth="0.5"/>
              <line x1={p.x+1} y1={p.y+2.5} x2={p.x} y2={p.y+1.8} stroke="#fbbf24" strokeWidth="0.5"/>
            </g>
          ))}

          {/* Detection boxes on persons */}
          {simRunning && persons.map((d, i) => {
            const p = visiblePersons[i];
            if (!p) return null;
            return (
              <g key={`box${i}`}>
                <rect x={p.x-4} y={p.y-3} width="8" height="9"
                  fill="rgba(34,197,94,.08)" stroke={dc} strokeWidth="0.6" rx="0.5"
                  strokeDasharray={density==='CRITICAL'?'0':'2,1'}/>
                <rect x={p.x-4} y={p.y-6} width="12" height="3" rx="0.5" fill={dc}/>
                <text x={p.x-3} y={p.y-3.8} fontSize="2.2" fill="#fff" fontWeight="bold" fontFamily="monospace">
                  person {Math.round(d.confidence*100)}%
                </text>
              </g>
            );
          })}

          {/* Store label */}
          <text x="50" y="97" textAnchor="middle" fontSize="2.5" fill="rgba(148,163,184,.3)" fontFamily="monospace">SMART RETAIL · CAM-01 · TOP VIEW</text>

          {/* Border glow */}
          <rect x="5" y="5" width="90" height="90" rx="2" fill="none" stroke={simRunning?bc:'#334155'} strokeWidth="1" opacity="0.5"/>
        </svg>

        {/* Scan line */}
        {simRunning && density !== 'CRITICAL' && (
          <div style={{ position:'absolute', left:0, right:0, height:2, pointerEvents:'none',
            background:`linear-gradient(90deg,transparent,${dc}cc 30%,${dc} 50%,${dc}cc 70%,transparent)`,
            boxShadow:`0 0 10px ${dc}88`, animation:'scanBoard 3s ease-in-out infinite' }}/>
        )}

        {/* HUD */}
        <div style={{ position:'absolute', inset:0, padding:10, pointerEvents:'none', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span style={TAG}>{simRunning ? 'CAM-01 ◎ SIM' : 'CAM-01 ◎ OFF'}</span>
              <span style={{...TAG, fontSize:9}}>{zone}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
              <span style={TAG}>{fps} FPS</span>
              {ms > 0 && <span style={{...TAG, fontSize:9}}>{ms}ms</span>}
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              <span style={{...TAG, fontSize:9, color:'rgba(255,255,255,.35)'}}>{frameId}</span>
              {simRunning && count > 0 && (
                <span style={{...TAG, fontSize:9, background:`${dc}cc`}}>
                  {count} person{count!==1?'s':''} detected
                </span>
              )}
            </div>
            {simRunning && (
              <span style={{ fontFamily:'var(--font-m)', fontSize:12, fontWeight:700, padding:'5px 13px', borderRadius:5,
                background: density==='CRITICAL'?'rgba(220,38,38,.95)':density==='HIGH'?'rgba(217,119,6,.92)':density==='MEDIUM'?'rgba(2,132,199,.92)':'rgba(22,163,74,.93)',
                color:'#fff' }}>
                {density==='CRITICAL'?'⛔ CRITICAL':density==='HIGH'?'⚠ HIGH CROWD':density==='MEDIUM'?'🟡 MEDIUM':'✓ LOW'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VIDEO OVERLAY — Canvas layer over real video feed
═══════════════════════════════════════════════════ */
function VideoOverlay({ result, videoEl, processing }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const el = videoEl?.current;
    const c  = canvasRef.current;
    if (!c) return;

    // Get the actual displayed size of the container
    const container = c.parentElement;
    const dispW = container?.clientWidth  || 640;
    const dispH = container?.clientHeight || 480;

    if (processing) {
      c.width = dispW; c.height = dispH;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, dispW, dispH);
      return;
    }

    if (!result?.defects_found?.length) {
      c.width = dispW; c.height = dispH;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, dispW, dispH);
      return;
    }

    // Calculate letterbox offset (objectFit:contain creates black bars)
    const vidW = el?.videoWidth  || el?.naturalWidth  || 640;
    const vidH = el?.videoHeight || el?.naturalHeight || 480;
    const scale = Math.min(dispW / vidW, dispH / vidH);
    const renderW = vidW * scale;
    const renderH = vidH * scale;
    const offsetX = (dispW - renderW) / 2;
    const offsetY = (dispH - renderH) / 2;

    // Draw on canvas at display resolution
    c.width = dispW; c.height = dispH;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, dispW, dispH);

    // Draw boxes with letterbox offset applied
    result.defects_found.forEach(d => {
      const color = CLASS_COLORS[d.class_name] || '#fff';
      const isCrit = d.severity === 'CRITICAL';

      // Convert 0-100% bbox to pixels within the rendered video area
      const x1 = offsetX + (d.bbox[0] / 100) * renderW;
      const y1 = offsetY + (d.bbox[1] / 100) * renderH;
      const x2 = offsetX + (d.bbox[2] / 100) * renderW;
      const y2 = offsetY + (d.bbox[3] / 100) * renderH;
      const bw = x2 - x1, bh = y2 - y1;

      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = isCrit ? 18 : 10;
      ctx.strokeStyle = color; ctx.lineWidth = isCrit ? 3 : 2;
      ctx.setLineDash(isCrit ? [] : [8, 4]);
      ctx.strokeRect(x1, y1, bw, bh);
      ctx.setLineDash([]); ctx.shadowBlur = 0;
      ctx.restore();

      ctx.fillStyle = `${color}1c`;
      ctx.fillRect(x1, y1, bw, bh);

      // Corner marks
      const cs = Math.min(bw, bh) * 0.25;
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      [[x1,y1,1,1],[x2,y1,-1,1],[x1,y2,1,-1],[x2,y2,-1,-1]].forEach(([cx,cy,dx,dy]) => {
        ctx.beginPath();
        ctx.moveTo(cx+dx*cs, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy+dy*cs);
        ctx.stroke();
      });

      // Label
      const label = `${(d.class_name||"").replace(/_/g,' ')} ${(d.confidence*100).toFixed(0)}%`;
      const fs = 12;
      ctx.font = `700 ${fs}px monospace`;
      const tw = ctx.measureText(label).width + 12;
      const ph = fs + 8;
      const ly = y1 >= ph + 4 ? y1 - ph - 2 : y2 + 2;
      ctx.fillStyle = color;
      ctx.fillRect(x1, ly, tw, ph);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x1 + 6, ly + ph - 4);
    });
  }, [result, processing]);

  return <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:3 }}/>;
}

/* ═══════════════════════════════════════════════════
   VIDEO HUD — Top + bottom-right corner info
═══════════════════════════════════════════════════ */
function VideoHUD({ label, result, processing, frameNo, fps, confThresh }) {
  const dec = result?.decision;
  return (
    <div style={{ position:'absolute', inset:0, padding:10, pointerEvents:'none', zIndex:4, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
      {/* Top row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ display:'flex', gap:6, flexDirection:'column' }}>
          <div style={{ display:'flex', gap:6 }}>
            <span style={TAG}>{label}</span>
            {processing && (
              <span style={{...TAG, background:'rgba(0,87,255,.9)', display:'flex', alignItems:'center', gap:5}}>
                <span className="spinner" style={{width:10,height:10,borderWidth:1.5}}/>YOLOv11
              </span>
            )}
          </div>
          {result && (
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              <span style={{...TAG, fontSize:9}}>conf={confThresh}</span>
              {frameNo > 0 && <span style={{...TAG, fontSize:9}}>Frame #{frameNo}</span>}
              {fps > 0 && <span style={{...TAG, fontSize:9}}>{fps} FPS</span>}
            </div>
          )}
        </div>
        {dec && (
          <span style={{ fontFamily:'var(--font-m)', fontSize:12, fontWeight:700, padding:'5px 12px', borderRadius:5, background:DEC_BG[dec]||'rgba(0,0,0,.8)', color:'#fff', animation:dec==='REJECT'?'rejectFlash .5s ease':undefined }}>
            {DEC_LABEL[dec]}
          </span>
        )}
      </div>

      {/* Bottom-right — all detections summary */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          {result && (
            <span style={{...TAG, fontSize:9, color:'rgba(255,255,255,.45)'}}>
              {result.board_id} · {result.inference_ms}ms · CAM-01
            </span>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'flex-end' }}>
          {result && (
            <span style={{...TAG, fontSize:10, background: result.total_defects>0?'rgba(220,38,38,.9)':'rgba(22,163,74,.9)'}}>
              {result.total_defects > 0 ? `⚠ ${result.total_defects} defect${result.total_defects>1?'s':''}` : '✓ Board clean'}
            </span>
          )}
          {result?.defects_found?.map((d,i) => {
            const color = CLASS_COLORS[d.class_name] || '#fff';
            return (
              <span key={i} style={{ fontSize:9, fontFamily:'var(--font-m)', fontWeight:700, color:'#fff', padding:'2px 7px', borderRadius:4, background:`${color}cc` }}>
                {d.class_name} {(d.confidence*100).toFixed(0)}%
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DEFECT EXPLAINER — EN + Hindi below camera
   Shows ALL defects from ONE scan at once
═══════════════════════════════════════════════════ */
function DefectExplainer({ result, onScreenshot }) {
  if (!result?.defects_found?.length) return null;
  const dec  = result.decision;
  const bl   = dec==='REJECT'?'var(--red)':dec==='FLAG_FOR_REVIEW'?'var(--amber)':'var(--green)';
  const bg   = dec==='REJECT'?'#fff8f8':dec==='FLAG_FOR_REVIEW'?'#fffbf0':'#f0fdf4';
  const bc   = dec==='REJECT'?'var(--red-border)':dec==='FLAG_FOR_REVIEW'?'var(--amber-border)':'var(--green-border)';
  return (
    <div style={{ marginTop:12, padding:'14px 16px', background:bg, border:`1.5px solid ${bc}`, borderLeft:`4px solid ${bl}`, borderRadius:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>{dec==='REJECT'?'🚨':dec==='FLAG_FOR_REVIEW'?'⚠️':'✅'}</span>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:bl }}>
              {dec==='REJECT'?'REJECT — Line Halt Triggered':dec==='FLAG_FOR_REVIEW'?'FLAG FOR REVIEW':'PASS'} · {result.board_id}
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-m)', marginTop:2 }}>
              {result.total_defects} defect{result.total_defects>1?'s':''} · ONE scan ({result.inference_ms}ms) ·
              {new Date(result.timestamp||Date.now()).toLocaleTimeString('en-GB',{hour12:false})}
            </div>
          </div>
        </div>
        {(dec==='REJECT'||dec==='FLAG_FOR_REVIEW') && (
          <button onClick={onScreenshot} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'var(--brand)', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
            📸 Screenshot
          </button>
        )}
      </div>

      {/* Each defect card */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {result.defects_found?.map((d,i) => {
          const info  = DEFECT_INFO[d.class_name] || { color:'#888', emoji:'⚪', en:d.class_name, hi:d.class_name };
          const color = CLASS_COLORS[d.class_name] || info.color;
          return (
            <div key={i} style={{ padding:'12px 14px', borderRadius:10, background:'#fff', border:`1px solid ${color}30`, borderLeft:`4px solid ${color}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:18 }}>{info.emoji}</span>
                  <div>
                    <span style={{ fontWeight:800, fontSize:13, color }}>{(d.class_name||"").replace(/_/g,' ').toUpperCase()}</span>
                    <span className={`badge badge-${d.severity}`} style={{ fontSize:9, marginLeft:8 }}>{d.severity}</span>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'var(--font-m)', fontWeight:800, fontSize:16, color }}>{(d.confidence*100).toFixed(1)}%</div>
                  <div style={{ fontSize:9, color:'var(--text-muted)' }}>confidence</div>
                </div>
              </div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', padding:'6px 10px', background:'var(--bg)', borderRadius:6, border:'1px solid var(--border)', marginBottom:5 }}>
                🔍 <strong>What:</strong> {info.en}
              </div>
              <div style={{ fontSize:12, padding:'6px 10px', background:'var(--amber-light)', borderRadius:6, border:'1px solid var(--amber-border)', color:'#92400e' }}>
                🇮🇳 <strong>Hindi:</strong> {info.hi}
              </div>
              <div style={{ marginTop:5, fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:4, color: d.severity==='CRITICAL'?'var(--red)':d.severity==='HIGH'?'var(--amber)':'var(--brand)', background: d.severity==='CRITICAL'?'var(--red-light)':d.severity==='HIGH'?'var(--amber-light)':'var(--brand-light)' }}>
                {d.severity==='CRITICAL'?'⊘ Auto-action: REJECT + Line Halt':d.severity==='HIGH'?'⚠ Auto-action: FLAG for Human Review':d.confidence>=0.6?'⚠ Auto-action: FLAG for Review':'○ Auto-action: PASS with Log'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent 1 */}
      <div style={{ marginTop:10, padding:'10px 12px', background:'linear-gradient(135deg,#eff6ff,#f0f9ff)', border:'1px solid rgba(0,87,255,.15)', borderRadius:10 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--brand)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:5 }}>⬡ Agent 1 — Vision Inspector</div>
        <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:4, lineHeight:1.6 }}>
          Board <strong>{result.board_id}</strong>: {result.total_defects} defect{result.total_defects>1?'s':''} detected in <strong>ONE full-board scan</strong> ({result.inference_ms}ms) — {result.defects_found?.map(d=>`${d.class_name} (${(d.confidence*100).toFixed(0)}%)`).join(', ')}. Decision: <strong>{(result.decision||"").replace(/_/g,' ')}</strong>.{result.line_halt_required?' ⊘ Line halt triggered.':''}
        </div>
        <div style={{ fontSize:12, color:'#92400e', fontStyle:'italic', lineHeight:1.6 }}>
          Board {result.board_id} mein ek hi scan mein {result.total_defects} defect{result.total_defects>1?' mile':' mila'} — {result.defects_found?.map(d=>d.class_name).join(', ')}. Decision: {(result.decision||"").replace(/_/g,' ')}.{result.line_halt_required?' Line rok di gayi.':''}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SCREENSHOT STRIP
═══════════════════════════════════════════════════ */
function ScreenshotStrip({ shots, onDownload, onClear }) {
  if (!shots.length) return null;
  return (
    <div style={{ marginTop:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)' }}>
          📸 Auto-captured Defects <span style={{ background:'var(--red)', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10, marginLeft:4 }}>{shots.length}</span>
        </span>
        <button onClick={onClear} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', fontSize:11, color:'var(--text-muted)', padding:'3px 8px' }}>Clear</button>
      </div>
      <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:6 }}>
        {shots.map((s,i) => (
          <div key={i} onClick={() => onDownload(s)} title="Click to download"
            style={{ flexShrink:0, borderRadius:8, overflow:'hidden', cursor:'pointer', position:'relative', border:`2px solid ${DEC_COLOR[s.decision]||'var(--border)'}`, boxShadow:`0 2px 8px ${DEC_COLOR[s.decision]||'#888'}40` }}>
            <img src={s.dataUrl} alt="" style={{ width:130, height:73, objectFit:'cover', display:'block' }}/>
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,.78) 45%,transparent)' }}/>
            <div style={{ position:'absolute', top:4, right:4, background:DEC_BG[s.decision]||'rgba(0,0,0,.8)', borderRadius:3, padding:'2px 6px', fontSize:8, fontFamily:'var(--font-m)', fontWeight:700, color:'#fff' }}>
              {s.decision==='REJECT'?'⊘ REJ':'⚠ FLAG'}
            </div>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'4px 6px' }}>
              <div style={{ fontFamily:'var(--font-m)', fontSize:8, color:'#fff', fontWeight:700 }}>{s.board_id}</div>
              <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:2 }}>
                {s.defects?.map((d,j) => (
                  <span key={j} style={{ fontSize:7, background:`${CLASS_COLORS[d.class_name]||'#888'}cc`, color:'#fff', padding:'1px 4px', borderRadius:3 }}>
                    {(d.class_name||"").split('_')[0]} {(d.confidence*100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   VIDEO UPLOAD + MJPEG STREAM
   Upload → auto-start with default zones → live MJPEG stream
═══════════════════════════════════════════════════ */
// ── Zone Editor — exact same as Jobs.jsx polygon logic ──────────────────────
const _ZONE_COLORS  = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];
const _ENTRY_COLOR  = '#22c55e';
const _EXIT_COLOR   = '#ef4444';
const _ZONE_NAMES   = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E'];

// ZoneDrawer — rewritten with stable RAF draw loop, no stale closure issues
function ZoneDrawer({ frameUrl, zones, setZones, entryZone, setEntryZone, exitZone, setExitZone, disabled }) {
  const canvasRef   = useRef(null);
  const imgRef      = useRef(null);        // always latest loaded image
  const zonesRef    = useRef(zones);
  const entryRef    = useRef(entryZone);
  const exitRef     = useRef(exitZone);
  const rafRef      = useRef(null);
  const [tool,       setTool]       = useState('zone');
  const [activeZone, setActiveZone] = useState(null);
  const [imgReady,   setImgReady]   = useState(false);

  // Keep refs in sync — no stale closures in rAF loop
  useEffect(() => { zonesRef.current  = zones;      }, [zones]);
  useEffect(() => { entryRef.current  = entryZone;  }, [entryZone]);
  useEffect(() => { exitRef.current   = exitZone;   }, [exitZone]);

  // Load image once per frameUrl — never causes canvas reset
  useEffect(() => {
    setImgReady(false);
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width  = img.naturalWidth  || 800;
        canvas.height = img.naturalHeight || 450;
      }
      setImgReady(true);
    };
    img.onerror = () => console.warn('ZoneDrawer: failed to load frame');
    img.src = frameUrl;
    // Already cached
    if (img.complete && img.naturalWidth > 0) {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width  = img.naturalWidth  || 800;
        canvas.height = img.naturalHeight || 450;
      }
      setImgReady(true);
    }
    return () => { img.onload = null; img.onerror = null; };
  }, [frameUrl]);

  // Single rAF draw loop — reads from refs, never recreated
  useEffect(() => {
    if (!imgReady) return;

    const drawFrame = () => {
      const canvas = canvasRef.current;
      const img    = imgRef.current;
      if (!canvas || !img) { rafRef.current = requestAnimationFrame(drawFrame); return; }

      const W = canvas.width  || 800;
      const H = canvas.height || 450;
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);

      const drawPoly = (zone, color, label) => {
        if (!zone || zone.points.length < 1) return;
        const pts = zone.points;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2.5;
        ctx.fillStyle   = color + '35';
        ctx.setLineDash(zone.closed ? [] : [6, 3]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x * W, pts[0].y * H);
        pts.forEach(p => ctx.lineTo(p.x * W, p.y * H));
        if (zone.closed) ctx.closePath();
        ctx.stroke();
        if (zone.closed) ctx.fill();
        ctx.setLineDash([]);
        // Vertex dots
        pts.forEach(p => {
          ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        });
        // Label
        if (pts.length >= 2) {
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length * W;
          const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length * H;
          ctx.textAlign = 'center';
          ctx.font = 'bold 14px sans-serif';
          ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
          ctx.strokeText(label, cx, cy);
          ctx.fillStyle = color; ctx.lineWidth = 1;
          ctx.fillText(label, cx, cy);
        }
      };

      zonesRef.current.forEach((z, zi) =>
        drawPoly(z, z.color || _ZONE_COLORS[zi % _ZONE_COLORS.length], z.name));
      drawPoly(entryRef.current, entryRef.current?.color || _ENTRY_COLOR, entryRef.current?.name || '⬡ ENTRY');
      drawPoly(exitRef.current,  exitRef.current?.color  || _EXIT_COLOR,  exitRef.current?.name  || '⬡ EXIT');

      rafRef.current = requestAnimationFrame(drawFrame);
    };

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [imgReady]);  // ← only restarts when image loads, NOT on every zone click

  const getRelPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const handleCanvasClick = (e) => {
    if (disabled) return;
    const pos = getRelPos(e);
    const addPoint = (setter) => setter(prev =>
      prev ? { ...prev, points: [...prev.points, pos] } : { points: [pos], closed: false }
    );
    if (tool === 'entry') { addPoint(setEntryZone); return; }
    if (tool === 'exit')  { addPoint(setExitZone);  return; }
    if (tool === 'zone') {
      if (activeZone === null) {
        const idx = zones.length;
        setZones(prev => [...prev, { name: `Zone ${idx + 1}`, color: _ZONE_COLORS[idx % _ZONE_COLORS.length], points: [pos], closed: false }]);
        setActiveZone(idx);
      } else {
        setZones(prev => prev.map((z, i) => i === activeZone ? { ...z, points: [...z.points, pos] } : z));
      }
    }
  };

  const closeZone = () => {
    if (tool === 'entry') { setEntryZone(prev => prev ? { ...prev, closed: true } : prev); return; }
    if (tool === 'exit')  { setExitZone(prev  => prev ? { ...prev, closed: true } : prev); return; }
    if (activeZone === null) return;
    setZones(prev => prev.map((z, i) => i === activeZone ? { ...z, closed: true } : z));
    setActiveZone(null);
  };

  const removeZone = (idx) => {
    setZones(prev => prev.filter((_, i) => i !== idx));
    if (activeZone === idx) setActiveZone(null);
    else if (activeZone !== null && activeZone > idx) setActiveZone(activeZone - 1);
  };

  const isDrawing = (tool === 'entry' && entryZone && !entryZone.closed) ||
                    (tool === 'exit'  && exitZone  && !exitZone.closed)  ||
                    (tool === 'zone'  && activeZone !== null);

  return (
    <div className="zone-editor">
      <div className="zone-toolbar">
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <button className={`tool-btn ${tool==='entry'?'active':''}`} onClick={() => setTool('entry')} disabled={disabled}
            style={{ borderColor:tool==='entry'?'#22c55e':'', color:tool==='entry'?'#16a34a':'', background:tool==='entry'?'#f0fdf4':'' }}>
            ⬡ Entry Zone
          </button>
          <button className={`tool-btn ${tool==='exit'?'active':''}`} onClick={() => setTool('exit')} disabled={disabled}
            style={{ borderColor:tool==='exit'?'#ef4444':'', color:tool==='exit'?'#dc2626':'', background:tool==='exit'?'#fff5f5':'' }}>
            ⬡ Exit Zone
          </button>
          <button className={`tool-btn ${tool==='zone'?'active':''}`} onClick={() => setTool('zone')} disabled={disabled || zones.length >= 8}>
            ⬡ Draw Zone
          </button>
          {isDrawing && !disabled && <button className="tool-btn done" onClick={closeZone}>✓ Close Zone</button>}
          <button className="tool-btn reset" disabled={disabled} onClick={() => { setZones([]); setActiveZone(null); setEntryZone(null); setExitZone(null); }}>↺ Reset</button>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>
            {isDrawing ? 'Points click karo, phir “Close Zone” karo' : 'Tool select karo aur canvas pe click karo'}
          </span>
        </div>
      </div>

      <div style={{ position:'relative' }}>
        <canvas ref={canvasRef} onClick={handleCanvasClick}
          style={{ width:'100%', minHeight:320, cursor: disabled ? 'default' : 'crosshair', display:'block', background:'#0a0e14' }}/>
        {!imgReady && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'#0a0e14' }}>
            <div className="spinner" style={{ width:32, height:32 }}/>
            <div style={{ color:'#94a3b8', fontSize:12 }}>Loading frame…</div>
          </div>
        )}
      </div>

      {(zones.length > 0 || entryZone || exitZone) && (
        <div className="zone-list">
          {entryZone && (
            <div className="zone-chip" style={{ background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
              <div className="zone-chip-dot" style={{ background: entryZone.color || _ENTRY_COLOR }}/>
              <input className="zone-name-input" value={entryZone.name || 'Entry'}
                onChange={e => setEntryZone(prev => prev ? {...prev, name: e.target.value} : prev)}/>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{entryZone.points.length} pts</span>
              {entryZone.closed ? <span style={{ fontSize:11, color:'#16a34a', fontWeight:600 }}>✓</span> : <span style={{ fontSize:11, color:'#d97706' }}>Drawing…</span>}
              <button onClick={() => setEntryZone(null)} disabled={disabled} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontSize:14 }}>✕</button>
            </div>
          )}
          {exitZone && (
            <div className="zone-chip" style={{ background:'#fff5f5', border:'1px solid #fed7d7' }}>
              <div className="zone-chip-dot" style={{ background: exitZone.color || _EXIT_COLOR }}/>
              <input className="zone-name-input" value={exitZone.name || 'Exit'}
                onChange={e => setExitZone(prev => prev ? {...prev, name: e.target.value} : prev)}/>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{exitZone.points.length} pts</span>
              {exitZone.closed ? <span style={{ fontSize:11, color:'#16a34a', fontWeight:600 }}>✓</span> : <span style={{ fontSize:11, color:'#d97706' }}>Drawing…</span>}
              <button onClick={() => setExitZone(null)} disabled={disabled} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontSize:14 }}>✕</button>
            </div>
          )}
          {zones.map((zone, i) => (
            <div key={i} className="zone-chip">
              <div className="zone-chip-dot" style={{ background: zone.color || _ZONE_COLORS[i % _ZONE_COLORS.length] }}/>
              <input className="zone-name-input" value={zone.name}
                onChange={e => setZones(prev => prev.map((z, zi) => zi===i ? {...z, name: e.target.value} : z))}/>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{zone.points.length} pts</span>
              {zone.closed ? <span style={{ fontSize:11, color:'#16a34a', fontWeight:600 }}>✓</span> : <span style={{ fontSize:11, color:'#d97706' }}>Drawing…</span>}
              <button onClick={() => removeZone(i)} disabled={disabled} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontSize:14 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      {!entryZone && !exitZone && zones.length === 0 && (
        <div style={{ padding:'12px 16px', background:'#eff6ff', borderTop:'1px solid #bfdbfe', fontSize:12, color:'#1e40af' }}>
          💡 <strong>Entry Zone (green)</strong> — jahan se log andar aate hain &nbsp;|&nbsp;
          <strong>Exit Zone (red)</strong> — jahan se log bahar jaate hain &nbsp;|&nbsp;
          <strong>Draw Zone</strong> — store ke sections
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STREAM ZONE OVERLAY
   Draws user's saved zone polygons over the MJPEG
   stream using a transparent canvas on top of <img>
═══════════════════════════════════════════════════ */
function StreamZoneOverlay({ zones, entryZone, exitZone }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const zonesRef  = useRef(zones);
  const entryRef  = useRef(entryZone);
  const exitRef   = useRef(exitZone);

  useEffect(() => { zonesRef.current = zones;     }, [zones]);
  useEffect(() => { entryRef.current = entryZone; }, [entryZone]);
  useEffect(() => { exitRef.current  = exitZone;  }, [exitZone]);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(draw); return; }
      const W = canvas.offsetWidth  || 640;
      const H = canvas.offsetHeight || 360;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width  = W;
        canvas.height = H;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);

      const drawPoly = (zone, color, label) => {
        if (!zone || zone.points.length < 2) return;
        const pts = zone.points;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.fillStyle   = color + '28';
        ctx.setLineDash(zone.closed ? [] : [6, 3]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x * W, pts[0].y * H);
        pts.forEach(p => ctx.lineTo(p.x * W, p.y * H));
        if (zone.closed) ctx.closePath();
        ctx.stroke();
        if (zone.closed) ctx.fill();
        ctx.setLineDash([]);
        // Vertex dots
        pts.forEach(p => {
          ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        });
        // Label pill
        if (pts.length >= 2) {
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length * W;
          const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length * H;
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          const tw = ctx.measureText(label).width + 14;
          ctx.fillStyle = color + 'cc';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(cx - tw/2, cy - 10, tw, 20, 4)
            : ctx.rect(cx - tw/2, cy - 10, tw, 20);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText(label, cx, cy + 4);
        }
      };

      zonesRef.current.forEach((z, zi) =>
        drawPoly(z, z.color || _ZONE_COLORS[zi % _ZONE_COLORS.length], z.name));
      if (entryRef.current) drawPoly(entryRef.current, entryRef.current.color || _ENTRY_COLOR, entryRef.current.name || 'Entry');
      if (exitRef.current)  drawPoly(exitRef.current,  exitRef.current.color  || _EXIT_COLOR,  exitRef.current.name  || 'Exit');

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const hasZones = zones.length > 0 || entryZone || exitZone;
  if (!hasZones) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 5,
      }}
    />
  );
}

function VideoUploadStream({ addConsoleEntry, setSystemStatus, zones, confThresh }) {
  const fileRef    = useRef(null);
  const jobIdRef   = useRef(null);
  const [phase,      setPhase]      = useState('idle');
  const [jobId,      setJobId]      = useState(null);
  const [fileName,   setFileName]   = useState('');
  const [progress,   setProgress]   = useState(0);
  const [errMsg,     setErrMsg]     = useState('');
  const [frameUrl,   setFrameUrl]   = useState('');
  const [processing, setProcessing] = useState(false);
  // Zone state lives HERE — never reset by phase changes
  const [drawnZones,     setDrawnZones]     = useState([]);
  const [drawnEntryZone, setDrawnEntryZone] = useState(null);
  const [drawnExitZone,  setDrawnExitZone]  = useState(null);
  // Stable refs so _buildPayload always reads latest zone state (no stale closure)
  const drawnZonesRef     = useRef([]);
  const drawnEntryZoneRef = useRef(null);
  const drawnExitZoneRef  = useRef(null);
  const pollRef = useRef(null);

  // Wrapper setters — update state AND ref synchronously (no stale closure on Process click)
  const setDrawnZonesSynced = useCallback((val) => {
    const next = typeof val === 'function' ? val(drawnZonesRef.current) : val;
    drawnZonesRef.current = next;
    setDrawnZones(next);
  }, []);
  const setDrawnEntryZoneSynced = useCallback((val) => {
    const next = typeof val === 'function' ? val(drawnEntryZoneRef.current) : val;
    drawnEntryZoneRef.current = next;
    setDrawnEntryZone(next);
  }, []);
  const setDrawnExitZoneSynced = useCallback((val) => {
    const next = typeof val === 'function' ? val(drawnExitZoneRef.current) : val;
    drawnExitZoneRef.current = next;
    setDrawnExitZone(next);
  }, []);

  const activeZones = (zones && zones.length > 0) ? zones : DEFAULT_ZONES;

  // Init drawn zones from activeZones when frame loads
  const initZonesFromConfig = () => {
    const regularZones = activeZones.filter(z => z.type === 'zone');
    const entryZ = activeZones.find(z => z.type === 'entry');
    const exitZ  = activeZones.find(z => z.type === 'exit');
    const n = regularZones.length;
    const cols = Math.ceil(Math.sqrt(n)) || 1;
    const cw = 1 / cols;
    const ch = 1 / Math.ceil(n / cols);
    const newZones = regularZones.map((z, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      return { name: z.name, color: z.color,
        points: [{x:col*cw,y:row*ch},{x:(col+1)*cw,y:row*ch},{x:(col+1)*cw,y:(row+1)*ch},{x:col*cw,y:(row+1)*ch}],
        closed: true };
    });
    const newEntry = entryZ ? { name: entryZ.name, color: entryZ.color,
      points: [{x:0,y:0},{x:1,y:0},{x:1,y:0.15},{x:0,y:0.15}], closed: true } : null;
    const newExit = exitZ ? { name: exitZ.name, color: exitZ.color,
      points: [{x:0,y:0.85},{x:1,y:0.85},{x:1,y:1},{x:0,y:1}], closed: true } : null;
    setDrawnZonesSynced(newZones);
    setDrawnEntryZoneSynced(newEntry);
    setDrawnExitZoneSynced(newExit);
  };

  const [liveMetrics, setLiveMetrics] = useState(null);

  useEffect(() => {
    if (phase !== 'streaming' || !jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/result/${jobId}`);
        if (!r.ok) return;
        const d = await r.json();
        setProgress(d.progress || 0);
        // Live metrics available during processing
        if (d.analytics) setLiveMetrics(d.analytics);
        if (d.status === 'completed') {
          setPhase('done'); setProgress(100);
          if (d.analytics) setLiveMetrics(d.analytics);
          clearInterval(pollRef.current); setSystemStatus('IDLE');
          addConsoleEntry({ time: new Date().toLocaleTimeString('en-GB',{hour12:false}), tag:'INFO', tagClass:'INFO', msg:`[INFO] Video processing complete — job ${jobId.slice(0,8)}` });
        } else if (d.status === 'failed') {
          setPhase('error'); setErrMsg(d.error_message || 'Processing failed');
          clearInterval(pollRef.current);
        }
      } catch(_) {}
    }, 1500);
    return () => clearInterval(pollRef.current);
  }, [phase, jobId]);

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name); setErrMsg(''); setProgress(0);
    setPhase('uploading');
    addConsoleEntry({ time: new Date().toLocaleTimeString('en-GB',{hour12:false}), tag:'INFO', tagClass:'INFO', msg:`[INFO] Uploading ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)…` });
    let jid;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${API_BASE}/upload-video/`, { method:'POST', body:fd });
      if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
      const d = await r.json();
      jid = d.job_id; setJobId(jid); jobIdRef.current = jid;
    } catch(e) { setPhase('error'); setErrMsg(e.message); return; }
    try {
      const fr = await fetch(`${API_BASE}/jobs/${jid}/frame`);
      if (fr.ok) {
        const blob = await fr.blob();
        setFrameUrl(URL.createObjectURL(blob));
        initZonesFromConfig(); // pre-populate with custom zone names+colors
        setPhase('zone_draw');
        addConsoleEntry({ time: new Date().toLocaleTimeString('en-GB',{hour12:false}), tag:'INFO', tagClass:'INFO', msg:`[INFO] Draw zones on first frame, then click Process` });
        return;
      }
    } catch(_) {}
    await _startJob(jid, null);
  };

  // Build payload from refs (always latest zone state — no stale closure)
  const _buildPayload = () => {
    const toPoints = (zone) => zone && zone.points.length >= 2
      ? zone.points.map(p => [Math.round(p.x * 100), Math.round(p.y * 100)]) : [];
    return {
      zones: drawnZonesRef.current.filter(z => z.points.length >= 2).map(z => ({
        name: z.name,
        points: z.points.map(p => [Math.round(p.x * 100), Math.round(p.y * 100)])
      })),
      entry_zone: toPoints(drawnEntryZoneRef.current),
      exit_zone:  toPoints(drawnExitZoneRef.current),
    };
  };

  // Internal: actually POST to backend — keeps zone_draw visible during processing
  const _startJob = async (jid, _ignored) => {
    setProcessing(true);
    addConsoleEntry({ time: new Date().toLocaleTimeString('en-GB',{hour12:false}), tag:'INFO', tagClass:'INFO', msg:`[INFO] Starting analysis — job ${jid.slice(0,8)}…` });
    try {
      const payload = _buildPayload();
      const fd2 = new FormData();
      fd2.append('zones',      JSON.stringify(payload.zones));
      fd2.append('entry_zone', JSON.stringify(payload.entry_zone));
      fd2.append('exit_zone',  JSON.stringify(payload.exit_zone));
      fd2.append('conf',       String(confThresh));
      const r2 = await fetch(`${API_BASE}/jobs/${jid}/start`, { method:'POST', body:fd2 });
      if (!r2.ok) throw new Error(`Start failed: ${r2.status}`);
    } catch(e) { setProcessing(false); setPhase('error'); setErrMsg(e.message); return; }
    setProcessing(false);
    setPhase('streaming'); setSystemStatus('RUNNING');
    addConsoleEntry({ time: new Date().toLocaleTimeString('en-GB',{hour12:false}), tag:'INFO', tagClass:'INFO', msg:`[INFO] Live stream started — /jobs/${jid.slice(0,8)}/stream` });
  };

  const reset = () => {
    clearInterval(pollRef.current);
    if (frameUrl) URL.revokeObjectURL(frameUrl);
    setPhase('idle'); setJobId(null); setFileName(''); setProgress(0);
    setErrMsg(''); setFrameUrl(''); setProcessing(false);
    setLiveMetrics(null);
    setDrawnZonesSynced([]); setDrawnEntryZoneSynced(null); setDrawnExitZoneSynced(null);
    setSystemStatus('IDLE');
  };

  return (
    <div>
      {/* Zones preview — always shown in idle */}
      {phase === 'idle' && (
        <div style={{ marginBottom:12, padding:'12px 14px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:8 }}>📍 Zones for this video analysis:</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {activeZones.map(z => (
              <span key={z.id} style={{
                display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
                borderRadius:20, fontSize:11, fontWeight:600,
                background: `${z.color}18`, border:`1px solid ${z.color}55`, color: z.color,
              }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:z.color, display:'inline-block' }}/>
                {z.name}
                {z.type !== 'zone' && <span style={{ fontSize:9, opacity:.8 }}>({z.type})</span>}
              </span>
            ))}
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6 }}>To change zones — use 🗺️ Configure Zones button above</div>
        </div>
      )}

      {/* Drop zone — shown when idle */}
      {phase === 'idle' && (
        <div onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          style={{ aspectRatio:'16/9', background:'#0a0e14', borderRadius:14, border:'2px dashed var(--border)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            gap:14, cursor:'pointer', color:'var(--text-muted)', transition:'border-color .2s' }}>
          <div style={{ fontSize:52, opacity:.4 }}>🎬</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#94a3b8' }}>Drop retail store video here</div>
          <div style={{ fontSize:12, opacity:.6 }}>MP4, AVI, MOV, MKV — auto-starts person detection</div>
          <button className="btn btn-primary" onClick={e=>{e.stopPropagation();fileRef.current?.click();}}>📁 Choose Video</button>
        </div>
      )}

      {/* Uploading */}
      {phase === 'uploading' && (
        <div style={{ aspectRatio:'16/9', background:'#0a0e14', borderRadius:14, border:'2px solid var(--brand)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
          <div className="spinner" style={{ width:48, height:48, borderWidth:5 }}/>
          <div style={{ color:'#fff', fontWeight:700, fontSize:15 }}>Uploading {fileName}…</div>
          <div style={{ color:'#93c5fd', fontSize:12 }}>Please wait — do not close</div>
        </div>
      )}

      {phase === 'zone_draw' && frameUrl && (
        <div style={{ border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', background:'var(--white)', position:'relative' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>🗺️ Zones &amp; Entry/Exit Configure Karo</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Canvas pe zones draw karo, phir “Process Karo” click karo</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {!processing && (
                <button onClick={() => _startJob(jobIdRef.current, null)}
                  style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', fontSize:11, cursor:'pointer', color:'var(--text-muted)' }}>
                  Skip → Default
                </button>
              )}
              <button className="btn btn-primary btn-sm" disabled={processing}
                onClick={() => _startJob(jobIdRef.current, null)}>
                {processing ? <><span className="spinner" style={{width:12,height:12,display:'inline-block',marginRight:6}}/> Starting…</> : '▶ Process Karo'}
              </button>
            </div>
          </div>
          <ZoneDrawer
            frameUrl={frameUrl}
            zones={drawnZones}         setZones={setDrawnZonesSynced}
            entryZone={drawnEntryZone} setEntryZone={setDrawnEntryZoneSynced}
            exitZone={drawnExitZone}   setExitZone={setDrawnExitZoneSynced}
            disabled={processing}
          />
          {processing && (
            <div style={{ position:'absolute', inset:0, background:'rgba(10,14,20,0.75)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, zIndex:10, backdropFilter:'blur(2px)' }}>
              <div className="spinner" style={{ width:44, height:44, borderWidth:4 }}/>
              <div style={{ color:'#fff', fontWeight:700, fontSize:15 }}>Starting AI analysis…</div>
              <div style={{ color:'#93c5fd', fontSize:12 }}>Zones configured ✔ · Loading YOLOv8n model</div>
            </div>
          )}
        </div>
      )}

      {/* Starting */}
      {/* MJPEG Live Stream */}
      {(phase === 'streaming' || phase === 'done') && jobId && (
        <div>
          {/* Zone overlay canvas on top of MJPEG stream */}
          <div style={{ position:'relative', background:'#0a0e14', borderRadius:14, overflow:'hidden',
            border:`2px solid ${phase==='done'?'var(--green)':'var(--brand)'}` }}>
            {phase === 'streaming' ? (
              <>
                <img
                  src={`${API_BASE}/jobs/${jobId}/stream`}
                  alt="Live stream"
                  style={{ width:'100%', display:'block', minHeight:360 }}
                  onError={e => { e.target.style.opacity='0.3'; }}
                />
                {/* Zone polygon overlay */}
                <StreamZoneOverlay
                  zones={drawnZones}
                  entryZone={drawnEntryZone}
                  exitZone={drawnExitZone}
                />
              </>
            ) : (
              <div style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
                <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>Processing Complete!</div>
                <div style={{ color:'#94a3b8', fontSize:12, marginTop:6 }}>View full analytics in Jobs page</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                  <a href={`${API_BASE}/reports/${jobId}/pdf`} target="_blank" rel="noreferrer"
                    style={{ padding:'10px 16px', background:'#dc2626', color:'#fff', borderRadius:8, fontSize:13, fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>
                    📄 Download PDF Report
                  </a>
                  <a href={`${API_BASE}/reports/${jobId}/excel`} target="_blank" rel="noreferrer"
                    style={{ padding:'10px 16px', background:'#16a34a', color:'#fff', borderRadius:8, fontSize:13, fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>
                    📊 Download Excel Report
                  </a>
                </div>
              </div>
            )}

            {/* HUD overlay */}
            <div style={{ position:'absolute', top:10, left:10, display:'flex', gap:6 }}>
              <span style={TAG}>CAM-01 ◎ RETAIL</span>
              {phase === 'streaming' && (
                <span style={{...TAG, background:'rgba(22,163,74,.9)', display:'flex', alignItems:'center', gap:5}}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#fff', animation:'livePulse 1s infinite', display:'inline-block' }}/>
                  LIVE
                </span>
              )}
            </div>

            {/* Live footfall metrics — top right */}
            {phase === 'streaming' && liveMetrics && (
              <div style={{ position:'absolute', top:10, right:10, display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                <div style={{ display:'flex', gap:4 }}>
                  <span style={{...TAG, background:'rgba(22,163,74,.92)', fontSize:11, fontWeight:700}}>
                    🚶 {liveMetrics.entries ?? 0} Entries
                  </span>
                  <span style={{...TAG, background:'rgba(220,38,38,.92)', fontSize:11, fontWeight:700}}>
                    🚪 {liveMetrics.exits ?? 0} Exits
                  </span>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <span style={{...TAG, background:'rgba(99,102,241,.92)', fontSize:11, fontWeight:700}}>
                    👥 {liveMetrics.currently_inside ?? 0} Inside
                  </span>
                  <span style={{...TAG, background:'rgba(15,23,42,.88)', fontSize:11, fontWeight:700}}>
                    🆔 {liveMetrics.total_unique_people ?? 0} Unique
                  </span>
                </div>
                <span style={{...TAG, fontSize:9}}>{progress}% processed</span>
              </div>
            )}
            {phase === 'streaming' && !liveMetrics && (
              <div style={{ position:'absolute', top:10, right:10 }}>
                <span style={{...TAG, fontSize:10}}>{progress}% processed</span>
              </div>
            )}
          </div>

          {/* Progress bar + Edit Zones button */}
          {phase === 'streaming' && (
            <div style={{ marginTop:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>🧠 YOLOv8n processing…</span>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <button
                    onClick={() => setPhase('zone_edit_live')}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:7,
                      border:'1.5px solid var(--brand)', background:'var(--brand-light)', color:'var(--brand)',
                      fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    ✏️ Edit Zones
                  </button>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--brand)' }}>{progress}%</span>
                </div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width:`${progress}%` }}/>
              </div>

              {/* Live footfall counter strip */}
              {liveMetrics && (
                <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                  {[
                    { label:'Entries',        value: liveMetrics.entries        ?? 0, color:'#16a34a', icon:'🚶' },
                    { label:'Exits',          value: liveMetrics.exits          ?? 0, color:'#dc2626', icon:'🚪' },
                    { label:'Inside Now',     value: liveMetrics.currently_inside ?? 0, color:'#6366f1', icon:'👥' },
                    { label:'Unique People',  value: liveMetrics.total_unique_people ?? 0, color:'#0284c7', icon:'🆔' },
                    { label:'Shelf',          value: liveMetrics.shelf_status   ?? '—', color: liveMetrics.shelf_status === 'EMPTY' ? '#dc2626' : liveMetrics.shelf_status === 'LOW STOCK' ? '#d97706' : '#16a34a', icon:'📦' },
                  ].map(m => (
                    <div key={m.label} style={{ flex:1, minWidth:90, padding:'10px 12px', borderRadius:10,
                      background:'var(--white)', border:`1.5px solid ${m.color}30`,
                      borderTop:`3px solid ${m.color}`, textAlign:'center' }}>
                      <div style={{ fontSize:18, marginBottom:2 }}>{m.icon}</div>
                      <div style={{ fontSize:20, fontWeight:800, color:m.color, fontFamily:'var(--font-b)' }}>{m.value}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, marginTop:2 }}>{m.label}</div>
                    </div>
                  ))}
                  {liveMetrics.zones?.most_popular && (
                    <div style={{ flex:1, minWidth:90, padding:'10px 12px', borderRadius:10,
                      background:'var(--white)', border:'1.5px solid #a855f730',
                      borderTop:'3px solid #a855f7', textAlign:'center' }}>
                      <div style={{ fontSize:18, marginBottom:2 }}>🗺️</div>
                      <div style={{ fontSize:13, fontWeight:800, color:'#a855f7', fontFamily:'var(--font-b)' }}>
                        {liveMetrics.zones.most_popular || '—'}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, marginTop:2 }}>Top Zone</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* File info + reset */}
          <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
            background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
            <span style={{ fontSize:18 }}>🎬</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{fileName}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Job: {jobId?.slice(0,8)}… · {phase === 'done' ? '✅ Complete' : `⏳ ${progress}% done`}</div>
            </div>
            <button onClick={reset} style={{ padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text-secondary)' }}>
              🔄 New Video
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div style={{ padding:'20px 24px', background:'#fff5f5', border:'1px solid #fecaca', borderRadius:14 }}>
          <div style={{ fontWeight:700, color:'var(--red)', marginBottom:6 }}>❌ Upload / Processing Error</div>
          <div style={{ fontSize:13, color:'#7f1d1d', marginBottom:12 }}>{errMsg}</div>
          <button onClick={reset} className="btn btn-primary">Try Again</button>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".mp4,.avi,.mov,.mkv,.webm" style={{ display:'none' }}
        onChange={e => handleFile(e.target.files?.[0])}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ADAPT RETAIL BACKEND RESPONSE → PCB-style result
   /camera/inspect-image returns person detection;
   we map it to the PCB result shape so all existing
   UI (DefectExplainer, VideoHUD, store) works as-is.
═══════════════════════════════════════════════════ */
function _adaptRetailResponse(raw) {
  if (!raw) return null;
  const count   = raw.person_count || 0;
  const density = raw.density || 'LOW';
  const persons = raw.persons || [];

  // Map persons → defect-style objects so boxes render on canvas
  const defects = persons.map((p, i) => ({
    class_name:  'person',
    confidence:  p.confidence || 0.5,
    bbox:        p.bbox_pct || [0, 0, 10, 10],
    severity:    density === 'CRITICAL' ? 'CRITICAL' : density === 'HIGH' ? 'HIGH' : 'MEDIUM',
    zone:        p.zone || 'Store',
  }));

  const decision = density === 'CRITICAL' ? 'REJECT'
    : density === 'HIGH' ? 'FLAG_FOR_REVIEW'
    : count > 0 ? 'APPROVE' : 'APPROVE';

  return {
    board_id:         raw.frame_id || `FRAME-${Date.now().toString(36).toUpperCase()}`,
    decision,
    total_defects:    count,
    defects_found:    defects,
    inference_ms:     raw.infer_ms || 0,
    fps:              0,
    zone:             Object.keys(raw.zone_counts || {})[0] || 'Store',
    line_halt_required: density === 'CRITICAL',
    timestamp:        raw.timestamp || new Date().toISOString(),
    model_mode:       'retail-yolov8n',
    person_count:     count,
    density,
    zone_counts:      raw.zone_counts || {},
  };
}

const SOURCES = [
  { id:'simulation', label:'Simulation',    icon:'⚙',  color:'#0057ff' },
  { id:'webcam',     label:'Webcam',         icon:'📷', color:'#16a34a' },
  { id:'video',      label:'Video File',     icon:'🎬', color:'#7c3aed' },
  { id:'image',      label:'Image Upload',   icon:'🖼️', color:'#dc2626' },
  { id:'ip',         label:'Company Camera', icon:'📡', color:'#d97706' },
];

export default function PCBCanvas({ inspection, onSourceChange, zones, paused }) {
  // ── Global store: feed all results into app state ──
  const {
    addBoard, addAlert, addConsoleEntry, setSystemStatus, setCameraState,
    simRunning, startSim, stopSim,
  } = useAppStore(useShallow(s => ({
    addBoard:        s.addBoard,
    addAlert:        s.addAlert,
    addConsoleEntry: s.addConsoleEntry,
    setSystemStatus: s.setSystemStatus,
    setCameraState:  s.setCameraState,
    simRunning:      s.simRunning,
    startSim:        s.startSim,
    stopSim:         s.stopSim,
  })));

  // Stable ref so captureAndInfer always reads latest paused value (no stale closure)
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Video detections polling hook
  const { startPolling, stopPolling } = useVideoDetections();

  const [source,      setSource]      = useState('simulation');
  const [videoFile,   setVideoFile]   = useState(null);
  const [imageFile,   setImageFile]   = useState(null);
  const [imageUrl,    setImageUrl]    = useState('');
  const [imageResult, setImageResult] = useState(null);
  const [imageLoading,setImageLoading]= useState(false);
  const imageFileRef = useRef(null);
  const [videoUrl,    setVideoUrl]    = useState('');
  const [uploading,   setUploading]   = useState(false);
  const [uploadErr,   setUploadErr]   = useState('');
  const [ipInput,     setIpInput]     = useState('');
  const [ipUrl,       setIpUrl]       = useState('');
  const [camPaused,   setCamPaused]   = useState(false);  // Pause live camera
  const camPausedRef = useRef(false);
  const [result,      setResult]      = useState(null);
  const [processing,  setProcessing]  = useState(false);
  const [screenshots, setScreenshots] = useState([]);
  const [frameNo,     setFrameNo]     = useState(0);
  const [boardCount,  setBoardCount]  = useState(0);
  const [camReady,    setCamReady]    = useState(false);
  const [camErr,      setCamErr]      = useState('');
  const [liveFps,     setLiveFps]     = useState(0);
  const [confThresh,  setConfThresh]  = useState(0.40);
  const [camDevices,  setCamDevices]  = useState([]);   // available cameras
  const [selectedCam, setSelectedCam] = useState('');   // selected deviceId
  // Dataset capture state
  const [dsCapturing, setDsCapturing] = useState(false);
  const [dsLabel,     setDsLabel]     = useState('clean');
  const [dsBoard,     setDsBoard]     = useState('MRK_PCB');
  const [dsCompany,   setDsCompany]   = useState('MRK_Electronics');
  const [dsCaptured,  setDsCaptured]  = useState(0);
  const [dsTarget,    setDsTarget]    = useState(50);
  const dsTimerRef = useRef(null);
  const dsHashesRef = useRef([]);

  const videoRef   = useRef(null);
  const camRef     = useRef(null);
  const imgRef     = useRef(null);
  const captureRef = useRef(null);
  const fileRef    = useRef(null);
  const streamRef  = useRef(null);
  const timerRef   = useRef(null);
  const fpsRef     = useRef({ frames:0, start:Date.now() });
  const dedupRef   = useRef({});
  const lastResultRef = useRef(''); // Track last detection signature to skip duplicates
  const votingRef = useRef({ sig: '', count: 0 }); // Voting: 3 consecutive same detections required
  const prevFrameRef = useRef(null);  // Store previous frame data for duplicate detection
  // ✅ FIX: stable refs so captureAndInfer doesn't recreate on every frame
  const boardCountRef  = useRef(0);
  const frameNoRef     = useRef(0);
  const confThreshRef  = useRef(0.40);
  const processingRef  = useRef(false);

  /* Sync stable refs whenever state changes */
  useEffect(() => { boardCountRef.current  = boardCount;  }, [boardCount]);
  useEffect(() => { frameNoRef.current     = frameNo;     }, [frameNo]);
  useEffect(() => { confThreshRef.current  = confThresh;  }, [confThresh]);
  useEffect(() => { camPausedRef.current   = camPaused;   }, [camPaused]);

  /* Source change handler:
     - Switching TO video/webcam/ip → stop simulation completely + stop backend polling if switching away from video
     - Switching TO simulation     → notify parent (user must press Start) */
  useEffect(() => {
    if (source !== 'simulation') {
      // ✅ FIX: fully stop simulation when real source is active
      stopSim();
      setSystemStatus('IDLE');
      onSourceChange?.(true);
    } else {
      // Back to simulation — stop polling, notify parent
      stopPolling();
      setSystemStatus('IDLE');
      onSourceChange?.(false);
    }
  }, [source]);

  /* Webcam */
  // List available cameras — need permission first to get labels
  useEffect(() => {
    if (source !== 'webcam') return;
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(tempStream => {
        tempStream.getTracks().forEach(t => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCamDevices(videoDevices);
        // Auto-select: prefer iPhone/iPad (Continuity Camera) or USB/external, fallback to last
        const preferred =
          videoDevices.find(d => d.label && (d.label.toLowerCase().includes('iphone') || d.label.toLowerCase().includes('ipad'))) ||
          videoDevices.find(d => d.label && (d.label.toLowerCase().includes('usb') || d.label.toLowerCase().includes('micro') || d.label.toLowerCase().includes('uv') || d.label.toLowerCase().includes('hd') || d.label.toLowerCase().includes('webcam'))) ||
          (videoDevices.length > 1 ? videoDevices[videoDevices.length - 1] : videoDevices[0]);
        if (preferred) setSelectedCam(preferred.deviceId);
      })
      .catch(() => {});
  }, [source]);

  // Connect to selected camera
  useEffect(() => {
    if (source !== 'webcam') {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setCamReady(false); setCamErr('');
      return;
    }
    if (!selectedCam && camDevices.length === 0) {
      // No device selected yet — wait for enumeration
      return;
    }
    // Stop previous stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCamReady(false);

    const constraints = {
      video: {
        // Higher resolution for OAK-D / good cameras
        width: {ideal: 1920}, height: {ideal: 1080}, frameRate: {ideal: 30},
        ...(selectedCam ? { deviceId: selectedCam } : {}),
      }
    };
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        streamRef.current = stream;
        if (camRef.current) {
          camRef.current.srcObject = stream;
          camRef.current.onloadedmetadata = () => { camRef.current.play(); setCamReady(true); };
        }
      }).catch(e => {
        // If specific device fails, try without deviceId constraint
        if (selectedCam) {
          navigator.mediaDevices.getUserMedia({ video: { width:{ideal:1280}, height:{ideal:720} } })
            .then(stream => {
              streamRef.current = stream;
              if (camRef.current) {
                camRef.current.srcObject = stream;
                camRef.current.onloadedmetadata = () => { camRef.current.play(); setCamReady(true); };
              }
            }).catch(e2 => setCamErr(e2.message || 'Camera permission denied'));
        } else {
          setCamErr(e.message || 'Camera permission denied');
        }
      });
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [source, selectedCam]);

  /* Video file URL */
  useEffect(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (!videoFile) { setVideoUrl(''); return; }
    const u = URL.createObjectURL(videoFile);
    setVideoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [videoFile]);

  /* Capture frame → backend YOLOv11
     ✅ FIX: Uses stable refs (boardCountRef, frameNoRef, confThreshRef, processingRef)
     so the function is NOT recreated on every frame, preventing interval restart bug. */
  const captureAndInfer = useCallback(async () => {
    if (processingRef.current) return;
    if (camPausedRef.current) return;  // Skip when paused
    if (pausedRef.current) return;     // Skip when zone editor is open
    const cap = captureRef.current;
    if (!cap) return;
    const ctx = cap.getContext('2d');
    let W = 640, H = 480;
    const curFrameNo = frameNoRef.current;

    if (source === 'webcam' && camRef.current && camReady) {
      const v = camRef.current;
      if (v.readyState < 2) return;
      W = v.videoWidth||640; H = v.videoHeight||480;
      cap.width = W; cap.height = H;
      ctx.drawImage(v, 0, 0, W, H);
      frameNoRef.current += 1;
      setFrameNo(frameNoRef.current);
    } else if (source === 'video' && videoRef.current && videoUrl) {
      const v = videoRef.current;
      if (v.readyState < 2) return;
      W = v.videoWidth||640; H = v.videoHeight||480;
      cap.width = W; cap.height = H;
      ctx.drawImage(v, 0, 0, W, H);
      const fn = Math.round(v.currentTime * 25);
      frameNoRef.current = fn; setFrameNo(fn);
      // Check if video has finished playing (not just paused by us for inference)
      if (v.ended) {
        clearInterval(timerRef.current);
        setSystemStatus('IDLE');
        const ts = new Date().toLocaleTimeString('en-GB',{hour12:false});
        addConsoleEntry({ time:ts, tag:'INFO', tagClass:'INFO',
          msg:`[INFO] Video ended — ${boardCountRef.current} frames analyzed.` });
        return;
      }
    } else if (source === 'ip' && ipUrl) {
      // Fetch snapshot directly (avoids CORS/tainted canvas issues)
      try {
        const resp = await fetch(ipUrl.replace('/stream', '/snapshot'));
        if (!resp.ok) return;
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        W = bitmap.width; H = bitmap.height;
        cap.width = W; cap.height = H;
        ctx.drawImage(bitmap, 0, 0, W, H);
        bitmap.close();
        frameNoRef.current += 1;
        setFrameNo(frameNoRef.current);
      } catch(e) { return; }
    } else return;

    const blob = await new Promise(res => cap.toBlob(res, 'image/jpeg', 0.88));
    if (!blob) return;

    // ── Duplicate Frame Detection ───────────────────────────────────
    // Compare current frame with previous frame using pixel sampling.
    // If <5% pixels changed → skip (same board still under camera).
    // This saves backend compute and prevents duplicate detections.
    const sampleSize = 100; // Sample 100 pixels (fast, not full image)
    const imgData = ctx.getImageData(0, 0, W, H).data;
    const step = Math.max(1, Math.floor((W * H * 4) / sampleSize));
    const currentSample = [];
    for (let i = 0; i < imgData.length; i += step) {
      currentSample.push(imgData[i]); // R channel only (fast)
    }

    if (prevFrameRef.current && prevFrameRef.current.length === currentSample.length) {
      let diffCount = 0;
      for (let i = 0; i < currentSample.length; i++) {
        if (Math.abs(currentSample[i] - prevFrameRef.current[i]) > 25) diffCount++;
      }
      const diffPct = (diffCount / currentSample.length) * 100;
      if (diffPct < 5) {
        return;
      }
    }
    prevFrameRef.current = currentSample;
    // ── End Duplicate Check ───────────────────────────────────────

    fpsRef.current.frames++;
    const elapsed = (Date.now() - fpsRef.current.start) / 1000;
    if (elapsed >= 1) {
      setLiveFps(Math.round(fpsRef.current.frames / elapsed));
      fpsRef.current = { frames:0, start:Date.now() };
    }

    // Mark processing
    processingRef.current = true;
    setProcessing(true);
    // Freeze video during inference (playbackRate=0, not pause)
    if (source === 'video' && videoRef.current) videoRef.current.playbackRate = 0;
    // Keep previous boxes visible until new result arrives (no flicker)
    const curConf = confThreshRef.current;

    const _pushToStore = (data) => {
      data.source = source;
      const sig = (data.defects_found||[]).map(d => d.class_name).sort().join('|');

      // Update result + camera state always (for live display)
      setResult(data);
      setCameraState(data);

      // Skip console/alert/screenshot if exact same detection as last frame
      if (sig && sig === lastResultRef.current) return;
      lastResultRef.current = sig;

      setBoardCount(p => { boardCountRef.current = p+1; return p+1; });
      addBoard(data);
      setSystemStatus('RUNNING');

      const ts = new Date().toLocaleTimeString('en-GB', { hour12:false });
      const d0 = data.defects_found?.[0];
      const tc = { APPROVE:'APPROVE', REJECT:'REJECT', FLAG_FOR_REVIEW:'FLAG', PASS_WITH_LOG:'PASS' }[data.decision] || 'INFO';
      addConsoleEntry({ time:ts, tag:tc, tagClass:tc,
        msg: data.total_defects === 0
          ? `[INFO] ${data.board_id} | Frame #${curFrameNo} | No persons | ${data.inference_ms}ms`
          : `[${tc}] ${data.board_id} | Frame #${curFrameNo} | ${data.total_defects} person(s) | density:${data.density} | ${data.inference_ms}ms`,
      });

      if (data.decision === 'REJECT' || data.decision === 'FLAG_FOR_REVIEW') {
        const isCrit = data.decision === 'REJECT';
        addAlert({
          id: `ALT-${Date.now().toString(36).toUpperCase()}`,
          severity: isCrit ? 'CRITICAL' : 'HIGH',
          camera_id: 'CAM-01',
          decision: data.decision,
          message: `${isCrit?'🔴':'🟡'} ${data.board_id} | ${data.total_defects} person(s) | density: ${data.density}`,
          timestamp: new Date().toISOString(), read: false,
        });
      }

      if ((data.decision==='REJECT'||data.decision==='FLAG_FOR_REVIEW') && data.total_defects > 0) {
        const key = data.density || 'HIGH';
        const lastSeen = dedupRef.current[key] || 0;
        if (boardCountRef.current - lastSeen > 5) {
          dedupRef.current[key] = boardCountRef.current;
          cap.toBlob(ssBlob => {
            if (!ssBlob) return;
            const reader = new FileReader();
            reader.onload = () => setScreenshots(p => [...p.slice(-29), {
              dataUrl: reader.result, decision: data.decision,
              defects: data.defects_found, board_id: data.board_id,
              frame_no: curFrameNo, timestamp: new Date().toLocaleTimeString(),
              inference_ms: data.inference_ms,
            }]);
            reader.readAsDataURL(ssBlob);
          }, 'image/jpeg', 0.92);
        }
      }
    };

    try {
      const fd = new FormData();
      fd.append('file', blob, 'frame.jpg');
      const _token = localStorage.getItem('retail_token');
      const res = await fetch(
        `${API_BASE}/camera/inspect-image?conf=${curConf}`,
        {
          method:  'POST',
          body:    fd,
          headers: _token ? { Authorization: `Bearer ${_token}` } : {},
        }
      );
      if (res.ok) {
        _pushToStore(_adaptRetailResponse(await res.json()));
      } else if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('retail:unauthorized'));
        const ts = new Date().toLocaleTimeString('en-GB', { hour12:false });
        addConsoleEntry({ time:ts, tag:'ERROR', tagClass:'ERROR',
          msg:'[AUTH ERROR] Session expired — please log in again' });
      }
    } catch (err) {
      // Backend offline — show connection error in console, do NOT simulate fake data
      const ts = new Date().toLocaleTimeString('en-GB', { hour12:false });
      addConsoleEntry({
        time: ts, tag: 'ERROR', tagClass: 'ERROR',
        msg: `[ERROR] Backend unreachable — ${err.message || 'connection refused'}. Start backend: python main.py`,
      });
      setSystemStatus('ERROR');
    }
    processingRef.current = false;
    setProcessing(false);
    // Resume video speed after boxes drawn
    if (source === 'video' && videoRef.current && !videoRef.current.ended) videoRef.current.playbackRate = 1;
  }, [source, camReady, videoUrl, ipUrl]);  // ✅ stable — no boardCount/frameNo/confThresh

  useEffect(() => {
    if (source === 'simulation') { clearInterval(timerRef.current); return; }
    // All real sources (webcam/video/ip): capture frame every 1.5s and send to YOLO
    timerRef.current = setInterval(captureAndInfer, 1500);
    return () => clearInterval(timerRef.current);
  }, [source, captureAndInfer]);

  const downloadSS = (s) => {
    const a = document.createElement('a');
    a.href = s.dataUrl;
    a.download = `pcb-${s.board_id}-${s.decision}-${s.timestamp?.replace(/:/g,'-')}.jpg`;
    a.click();
  };

  const takeManualSS = () => {
    const c = captureRef.current;
    if (!c || source==='simulation') return;
    c.toBlob(blob => {
      if (!blob) return;
      const r = new FileReader();
      r.onload = () => {
        const ss = { dataUrl:r.result, decision:result?.decision||'MANUAL', defects:result?.defects_found||[], board_id:result?.board_id||'MANUAL', timestamp:new Date().toLocaleTimeString() };
        setScreenshots(p => [...p.slice(-29), ss]);
        downloadSS(ss);
      };
      r.readAsDataURL(blob);
    }, 'image/jpeg', 0.95);
  };

  // Dataset capture functions
  const simpleHash = (canvas) => {
    const ctx = canvas.getContext('2d');
    const small = document.createElement('canvas');
    small.width = 16; small.height = 16;
    small.getContext('2d').drawImage(canvas, 0, 0, 16, 16);
    const data = small.getContext('2d').getImageData(0,0,16,16).data;
    const avg = Array.from(data).filter((_,i)=>i%4===0).reduce((a,b)=>a+b,0) / 256;
    return Array.from(data).filter((_,i)=>i%4===0).map(px => px > avg ? '1' : '0').join('');
  };

  const startDatasetCapture = () => {
    setDsCapturing(true);
    setDsCaptured(0);
    dsHashesRef.current = [];
    dsTimerRef.current = setInterval(() => {
      const cap = captureRef.current;
      if (!cap || cap.width === 0) return;
      const hash = simpleHash(cap);
      const isDup = dsHashesRef.current.some(h => {
        let diff = 0;
        for(let i=0;i<h.length;i++) if(h[i]!==hash[i]) diff++;
        return diff < 30;
      });
      if (isDup) return;
      dsHashesRef.current.push(hash);
      cap.toBlob(blob => {
        if (!blob) return;
        const fd = new FormData();
        fd.append('file', blob, 'frame.jpg');
        const token = localStorage.getItem('retail_token');
        fetch(`${API_BASE}/camera/inspect-image?conf=0.40`, {
          method: 'POST', body: fd,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then(r=>r.json()).then(d => {
          if(d.person_count !== undefined) setDsCaptured(p => {
            const next = p + 1;
            if(next >= dsTarget) stopDatasetCapture();
            return next;
          });
        }).catch(()=>{});
      }, 'image/jpeg', 0.92);
    }, 2000);
  };

  const stopDatasetCapture = () => {
    clearInterval(dsTimerRef.current);
    setDsCapturing(false);
  };

  const displayResult = source==='simulation' ? (simRunning ? inspection : null) : result;

  return (
    <div>
      {/* ── Source Tabs ── */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {SOURCES.map(s => (
          <button key={s.id} onClick={() => { setSource(s.id); setResult(null); setBoardCount(0); }} style={{
            display:'flex', alignItems:'center', gap:7, padding:'8px 15px', borderRadius:10,
            cursor:'pointer', fontFamily:'var(--font-b)', fontSize:13, fontWeight:600, transition:'all .15s',
            border: source===s.id?`2px solid ${s.color}`:'1.5px solid var(--border)',
            background: source===s.id?`${s.color}12`:'#fff',
            color: source===s.id?s.color:'var(--text-secondary)',
            boxShadow: source===s.id?`0 0 0 3px ${s.color}18`:'none',
          }}>
            <span style={{ fontSize:16 }}>{s.icon}</span>
            {s.label}
            {source===s.id && <span style={{ width:7, height:7, borderRadius:'50%', background:s.color, marginLeft:2, animation:'livePulse 1.5s infinite', display:'inline-block' }}/>}
          </button>
        ))}

        {/* Confidence slider */}
        {source !== 'simulation' && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 12px' }}>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, whiteSpace:'nowrap' }}>conf={confThresh.toFixed(2)}</span>
            <input type="range" min="10" max="95" value={Math.round(confThresh*100)} onChange={e=>setConfThresh(parseInt(e.target.value)/100)}
              style={{ width:80 }}/>
            <span style={{ fontSize:10, color:'var(--text-muted)' }}>0.10–0.95</span>
          </div>
        )}

        {source !== 'simulation' && processing && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:'var(--brand-light)', borderRadius:8, fontSize:11, color:'var(--brand)', fontWeight:600 }}>
            <div className="spinner" style={{width:12,height:12}}/> Inferring…
          </div>
        )}
        {source !== 'simulation' && boardCount > 0 && (
          <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-m)' }}>
            {boardCount} frames · {liveFps} FPS
          </span>
        )}
      </div>

      {/* ── SIMULATION ── */}
      {source === 'simulation' && (
        <div style={{ position:'relative' }}>
          <RetailStoreBoard
            inspection={paused ? null : (simRunning ? inspection : null)}
            simRunning={simRunning && !paused}
            onStartSim={startSim}
            onStopSim={stopSim}
            zones={zones}
          />
          {paused && (
            <div style={{ position:'absolute', inset:0, background:'rgba(10,14,20,0.72)', borderRadius:14, zIndex:10,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, backdropFilter:'blur(2px)' }}>
              <div style={{ fontSize:36 }}>⏸</div>
              <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>Simulation paused</div>
              <div style={{ color:'rgba(255,255,255,.6)', fontSize:12 }}>Close zone editor to resume</div>
            </div>
          )}
        </div>
      )}

      {/* ── WEBCAM ── */}
      {source === 'webcam' && (
        <div>
          {/* Camera selector */}
          <div style={{ marginBottom:10, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)' }}>📷 Camera:</span>
            <select value={selectedCam} onChange={e => setSelectedCam(e.target.value)}
              style={{ flex:1, minWidth:200, maxWidth:380, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, fontFamily:'var(--font-m)', cursor:'pointer' }}>
              {camDevices.length === 0 && <option value="">Detecting cameras…</option>}
              {camDevices.map((d, i) => {
                const lbl = d.label || `Camera ${i+1}`;
                const tag = lbl.toLowerCase().includes('iphone') || lbl.toLowerCase().includes('ipad') ? ' 📱 iPhone/iPad'
                  : lbl.toLowerCase().includes('facetime') ? ' 💻 Laptop'
                  : lbl.toLowerCase().includes('usb') || lbl.toLowerCase().includes('webcam') ? ' 📷 USB Webcam'
                  : lbl.toLowerCase().includes('oak') || lbl.toLowerCase().includes('luxonis') ? ' 🟣 OAK-D'
                  : '';
                return <option key={d.deviceId} value={d.deviceId}>{lbl}{tag}</option>;
              })}
            </select>
            <button onClick={() => {
              navigator.mediaDevices.getUserMedia({ video: true })
                .then(s => { s.getTracks().forEach(t => t.stop()); return navigator.mediaDevices.enumerateDevices(); })
                .then(devs => {
                  const vd = devs.filter(d => d.kind === 'videoinput');
                  setCamDevices(vd);
                  // Auto-select iPhone first, then USB, then last device
                  const preferred =
                    vd.find(d => d.label && (d.label.toLowerCase().includes('iphone') || d.label.toLowerCase().includes('ipad'))) ||
                    vd.find(d => d.label && (d.label.toLowerCase().includes('usb') || d.label.toLowerCase().includes('webcam'))) ||
                    (vd.length > 0 ? vd[vd.length - 1] : null);
                  if (preferred) setSelectedCam(preferred.deviceId);
                }).catch(() => {});
            }} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text-secondary)' }}>
              🔄 Refresh
            </button>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{camDevices.length} camera{camDevices.length!==1?'s':''} found</span>
          </div>

          {/* iPhone guide banner */}
          <div style={{ marginBottom:10, padding:'10px 14px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, fontSize:12 }}>
            <div style={{ fontWeight:700, color:'#1d4ed8', marginBottom:4 }}>📱 iPhone ko Webcam ki tarah use karna hai?</div>
            <div style={{ color:'#1e40af', lineHeight:1.7 }}>
              <strong>Step 1:</strong> iPhone aur Mac/PC ek hi WiFi pe hone chahiye<br/>
              <strong>Step 2:</strong> iPhone mein <strong>Settings → General → AirPlay &amp; Handoff → Continuity Camera</strong> ON karo<br/>
              <strong>Step 3:</strong> iPhone ko Mac ke paas rakho — automatically detect ho jaayega<br/>
              <strong>Step 4:</strong> Upar dropdown mein <strong>"📱 iPhone"</strong> select karo → 🔄 Refresh dabao
            </div>
          </div>

          {/* Video feed */}
          <div style={{ position:'relative', width:'100%', height:420, background:'#0a0e14', borderRadius:14, overflow:'hidden', border:'2px solid var(--border)' }}>
            {camErr ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:10, color:'var(--amber)', textAlign:'center', padding:24 }}>
                <div style={{ fontSize:40 }}>📷</div>
                <div style={{ fontWeight:700 }}>Camera Permission Required</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{camErr}</div>
                <div style={{ fontSize:11 }}>Browser Settings → Allow Camera → Refresh page</div>
              </div>
            ) : (
              <video ref={camRef} muted playsInline autoPlay style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', objectFit:'contain', display:'block', filter: paused ? 'brightness(0.35)' : 'none', transition:'filter .3s' }}/>
            )}
            {paused && (
              <div style={{ position:'absolute', inset:0, zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, pointerEvents:'none' }}>
                <div style={{ fontSize:36 }}>⏸</div>
                <div style={{ color:'#fff', fontWeight:700, fontSize:14, textShadow:'0 1px 4px #000' }}>Live feed paused</div>
                <div style={{ color:'rgba(255,255,255,.6)', fontSize:12, textShadow:'0 1px 4px #000' }}>Close zone editor to resume</div>
              </div>
            )}
            <VideoOverlay result={paused ? null : result} videoEl={camRef} processing={processing}/>
            <VideoHUD label="📷 WEBCAM LIVE" result={paused ? null : result} processing={processing} frameNo={frameNo} fps={liveFps} confThresh={confThresh}/>
          </div>
        </div>
      )}

      {/* ── VIDEO FILE ── */}
      {source === 'video' && (
        <VideoUploadStream
          addConsoleEntry={addConsoleEntry}
          zones={zones}
          setSystemStatus={setSystemStatus}
          confThresh={confThresh}
        />
      )}

      {/* ── IP CAMERA ── */}
      {source === 'ip' && (
        <div>
          <div style={{ position:'relative', aspectRatio:'16/9', background:'#0a0e14', borderRadius:14, overflow:'hidden', border:`2px solid ${ipUrl?DEC_COLOR[result?.decision]||'var(--amber)':'var(--border)'}` }}>
            {ipUrl ? (
              <img ref={imgRef} src={ipUrl} alt="IP Camera" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:10, color:'var(--text-muted)' }}>
                <div style={{ fontSize:48, opacity:.3 }}>📡</div>
                <div style={{ fontSize:13, fontWeight:600 }}>Enter factory camera URL below</div>
                <div style={{ fontSize:11, opacity:.6 }}>HTTP MJPEG / Snapshot stream</div>
              </div>
            )}
            <VideoOverlay result={result} videoEl={imgRef} processing={processing}/>
            <VideoHUD label="📡 IP CAMERA" result={result} processing={processing} frameNo={frameNo} fps={liveFps} confThresh={confThresh}/>
          </div>
          <div style={{ marginTop:8, display:'flex', gap:8 }}>
            <input className="form-input" value={ipInput} onChange={e=>setIpInput(e.target.value)}
              placeholder="http://192.168.1.100:8080/shot.jpg" style={{ flex:1, fontFamily:'var(--font-m)', fontSize:12 }}
              onKeyDown={e=>e.key==='Enter'&&setIpUrl(ipInput.trim())}/>
            <button className="btn btn-primary" onClick={()=>setIpUrl(ipInput.trim())}>Connect</button>
            {ipUrl && <button className="btn btn-secondary" onClick={()=>{setIpUrl('');setResult(null);}}>Disconnect</button>}
            {ipUrl && (
              <button onClick={()=>setCamPaused(p=>!p)} style={{ padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700, background:camPaused?'var(--green)':'var(--amber)', color:'#fff', border:'none' }}>
                {camPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
            )}
          </div>
          {ipUrl && (
            <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:camPaused?'var(--amber)':'var(--green)', animation:camPaused?'none':'livePulse 1s infinite', display:'inline-block' }}/>
              <span style={{ fontSize:12, color:camPaused?'var(--amber)':'var(--green)', fontWeight:600 }}>{camPaused ? '⏸ Paused — detection stopped' : `Connected: ${ipUrl}`}</span>
            </div>
          )}
        </div>
      )}

      {/* ── IMAGE UPLOAD ── */}
      {source === 'image' && (
        <div>
          {!imageUrl ? (
            <div onClick={() => imageFileRef.current?.click()}
              style={{ aspectRatio:'4/3', background:'#0a0e14', borderRadius:14, border:'2px dashed var(--border)',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:14, cursor:'pointer', color:'var(--text-muted)' }}>
              <div style={{ fontSize:52, opacity:.3 }}>🖼️</div>
              <div style={{ fontSize:14, fontWeight:600 }}>Click to upload PCB image</div>
              <div style={{ fontSize:11, opacity:.6 }}>JPG, PNG, BMP — YOLO will detect defects</div>
              <button className="btn btn-primary" onClick={e=>{e.stopPropagation();imageFileRef.current?.click();}}>📁 Choose Image</button>
            </div>
          ) : (
            <div style={{ position:'relative', background:'#0a0e14', borderRadius:14, overflow:'hidden', border:`2px solid ${imageResult?.decision==='REJECT'?'var(--red)':imageResult?.decision==='FLAG_FOR_REVIEW'?'var(--amber)':'var(--border)'}` }}>
              <img src={imageUrl} alt="PCB" style={{ width:'100%', display:'block' }}/>
              {/* Overlay boxes */}
              {imageResult?.defects_found?.length > 0 && (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none"
                  style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none' }}>
                  {imageResult.defects_found.map((d, i) => {
                    const color = CLASS_COLORS[d.class_name] || '#fff';
                    return (
                      <g key={i}>
                        <rect x={d.bbox[0]} y={d.bbox[1]} width={d.bbox[2]-d.bbox[0]} height={d.bbox[3]-d.bbox[1]}
                          fill={`${color}20`} stroke={color} strokeWidth="0.8" rx="0.5"/>
                        <rect x={d.bbox[0]} y={Math.max(d.bbox[1]-5,0)} width={Math.max((d.class_name.length*1.8)+8,20)} height={5} fill={color}/>
                        <text x={d.bbox[0]+1} y={Math.max(d.bbox[1]-0.5,4.5)} fontSize="2.8" fill="#fff" fontWeight="bold" fontFamily="monospace">
                          {d.class_name.replace(/_/g,' ')} {Math.round(d.confidence*100)}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
              {/* HUD */}
              <div style={{ position:'absolute', top:8, left:8, display:'flex', gap:6 }}>
                <span style={{ background:'rgba(0,0,0,.8)', borderRadius:4, padding:'3px 8px', fontSize:10, fontFamily:'var(--font-m)', color:'#fff' }}>
                  🖼️ IMAGE
                </span>
                {imageLoading && <span style={{ background:'rgba(0,87,255,.9)', borderRadius:4, padding:'3px 8px', fontSize:10, color:'#fff', display:'flex', alignItems:'center', gap:4 }}><span className="spinner" style={{width:8,height:8,borderWidth:1.5}}/>YOLOv11</span>}
              </div>
              {imageResult?.decision && (
                <div style={{ position:'absolute', top:8, right:8, padding:'4px 10px', borderRadius:4, fontSize:11, fontWeight:700, color:'#fff',
                  background: imageResult.decision==='REJECT'?'rgba(220,38,38,.95)':imageResult.decision==='FLAG_FOR_REVIEW'?'rgba(217,119,6,.92)':'rgba(22,163,74,.93)' }}>
                  {imageResult.decision==='REJECT'?'⊘ REJECT':imageResult.decision==='FLAG_FOR_REVIEW'?'⚠ FLAG':'✓ APPROVE'}
                </div>
              )}
              {/* Bottom info */}
              {imageResult && (
                <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,.75)', padding:'6px 10px', display:'flex', justifyContent:'space-between', fontSize:10, fontFamily:'var(--font-m)', color:'#fff' }}>
                  <span>{imageResult.board_id} · {imageResult.inference_ms}ms</span>
                  <span style={{ color: imageResult.total_defects>0?'#fca5a5':'#86efac' }}>
                    {imageResult.total_defects > 0 ? `⚠ ${imageResult.total_defects} defect${imageResult.total_defects>1?'s':''}` : '✓ Clean'}
                  </span>
                </div>
              )}
            </div>
          )}
          <input ref={imageFileRef} type="file" accept="image/*" style={{ display:'none' }}
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImageFile(file);
              setImageResult(null);
              const url = URL.createObjectURL(file);
              setImageUrl(url);
              // Send to YOLO
              setImageLoading(true);
              try {
                const fd = new FormData();
                fd.append('file', file, file.name);
                const _token = localStorage.getItem('retail_token');
                const res = await fetch(
                  `${API_BASE}/camera/inspect-image?conf=${confThresh}`,
                  { method:'POST', body:fd, headers: _token ? { Authorization: `Bearer ${_token}` } : {} }
                );
                if (res.ok) {
                  const data = _adaptRetailResponse(await res.json());
                  setImageResult(data);
                  addBoard(data);
                  setCameraState(data);
                  const ts = new Date().toLocaleTimeString('en-GB',{hour12:false});
                  const d0 = data.defects_found?.[0];
                  const tc = {APPROVE:'APPROVE',REJECT:'REJECT',FLAG_FOR_REVIEW:'FLAG',PASS_WITH_LOG:'PASS'}[data.decision]||'INFO';
                  addConsoleEntry({ time:ts, tag:tc, tagClass:tc,
                    msg: data.total_defects===0
                      ? `[INFO] ${data.board_id} | IMAGE | CLEAN | ${data.inference_ms}ms`
                      : `[${tc}] ${data.board_id} | IMAGE | ${d0?.class_name} ${(d0?.confidence*100).toFixed(0)}% | ${data.inference_ms}ms`
                  });
                }
              } catch(err) {
                addConsoleEntry({ time:new Date().toLocaleTimeString('en-GB',{hour12:false}), tag:'ERROR', tagClass:'ERROR',
                  msg:`[ERROR] Image inference failed: ${err.message}` });
              }
              setImageLoading(false);
            }}/>
          {imageUrl && (
            <div style={{ marginTop:8, display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ padding:'6px 12px', background:'#fff5f5', border:'1px solid #fecaca', borderRadius:8, display:'flex', alignItems:'center', gap:8, flex:1 }}>
                <span>🖼️</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--red)' }}>{imageFile?.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{((imageFile?.size||0)/1024).toFixed(0)}KB</div>
                </div>
                <button onClick={()=>{setImageFile(null);setImageUrl('');setImageResult(null);}} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:18 }}>×</button>
              </div>
              <button className="btn btn-primary" onClick={() => imageFileRef.current?.click()}>Upload New</button>
            </div>
          )}
        </div>
      )}

      {/* Hidden capture canvas */}
      <canvas ref={captureRef} style={{ display:'none' }}/>

      {/* Dataset Capture Controls */}
      {source !== 'simulation' && (
        <div style={{ marginTop:14, padding:'14px 18px', background:dsCapturing?'#f0fdf4':'#f8fafc', border:`1.5px solid ${dsCapturing?'#bbf7d0':'var(--border)'}`, borderRadius:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:dsCapturing?10:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:16 }}>{dsCapturing?'\uD83D\uDD34':'\uD83D\uDCF7'}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:dsCapturing?'#166534':'var(--text-primary)' }}>
                  {dsCapturing ? `Capturing... ${dsCaptured}/${dsTarget}` : 'Dataset Capture'}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {dsCapturing ? 'Auto-saving unique frames — move board for variety' : 'Save frames from active camera to training dataset'}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {!dsCapturing && (
                <>
                  <select value={dsLabel} onChange={e=>setDsLabel(e.target.value)} style={{ padding:'6px 10px', borderRadius:6, border:'1px solid var(--border)', fontSize:11, cursor:'pointer' }}>
                    <option value="all_boards">All Boards (Single Folder)</option>
                    <option value="clean">Clean (No Defect)</option>
                    <option value="angle_top">Top View (0°)</option>
                    <option value="angle_left">Left Angle (15°)</option>
                    <option value="angle_right">Right Angle (15°)</option>
                    <option value="angle_front">Front Angle (15°)</option>
                    <option value="angle_back">Back Angle (15°)</option>
                    <option value="to_label">Has Defects (Label Later)</option>
                    <option value="short">Short Circuit Only</option>
                    <option value="open_circuit">Open Circuit Only</option>
                    <option value="mouse_bite">Mouse Bite Only</option>
                    <option value="spur">Spur Only</option>
                    <option value="spurious_copper">Spurious Copper Only</option>
                    <option value="missing_hole">Missing Hole Only</option>
                    <option value="multiple_defects">Multiple Defects (Label Later)</option>
                  </select>
                  <input value={dsBoard} onChange={e=>setDsBoard(e.target.value)} placeholder="Board name" style={{ width:80, padding:'6px 10px', borderRadius:6, border:'1px solid var(--border)', fontSize:11 }}/>
                  <input type="number" value={dsTarget} onChange={e=>setDsTarget(parseInt(e.target.value)||50)} min="5" max="500" style={{ width:50, padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', fontSize:11 }}/>
                  <button onClick={startDatasetCapture} style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700, background:'var(--brand)', color:'#fff', border:'none' }}>\u25B6 Start</button>
                </>
              )}
              {dsCapturing && (
                <button onClick={stopDatasetCapture} style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700, background:'var(--red)', color:'#fff', border:'none' }}>\u23F9 Stop</button>
              )}
            </div>
          </div>
          {dsCapturing && (
            <div style={{ height:6, background:'#dcfce7', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'#16a34a', borderRadius:3, width:`${Math.min(dsCaptured/dsTarget*100,100)}%`, transition:'width .5s' }}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
