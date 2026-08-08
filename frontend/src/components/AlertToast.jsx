/**
 * AlertToast.jsx — Descriptive alerts with fix suggestions
 * CRITICAL → stays forever, manual dismiss
 * HIGH     → 10s auto-dismiss
 * MEDIUM   → 5s auto-dismiss
 * Each alert shows: what happened, why, suggested fix
 */
import React, { useEffect, useRef, useState } from 'react';
import useAppStore from '../store/appStore';

const SEV = {
  CRITICAL: { bg:'#fef2f2', border:'#dc2626', text:'#dc2626', emoji:'🔴', auto:null,  label:'CRITICAL' },
  HIGH:     { bg:'#fffbeb', border:'#d97706', text:'#d97706', emoji:'🟡', auto:10000, label:'HIGH'     },
  MEDIUM:   { bg:'#eff6ff', border:'#2563eb', text:'#2563eb', emoji:'🔵', auto:5000,  label:'MEDIUM'   },
};

// What to do when each defect is found
const FIX_GUIDE = {
  short:           { cause:'Solder paste bridging between adjacent pads', fix:'Check stencil cycle count (>5000? Replace immediately). Reduce print speed 10%. Run SPI inspection.' },
  open_circuit:    { cause:'Copper trace over-etched or mechanically broken', fix:'Check etchant concentration — target 1.25 SG. Reduce dwell time 8%. Inspect affected trace zone.' },
  missing_hole:    { cause:'Drill bit worn or CAM file coordinate error', fix:'Replace drill bit (check hit count vs limit). Verify CAM file. Recalibrate spindle.' },
  spurious_copper: { cause:'UV resist underexposed — copper not fully removed', fix:'Replace UV lamp if <80% intensity. Refresh developer solution. Increase exposure time 15%.' },
  mouse_bite:      { cause:'Uneven etchant at board edges — nozzle clogged', fix:'Clean etch tank nozzle #3. Increase edge agitation. Verify 8-mil edge clearance.' },
  spur:            { cause:'Incomplete etching at trace corner angles', fix:'Increase UV exposure 10%. Check developer concentration (target 45g/L).' },
};

export default function AlertToast() {
  const alerts  = useAppStore(s => s.alerts);
  const prevLen = useRef(0);
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);
  const [queue,   setQueue]   = useState([]);
  const timerRef = useRef(null);

  const showNext = (q) => {
    if (q.length === 0) { setVisible(false); return; }
    const next = q[0];
    const sty  = SEV[next.severity];
    if (!sty) return;
    setCurrent(next);
    setVisible(true);
    clearTimeout(timerRef.current);
    if (sty.auto) {
      timerRef.current = setTimeout(() => {
        setQueue(prev => { const rest = prev.slice(1); showNext(rest); return rest; });
      }, sty.auto);
    }
  };

  useEffect(() => {
    if (alerts.length > prevLen.current) {
      const newest = alerts[alerts.length - 1];
      if (!newest.read && SEV[newest.severity]) {
        setQueue(prev => {
          const updated = [...prev, newest];
          if (!visible) showNext(updated);
          return updated;
        });
      }
    }
    prevLen.current = alerts.length;
  }, [alerts]);

  const dismiss = () => {
    clearTimeout(timerRef.current);
    setQueue(prev => { const rest = prev.slice(1); showNext(rest); return rest; });
  };

  if (!visible || !current) return null;
  const sty   = SEV[current.severity] || SEV.MEDIUM;
  const d     = current.defect_name;
  const guide = FIX_GUIDE[d] || { cause:'Defect detected on PCB board', fix:'Inspect board and review production parameters' };
  const ts    = new Date(current.timestamp).toLocaleTimeString('en-GB',{hour12:false});

  return (
    <div style={{
      position:'fixed', bottom:24, right:24, zIndex:9999,
      background:sty.bg, border:`2px solid ${sty.border}`,
      borderRadius:14, padding:'16px 18px', maxWidth:400, width:'100%',
      boxShadow:'0 8px 30px rgba(0,0,0,.15)',
      display:'flex', flexDirection:'column', gap:10,
      animation:'pageIn .25s ease',
    }}>
      {/* Header row */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <span style={{ fontSize:22, flexShrink:0 }}>{sty.emoji}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
            <span style={{ fontWeight:800, fontSize:11, color:sty.text, letterSpacing:'.5px', textTransform:'uppercase' }}>
              {sty.label} DEFECT ALERT
            </span>
            <span style={{ fontFamily:'var(--font-m)', fontSize:10, color:'#94a3b8' }}>{ts}</span>
          </div>
          <div style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:2 }}>
            {(d||'unknown').replace(/_/g,' ').toUpperCase()} detected on {current.board_id}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:4 }}>
            {(current.channels||[]).map(ch => (
              <span key={ch} style={{ fontSize:10, background:'rgba(0,0,0,.06)', padding:'2px 7px', borderRadius:4, color:'var(--text-secondary)', fontWeight:600 }}>
                {ch==='slack'?'💬 Slack':ch==='email'?'📧 Email':'📱 SMS'}
              </span>
            ))}
            {current.line_halted && (
              <span style={{ fontSize:10, background:'#fef2f2', border:'1px solid #fecaca', padding:'2px 7px', borderRadius:4, color:'#dc2626', fontWeight:700 }}>
                ⊘ Line Halted
              </span>
            )}
            {sty.auto && <span style={{ fontSize:10, color:'#94a3b8' }}>Auto-dismiss {sty.auto/1000}s</span>}
          </div>
        </div>
        <button onClick={dismiss} style={{ background:'none', border:'1px solid rgba(0,0,0,.15)', cursor:'pointer', color:'var(--text-muted)', fontSize:12, padding:'3px 8px', borderRadius:6, flexShrink:0 }}>
          {sty.auto ? '×' : 'DISMISS'}
        </button>
      </div>

      {/* What happened */}
      <div style={{ padding:'8px 10px', background:'rgba(0,0,0,.04)', borderRadius:8, borderLeft:`3px solid ${sty.border}` }}>
        <div style={{ fontSize:10, fontWeight:700, color:sty.text, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>
          ⚠ Root Cause
        </div>
        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>{guide.cause}</div>
      </div>

      {/* Suggested fix */}
      <div style={{ padding:'8px 10px', background:'rgba(22,163,74,.06)', borderRadius:8, borderLeft:'3px solid #16a34a' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>
          ✓ Suggested Fix
        </div>
        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>{guide.fix}</div>
      </div>

      {/* Queue indicator */}
      {queue.length > 1 && (
        <div style={{ fontSize:10, color:'#94a3b8', textAlign:'center' }}>
          {queue.length - 1} more alert{queue.length-1>1?'s':''} in queue
        </div>
      )}
    </div>
  );
}
