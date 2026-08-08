/**
 * SystemConsole.jsx — Structured log console
 * Shows [INFO] / [WARNING] / [ERROR] / [SUCCESS] with color coding
 * Every entry has timestamp + level + human-readable message
 */
import React, { useRef, useEffect, useState } from 'react';
import useAppStore from '../store/appStore';

const LEVEL_STYLE = {
  INFO:    { color:'#60a5fa', bg:'rgba(96,165,250,.12)',  label:'INFO'    },
  WARNING: { color:'#f59e0b', bg:'rgba(245,158,11,.12)', label:'WARN'    },
  ERROR:   { color:'#ef4444', bg:'rgba(239,68,68,.12)',   label:'ERROR'   },
  SUCCESS: { color:'#22c55e', bg:'rgba(34,197,94,.12)',   label:'OK'      },
  APPROVE: { color:'#22c55e', bg:'rgba(34,197,94,.08)',   label:'PASS'    },
  REJECT:  { color:'#ef4444', bg:'rgba(239,68,68,.12)',   label:'REJECT'  },
  FLAG:    { color:'#f59e0b', bg:'rgba(245,158,11,.12)', label:'FLAG'    },
  PASS:    { color:'#60a5fa', bg:'rgba(96,165,250,.08)',  label:'LOG'     },
};

export default function SystemConsole({ maxHeight = 320, showFilter = true }) {
  const consoleLog  = useAppStore(s => s.consoleLog);
  const systemStatus = useAppStore(s => s.systemStatus);
  const ref         = useRef(null);
  const [filter,    setFilter]    = useState('ALL');
  const [autoScroll,setAutoScroll]= useState(true);
  const [paused,    setPaused]    = useState(false);

  useEffect(() => {
    if (autoScroll && ref.current && !paused) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [consoleLog, autoScroll, paused]);

  const filtered = filter === 'ALL'
    ? consoleLog
    : consoleLog.filter(e => e.tag === filter || e.tagClass === filter);

  const statusColor = { IDLE:'#94a3b8', RUNNING:'#22c55e', ERROR:'#ef4444', PAUSED:'#f59e0b' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      {/* Console header */}
      <div style={{ background:'#0f172a', borderRadius:'var(--r) var(--r) 0 0', padding:'8px 12px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', gap:5 }}>
            {['#ef4444','#f59e0b','#22c55e'].map((c,i) => (
              <div key={i} style={{ width:10, height:10, borderRadius:'50%', background:c }}/>
            ))}
          </div>
          <span style={{ fontFamily:'var(--font-m)', fontSize:11, color:'#64748b' }}>system.console</span>
          {/* System status */}
          <div style={{ display:'flex', alignItems:'center', gap:5, marginLeft:8, padding:'2px 8px',
            background:'rgba(255,255,255,.04)', borderRadius:4, border:'1px solid rgba(255,255,255,.08)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:statusColor[systemStatus]||'#94a3b8',
              animation:systemStatus==='RUNNING'?'livePulse 1.5s infinite':undefined }}/>
            <span style={{ fontFamily:'var(--font-m)', fontSize:10, color:statusColor[systemStatus]||'#94a3b8', fontWeight:700 }}>
              {systemStatus||'IDLE'}
            </span>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {showFilter && ['ALL','INFO','WARNING','ERROR'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding:'2px 7px', borderRadius:4, cursor:'pointer', fontSize:9, fontWeight:700,
              fontFamily:'var(--font-m)', border:'none',
              background: filter===f ? (LEVEL_STYLE[f]?.bg || 'rgba(255,255,255,.1)') : 'transparent',
              color: filter===f ? (LEVEL_STYLE[f]?.color || '#fff') : '#64748b',
            }}>{f}</button>
          ))}
          <button onClick={() => setPaused(p => !p)} style={{
            padding:'2px 7px', borderRadius:4, cursor:'pointer', fontSize:9, fontWeight:700,
            fontFamily:'var(--font-m)', border:'none',
            background:paused?'rgba(245,158,11,.2)':'transparent', color:paused?'#f59e0b':'#64748b',
          }}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
          <span style={{ fontFamily:'var(--font-m)', fontSize:9, color:'#475569' }}>
            {filtered.length} events
          </span>
        </div>
      </div>

      {/* Log body */}
      <div ref={ref} style={{ background:'#0f1923', borderRadius:'0 0 var(--r) var(--r)',
        fontFamily:'var(--font-m)', fontSize:11.5, maxHeight, overflowY:'auto',
        border:'1px solid #1e2d3d', borderTop:'none' }}>

        {filtered.length === 0 && (
          <div style={{ padding:'32px 16px', textAlign:'center', color:'#334155' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>⊙</div>
            <div>No log events yet</div>
            <div style={{ fontSize:10, marginTop:4 }}>Press "Start Simulation" to begin inspection</div>
          </div>
        )}

        {[...filtered].reverse().slice(0, 150).map((e, i) => {
          const sty = LEVEL_STYLE[e.tagClass] || LEVEL_STYLE[e.tag] || LEVEL_STYLE.INFO;
          // Parse [TAG] prefix from msg if present
          const msg       = e.msg || '';
          const msgParts  = msg.match(/^(\[[\w\s]+\])\s(.+)$/);
          const msgPrefix = msgParts?.[1] || '';
          const msgBody   = msgParts?.[2] || msg;

          return (
            <div key={i} style={{
              display:'flex', gap:8, padding:'5px 12px',
              borderBottom:'1px solid rgba(30,45,61,.35)',
              background: i===0 ? sty.bg : 'transparent',
              transition:'background .2s',
            }}>
              {/* Timestamp */}
              <span style={{ color:'#334155', fontSize:10, minWidth:56, flexShrink:0, paddingTop:1 }}>
                {e.time}
              </span>
              {/* Level badge */}
              <span style={{
                fontSize:9, fontWeight:800, minWidth:44, flexShrink:0,
                color:sty.color, background:sty.bg, borderRadius:3,
                padding:'1px 5px', textAlign:'center', alignSelf:'flex-start', marginTop:1,
              }}>
                {sty.label}
              </span>
              {/* Message */}
              <span style={{ color:'#94a3b8', fontSize:11, lineHeight:1.5, wordBreak:'break-all' }}>
                {msgPrefix && (
                  <span style={{ color:sty.color, fontWeight:700, marginRight:4 }}>{msgPrefix}</span>
                )}
                {msgBody}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
