/* components/ZoneHeatmapCanvas.jsx — SVG color-coded zone heatmap */
import React from 'react';

const ZONE_POSITIONS = {
  Entrance:    { x: 10,  y: 10,  w: 80,  h: 30 },
  Electronics: { x: 10,  y: 50,  w: 38,  h: 40 },
  Apparel:     { x: 52,  y: 50,  w: 38,  h: 40 },
  Grocery:     { x: 10,  y: 100, w: 80,  h: 40 },
  Checkout:    { x: 10,  y: 150, w: 80,  h: 25 },
};

function heatColor(pct) {
  // 0% = cool blue, 50% = amber, 100% = hot red
  if (pct < 30)  return { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' };
  if (pct < 60)  return { bg: '#fffbeb', border: '#fde68a', text: '#92400e' };
  if (pct < 80)  return { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' };
  return           { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
}

export default function ZoneHeatmapCanvas({ heatmap = {} }) {
  const values  = Object.values(heatmap);
  const maxVal  = Math.max(...values, 1);

  if (values.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🗺️</div>
        <div>Waiting for zone data...</div>
      </div>
    );
  }

  return (
    <div>
      {/* SVG Store Map */}
      <svg viewBox="0 0 100 185" style={{ width: '100%', maxHeight: 220, display: 'block' }}>
        {/* Store outline */}
        <rect x="8" y="8" width="84" height="170" rx="3"
          fill="none" stroke="var(--border-strong)" strokeWidth="0.8"/>

        {Object.entries(ZONE_POSITIONS).map(([zone, pos]) => {
          const count = heatmap[zone] || 0;
          const pct   = (count / maxVal) * 100;
          const col   = heatColor(pct);
          const alpha = 0.3 + (pct / 100) * 0.65;

          return (
            <g key={zone}>
              <rect
                x={pos.x} y={pos.y} width={pos.w} height={pos.h}
                rx="2"
                fill={col.bg}
                stroke={col.border}
                strokeWidth="0.8"
                opacity={alpha + 0.35}
              />
              {/* Heat fill overlay */}
              <rect
                x={pos.x} y={pos.y}
                width={pos.w * (pct / 100)} height={pos.h}
                rx="2"
                fill={col.border}
                opacity={0.5}
              />
              <text
                x={pos.x + pos.w / 2} y={pos.y + pos.h / 2 - 3}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="5.5" fontWeight="600" fill={col.text}
              >
                {zone}
              </text>
              <text
                x={pos.x + pos.w / 2} y={pos.y + pos.h / 2 + 5}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="5" fill={col.text} opacity={0.8}
              >
                {count} people
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'Low',      bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Moderate', bg: '#fffbeb', border: '#fde68a' },
          { label: 'High',     bg: '#fff7ed', border: '#fed7aa' },
          { label: 'Critical', bg: '#fef2f2', border: '#fecaca' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, border: `1.5px solid ${l.border}` }}/>
            <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Bar list */}
      <div style={{ marginTop: 14 }}>
        {Object.entries(heatmap)
          .sort((a, b) => b[1] - a[1])
          .map(([zone, count]) => {
            const pct = (count / maxVal) * 100;
            const col = heatColor(pct);
            return (
              <div key={zone} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{zone}</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-m)', color: col.text, fontWeight: 600 }}>
                    {count}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: col.border }}/>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
