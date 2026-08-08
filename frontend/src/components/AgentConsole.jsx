/**
 * AgentConsole.jsx — Structured Debug Console
 * Shows [INFO] [WARNING] [ERROR] [SUCCESS] logs with timestamps
 * Color-coded, filterable, searchable
 */
import React, { useRef, useEffect, useState } from 'react';
import useAppStore from '../store/appStore';

const LEVEL_STYLE = {
  INFO:    { bg:'rgba(0,87,255,.08)',   border:'rgba(0,87,255,.2)',   text:'#2563eb', badge:'#2563eb', label:'INFO'    },
  SUCCESS: { bg:'rgba(22,163,74,.08)', border:'rgba(22,163,74,.2)',  text:'#16a34a', badge:'#16a34a', label:'OK'      },
  WARNING: { bg:'rgba(217,119,6,.08)', border:'rgba(217,119,6,.2)',  text:'#d97706', badge:'#d97706', label:'WARN'    },
  ERROR:   { bg:'rgba(220,38,38,.1)',  border:'rgba(220,38,38,.25)', text:'#dc2626', badge:'#dc2626', label:'ERROR'   },
};

// Detect log level from tagClass
function getLevel(e) {
  if (e.level) return e.level;
  if (e.tagClass==='REJECT') return 'ERROR';
  if (e.tagClass==='FLAG')   return 'WARNING';
  if (e.tagClass==='APPROVE')return 'SUCCESS';
  return 'INFO';
}

export default function AgentConsole({ maxHeight = 320, showFilters = true }) {
  const consoleLog = useAppStore(s => s.consoleLog);
  const ref        = useRef(null);
  const [filter,   setFilter]   = useState('ALL');
  const [search,   setSearch]   = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [consoleLog, autoScroll]);

  const levels = ['ALL','INFO','SUCCESS','WARNING','ERROR'];
  const counts  = { ALL:consoleLog.length };
  consoleLog.forEach(e => { const l=getLevel(e); counts[l]=(counts[l]||0)+1; });

  const displayed = [...consoleLog]
    .filter(e => filter==='ALL' || getLevel(e)===filter)
    .filter(e => !search || e.msg?.toLowerCase().includes(search.toLowerCase()))
    .reverse()
    .slice(0,100);

  return (
    <div>
      {showFilters && (
        <div style={{ display:'flex', gap:6, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
          {levels.map(l => {
            const s = LEVEL_STYLE[l];
            return (
              <button key={l} onClick={()=>setFilter(l)} style={{
                padding:'4px 10px', borderRadius:6, cursor:'pointer',
                fontFamily:'var(--font-m)', fontSize:10, fontWeight:700,
                border: filter===l ? `1.5px solid ${s?.badge||'var(--text-primary)'}` : '1px solid var(--border)',
                background: filter===l ? (s?.bg||'var(--bg)') : '#fff',
                color: filter===l ? (s?.text||'var(--text-primary)') : 'var(--text-muted)',
              }}>
                {l} {counts[l]>0?`(${counts[l]})`:null}
              </button>
            );
          })}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search logs…"
            style={{ marginLeft:'auto', padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)',
              fontSize:11, fontFamily:'var(--font-m)', color:'var(--text-secondary)', width:160 }}/>
          <button onClick={()=>setAutoScroll(p=>!p)} style={{
            padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:10, fontFamily:'var(--font-m)',
            border:'1px solid var(--border)', background:autoScroll?'var(--brand-light)':'#fff',
            color:autoScroll?'var(--brand)':'var(--text-muted)', fontWeight:600,
          }}>
            {autoScroll ? '⬇ Auto' : '⬇ Paused'}
          </button>
        </div>
      )}

      <div ref={ref} style={{
        background:'#0f1923', borderRadius:'var(--r)', padding:12,
        fontFamily:'var(--font-m)', fontSize:11.5, maxHeight, overflowY:'auto',
        border:'1px solid #1e2d3d', display:'flex', flexDirection:'column', gap:2,
      }}>
        {displayed.length === 0 && (
          <div style={{ color:'#4a6170', textAlign:'center', padding:'20px 0', fontSize:12 }}>
            {consoleLog.length===0 ? 'System idle — press "Start Simulation" to begin' : 'No logs match filter'}
          </div>
        )}
        {displayed.map((e, i) => {
          const level = getLevel(e);
          const s     = LEVEL_STYLE[level] || LEVEL_STYLE.INFO;
          return (
            <div key={i} style={{
              display:'flex', gap:8, padding:'5px 6px', borderRadius:4,
              background:s.bg, border:`1px solid ${s.border}`,
              animation:'consoleFade .25s ease',
            }}>
              {/* Level badge */}
              <span style={{ fontSize:9, fontWeight:800, color:s.text, background:`${s.badge}22`,
                padding:'1px 5px', borderRadius:3, flexShrink:0, alignSelf:'flex-start', marginTop:1, letterSpacing:'.3px' }}>
                {s.label}
              </span>
              {/* Timestamp */}
              <span style={{ color:'#4a6170', fontSize:10, flexShrink:0, alignSelf:'flex-start', marginTop:1, minWidth:56 }}>
                {e.time}
              </span>
              {/* Message */}
              <span style={{ color: level==='ERROR'?'#fca5a5':level==='WARNING'?'#fcd34d':level==='SUCCESS'?'#86efac':'#7d9cb0', fontSize:11, flex:1, wordBreak:'break-word', lineHeight:1.5 }}>
                {e.msg || `${e.tag}: ${e.msg}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
