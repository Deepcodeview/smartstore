/* components/DPMOGauge.jsx — DPMO Gauge Visualization */
import React from 'react';

export default function DPMOGauge({ dpmo = 0, target = 3400 }) {
  const MAX     = 10000;
  const pct     = Math.min((dpmo / MAX) * 100, 100);
  const isGood  = dpmo <= target;
  const color   = dpmo <= 1000 ? 'var(--green)' : dpmo <= target ? 'var(--amber)' : 'var(--red)';
  const sigma   = dpmo <= 233    ? '≥6σ'
                : dpmo <= 1350   ? '5σ'
                : dpmo <= 6210   ? '4σ'
                : dpmo <= 66807  ? '3σ' : '<3σ';

  /* arc math: semicircle 0–180° */
  const R   = 60;
  const CX  = 80; const CY = 80;
  const a   = Math.PI * pct / 100;
  const ex  = CX - R * Math.cos(a);
  const ey  = CY - R * Math.sin(a);

  return (
    <div style={{ textAlign:'center' }}>
      <svg viewBox="0 0 160 90" style={{ width:'100%', maxWidth:220, overflow:'visible' }}>
        {/* Track */}
        <path d={`M${CX-R} ${CY} A${R} ${R} 0 0 1 ${CX+R} ${CY}`}
          fill="none" stroke="var(--border)" strokeWidth="10" strokeLinecap="round"/>
        {/* Fill */}
        {dpmo > 0 && (
          <path d={`M${CX-R} ${CY} A${R} ${R} 0 0 1 ${ex} ${ey}`}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"/>
        )}
        {/* Target tick */}
        {(() => {
          const ta = Math.PI * (target / MAX);
          return (
            <line
              x1={CX - (R-8)*Math.cos(ta)} y1={CY - (R-8)*Math.sin(ta)}
              x2={CX - (R+8)*Math.cos(ta)} y2={CY - (R+8)*Math.sin(ta)}
              stroke="var(--amber)" strokeWidth="2" strokeDasharray="3,2"
            />
          );
        })()}
        {/* Center text */}
        <text x={CX} y={CY-8} textAnchor="middle" fontSize="18" fontWeight="700" fontFamily="var(--font-d)" fill={color}>
          {dpmo.toLocaleString()}
        </text>
        <text x={CX} y={CY+8} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-m)">
          DPMO
        </text>
      </svg>
      <div style={{ marginTop:-8, fontSize:12 }}>
        <span style={{ fontWeight:700, color, marginRight:8 }}>{sigma}</span>
        <span style={{ color:'var(--text-muted)' }}>target ≤{target.toLocaleString()}</span>
      </div>
    </div>
  );
}
