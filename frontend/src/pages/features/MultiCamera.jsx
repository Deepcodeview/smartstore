/* pages/features/MultiCamera.jsx — Real multi-camera grid using live API */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import useAppStore from '../../store/appStore';
const API_BASE = 'http://localhost:8000';

const SEV_COLOR = { CRITICAL:'#dc2626', HIGH:'#d97706', MEDIUM:'#7c3aed', LOW:'#0284c7' };

function CameraFeed({ camNum, company, active }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const timerRef    = useRef(null);
  const [result, setResult]   = useState(null);
  const [status, setStatus]   = useState('idle');
  const [camReady, setCamReady] = useState(false);

  const plan = company?.plan?.toLowerCase() || 'starter';
  const maxCams = plan === 'enterprise' ? 8 : plan === 'pro' ? 6 : 2;
  const locked  = camNum > maxCams;

  const startCam = useCallback(async () => {
    if (locked) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width:640, height:480 } });
      if (videoRef.current) { videoRef.current.srcObject = stream; setCamReady(true); setStatus('running'); }
    } catch (e) {
      setStatus('error: ' + e.message);
    }
  }, [locked]);

  const stopCam = useCallback(() => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    clearInterval(timerRef.current);
    setCamReady(false);
    setStatus('idle');
    setResult(null);
  }, []);

  const captureAndInfer = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !camReady) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    canvas.width  = videoRef.current.videoWidth  || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const fd = new FormData();
      fd.append('file', blob, 'frame.jpg');
      try {
        const res = await fetch(`${API_BASE}/inspect/frame`, { method:'POST', body:fd });
        if (res.ok) setResult(await res.json());
      } catch (_) {}
    }, 'image/jpeg', 0.88);
  }, [camReady]);

  useEffect(() => {
    if (camReady && active) {
      timerRef.current = setInterval(captureAndInfer, 2000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [camReady, active, captureAndInfer]);

  const decColor = result?.decision === 'REJECT' ? '#dc2626' : result?.decision === 'FLAG_FOR_REVIEW' ? '#d97706' : result?.decision === 'APPROVE' ? '#16a34a' : '#64748b';

  if (locked) {
    return (
      <div style={{ background:'#f8fafc', border:'2px dashed #e2e8f0', borderRadius:12, aspectRatio:'4/3',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
        <span style={{ fontSize:28 }}>🔒</span>
        <div style={{ fontSize:12, color:'#94a3b8', fontWeight:600 }}>CAM-{String(camNum).padStart(2,'0')}</div>
        <div style={{ fontSize:11, color:'#94a3b8' }}>Upgrade to {camNum <= 6 ? 'Pro' : 'Enterprise'}</div>
      </div>
    );
  }

  return (
    <div style={{ background:'#0a0e14', borderRadius:12, overflow:'hidden', border:`2px solid ${decColor}`, position:'relative' }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ width:'100%', display:'block', aspectRatio:'4/3', objectFit:'cover' }} />
      <canvas ref={canvasRef} style={{ display:'none' }} />

      {/* HUD overlay */}
      <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, pointerEvents:'none' }}>
        {/* Top bar */}
        <div style={{ padding:'6px 10px', background:'rgba(0,0,0,.7)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:'#fff', fontSize:10, fontWeight:700, fontFamily:'JetBrains Mono,monospace' }}>CAM-{String(camNum).padStart(2,'0')}</span>
          <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4,
            background: status==='running' ? '#16a34a' : '#dc2626', color:'#fff' }}>
            {status.toUpperCase()}
          </span>
        </div>
        {/* Decision badge */}
        {result?.decision && (
          <div style={{ position:'absolute', bottom:36, left:8, padding:'3px 8px', borderRadius:6,
            background: decColor + 'cc', color:'#fff', fontSize:10, fontWeight:700 }}>
            {(result.decision||"").replace('_',' ')} · {result.total_defects} defects · {result.inference_ms}ms
          </div>
        )}
        {/* Controls */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'6px 8px',
          background:'rgba(0,0,0,.7)', display:'flex', gap:6, pointerEvents:'all' }}>
          {!camReady ? (
            <button onClick={startCam} style={{ flex:1, padding:'5px', background:'#0057ff', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700 }}>
              ▶ Start
            </button>
          ) : (
            <button onClick={stopCam} style={{ flex:1, padding:'5px', background:'#dc2626', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700 }}>
              ■ Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MultiCamera() {
  const company = useAppStore(s => s.company);
  const plan    = company?.plan?.toLowerCase() || 'starter';
  const maxCams = plan === 'enterprise' ? 8 : plan === 'pro' ? 6 : 2;
  const [gridSize, setGridSize] = useState(Math.min(4, maxCams));
  const [active,   setActive]   = useState(false);

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, margin:0 }}>Multi-Camera Grid</h2>
          <p style={{ fontSize:12, color:'#94a3b8', margin:'4px 0 0' }}>
            Real webcam feeds · YOLO inference per camera · Plan: {plan} (max {maxCams} cameras)
          </p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {[2,4,6,8].filter(n => n <= maxCams).map(n => (
            <button key={n} onClick={() => setGridSize(n)} style={{
              padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600,
              background: gridSize===n ? '#0057ff' : '#f1f5f9',
              color:       gridSize===n ? '#fff' : '#374151', border:'none',
            }}>{n} Cam</button>
          ))}
          <button onClick={() => setActive(p => !p)} style={{
            padding:'8px 18px', background: active ? '#dc2626' : '#16a34a', color:'#fff',
            border:'none', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13,
          }}>{active ? '■ Stop All' : '▶ Start All'}</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(gridSize, 4)}, 1fr)`, gap:12 }}>
        {Array.from({ length: gridSize }, (_, i) => (
          <CameraFeed key={i+1} camNum={i+1} company={company} active={active} />
        ))}
      </div>

      {maxCams < 8 && (
        <div style={{ marginTop:16, padding:'12px 16px', background:'#f5f3ff', border:'1px solid rgba(124,58,237,.2)', borderRadius:10, fontSize:13, color:'#7c3aed' }}>
          🔒 Upgrade to Enterprise for up to 8 simultaneous cameras
        </div>
      )}
    </div>
  );
}
