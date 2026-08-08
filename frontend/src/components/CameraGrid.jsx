/* components/CameraGrid.jsx — Single CAM-01 Grid View with stats */
import React from 'react';
import PCBCanvas from './PCBCanvas';
import useAppStore from '../store/appStore';

export default function CameraGrid() {
  const cameraState = useAppStore(s => s.cameraState);
  const boards      = useAppStore(s => s.boards);
  const { getStats } = useAppStore();
  const stats       = getStats();

  const decColor = {
    APPROVE:         'var(--green)',
    REJECT:          'var(--red)',
    FLAG_FOR_REVIEW: 'var(--amber)',
    PASS_WITH_LOG:   'var(--brand)',
  };

  return (
    <div>
      {/* Camera feed */}
      <PCBCanvas inspection={cameraState} />

      {/* Camera info bar */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        marginTop:12, padding:'10px 14px',
        background:'var(--bg)', borderRadius:'var(--r)',
        border:'1px solid var(--border)',
      }}>
        <div style={{ display:'flex', gap:24 }}>
          {[
            ['Camera',    'CAM-01'],
            ['Zone',      cameraState?.zone        || 'Initializing…'],
            ['Board',     cameraState?.board_id    || '—'],
            ['Inference', cameraState?.inference_ms ? `${cameraState.inference_ms}ms` : '—'],
            ['FPS',       cameraState?.fps         || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:2 }}>
                {label}
              </div>
              <div style={{ fontSize:13, fontFamily:'var(--font-m)', fontWeight:600, color:'var(--text-primary)' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
        {cameraState && (
          <span className={`badge badge-${cameraState.decision||"APPROVE"}`} style={{ fontSize:12, padding:'5px 14px' }}>
            {(cameraState.decision||"").replace(/_/g,' ')}
          </span>
        )}
      </div>

      {/* Mini live stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:12 }}>
        {[
          { label:'Inspected', value: stats.total,    color:'var(--brand)' },
          { label:'Pass Rate',  value: `${stats.passRate}%`, color: parseFloat(stats.passRate)>=97?'var(--green)':'var(--amber)' },
          { label:'Rejected',   value: stats.rejected, color:'var(--red)'   },
          { label:'Flagged',    value: stats.flagged,  color:'var(--amber)'  },
        ].map(s => (
          <div key={s.label} style={{
            padding:'10px 12px', background:'var(--bg)',
            borderRadius:'var(--r)', border:'1px solid var(--border)', textAlign:'center',
          }}>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:3 }}>{s.label}</div>
            <div style={{ fontFamily:'var(--font-d)', fontSize:18, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
