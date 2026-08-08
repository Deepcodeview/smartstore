/**
 * HeatmapView.jsx — Real-time Defect Density Heatmap
 * Shows which region of the PCB has the most defects over time.
 * Grid-based accumulation: each cell tracks defect hit count.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import useAppStore from '../../store/appStore';

const GRID = 12; // 12x12 grid cells over the PCB

export default function HeatmapView() {
  const { boards } = useAppStore();
  const canvasRef  = useRef(null);

  // Build heatmap grid from all boards
  const heatData = useMemo(() => {
    const grid = Array.from({ length: GRID }, () => new Array(GRID).fill(0));
    let maxVal = 1;
    boards.forEach(b => {
      b.defects_found?.forEach(d => {
        const col = Math.min(Math.floor(((d.bbox[0]+d.bbox[2])/2) / (100/GRID)), GRID-1);
        const row = Math.min(Math.floor(((d.bbox[1]+d.bbox[3])/2) / (100/GRID)), GRID-1);
        grid[row][col]++;
        if (grid[row][col] > maxVal) maxVal = grid[row][col];
      });
    });
    return { grid, maxVal };
  }, [boards]);

  // Render heatmap on canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const W = c.width, H = c.height;
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const cw = W/GRID, ch = H/GRID;
    const { grid, maxVal } = heatData;

    grid.forEach((row, r) => {
      row.forEach((val, col) => {
        const intensity = val / maxVal;
        if (intensity < 0.01) {
          ctx.fillStyle = 'rgba(26,51,32,0.4)';
        } else {
          // Green → Yellow → Red gradient
          const r1 = Math.round(intensity < 0.5 ? intensity*2*217 : 217+(intensity-0.5)*2*(220-217));
          const g1 = Math.round(intensity < 0.5 ? 119+(1-intensity*2)*93 : (1-(intensity-0.5)*2)*119);
          const b1 = 0;
          ctx.fillStyle = `rgba(${r1},${g1},${b1},${0.3+intensity*0.65})`;
        }
        ctx.fillRect(col*cw, r*ch, cw-1, ch-1);

        // Label count if significant
        if (val > 0) {
          ctx.fillStyle = `rgba(255,255,255,${0.4+intensity*0.6})`;
          ctx.font = `bold ${Math.max(9, cw*0.35)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(val, col*cw+cw/2, r*ch+ch/2);
        }
      });
    });

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let i=0; i<=GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i*cw,0); ctx.lineTo(i*cw,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*ch); ctx.lineTo(W,i*ch); ctx.stroke();
    }
  }, [heatData]);

  const totalDefects = boards.reduce((s,b) => s + (b.total_defects||0), 0);
  const hotCells = heatData.grid.flat().filter(v => v > 0).length;

  // Find hottest zone
  let hotRow=0, hotCol=0;
  heatData.grid.forEach((row,r) => row.forEach((v,c) => {
    if (v > (heatData.grid[hotRow][hotCol]||0)) { hotRow=r; hotCol=c; }
  }));
  const zoneLabels = ['Top-Left','Top-Center','Top-Right','Mid-Left','Center','Mid-Right','Bot-Left','Bot-Center','Bot-Right'];
  const zoneIdx = Math.min(Math.floor(hotRow/(GRID/3))*3 + Math.floor(hotCol/(GRID/3)), 8);

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'var(--font-d)', fontSize:20, fontWeight:700, marginBottom:4 }}>🌡️ Defect Density Heatmap</div>
        <div style={{ color:'var(--text-muted)', fontSize:13 }}>Real-time visualization of defect hotspots across the PCB surface ({boards.length} boards analyzed)</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16 }}>
        {/* Heatmap Canvas */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">PCB Defect Density Map</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11 }}>
              <span style={{ color:'var(--green)' }}>■ Low</span>
              <span style={{ color:'var(--amber)' }}>■ Medium</span>
              <span style={{ color:'var(--red)' }}>■ High</span>
            </div>
          </div>
          <div style={{ padding:16, background:'#0a0e14' }}>
            <canvas ref={canvasRef} width={480} height={360}
              style={{ width:'100%', borderRadius:8, display:'block' }}/>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[
            { l:'Total Defects',   v:totalDefects,    c:'var(--red)'   },
            { l:'Boards Scanned',  v:boards.length,   c:'var(--brand)' },
            { l:'Hot Zones',       v:hotCells,        c:'var(--amber)' },
            { l:'Clean Zones',     v:GRID*GRID-hotCells, c:'var(--green)'},
          ].map(s => (
            <div key={s.l} className="stat-card" style={{ padding:16 }}>
              <div className="stat-label">{s.l}</div>
              <div style={{ fontFamily:'var(--font-d)', fontSize:26, fontWeight:700, color:s.c }}>{s.v}</div>
            </div>
          ))}

          {totalDefects > 0 && (
            <div className="card" style={{ border:'1px solid var(--red-border)' }}>
              <div style={{ padding:14 }}>
                <div className="section-title" style={{ marginBottom:8 }}>🔴 Hottest Zone</div>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--red)', marginBottom:4 }}>
                  {zoneLabels[zoneIdx]} Region
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                  {heatData.grid[hotRow][hotCol]} defects concentrated in grid [{hotRow+1},{hotCol+1}]
                </div>
                <div style={{ marginTop:8, fontSize:11, color:'var(--text-secondary)', background:'var(--amber-light)', padding:'6px 10px', borderRadius:6, border:'1px solid var(--amber-border)' }}>
                  ⚡ Recommendation: Inspect PCB {zoneLabels[zoneIdx].toLowerCase()} zone — check solder paste deposition and component placement
                </div>
              </div>
            </div>
          )}

          {totalDefects === 0 && (
            <div style={{ padding:16, background:'var(--green-light)', border:'1px solid var(--green-border)', borderRadius:10, textAlign:'center' }}>
              <div style={{ fontSize:24, marginBottom:6 }}>✅</div>
              <div style={{ fontWeight:600, color:'var(--green)', fontSize:13 }}>All zones clean</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>No defect clusters detected</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
