/* components/ShiftReport.jsx — Agent 5: Shift Report Writer
 * 7-section report: Header, KPIs, Defect Breakdown, SPC, Incidents, Recommendations, Maintenance
 */
import React from 'react';
import useAppStore from '../store/appStore';
import { runShiftReportWriter } from '../utils/claudeApi';

const VERDICT_COLOR = { EXCELLENT:'var(--green)', GOOD:'var(--green)', NEEDS_ATTENTION:'var(--amber)', CRITICAL:'var(--red)' };

export default function ShiftReport() {
  const { getStats, getDefectCounts, apiKey, aiResult, setAiResult, aiLoading, setAiLoading } = useAppStore();
  const stats  = getStats();
  const defCt  = getDefectCounts();

  const generate = async () => {
    setAiLoading(true);
    setAiResult(null);
    const shiftData = {
      shift:     'Morning', line:'LINE-A',
      total:      stats.total,
      approved:   stats.approved,
      rejected:   stats.rejected,
      flagged:    stats.flagged,
      pass_rate:  stats.passRate,
      dpmo:       stats.dpmo,
      oee:        80.4,
      defect_counts: defCt,
      scrap_cost_inr: stats.rejected * 850,
    };
    const result = await runShiftReportWriter(shiftData, apiKey);
    setAiResult({ type:'shift_report', data:result });
    setAiLoading(false);
  };

  const report = aiResult?.type==='shift_report' ? aiResult.data : null;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">⬡ Agent 5 — Shift Report Writer</div>
          <div className="card-subtitle">7-section professional report · PDF export · Email to Plant Manager</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {report?.quality_verdict && (
            <span style={{fontWeight:700,color:VERDICT_COLOR[report.quality_verdict],fontSize:13}}>{report.quality_verdict}</span>
          )}
          <button className="btn btn-primary btn-sm" onClick={generate} disabled={aiLoading}>
            {aiLoading ? <span className="spinner" style={{width:14,height:14}}/> : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            )}
            {aiLoading ? 'Generating…' : report ? 'Regenerate' : 'Generate Shift Report'}
          </button>
        </div>
      </div>

      {/* Always show KPIs */}
      <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          ['PCBs Inspected', stats.total.toLocaleString(), 'var(--brand)'],
          ['Pass Rate',      `${stats.passRate}%`,         parseFloat(stats.passRate)>=97?'var(--green)':'var(--amber)'],
          ['Rejected',       stats.rejected,               'var(--red)'],
          ['DPMO',           stats.dpmo.toLocaleString(),  stats.dpmo<=3400?'var(--green)':'var(--red)'],
        ].map(([l,v,c])=>(
          <div key={l} style={{textAlign:'center'}}>
            <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:3}}>{l}</div>
            <div style={{fontFamily:'var(--font-d)',fontSize:18,fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card-body">
        {!report && !aiLoading && (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <p style={{color:'var(--text-muted)',fontSize:13,marginBottom:4}}>Generate a 7-section AI shift report with next-shift action plan.</p>
            <p style={{color:'var(--text-muted)',fontSize:11}}>Sections: Header · KPIs · Defect Breakdown · SPC Status · Critical Incidents · AI Recommendations · Maintenance Notes</p>
          </div>
        )}

        {aiLoading && <div style={{textAlign:'center',padding:'32px 0'}}><div className="spinner" style={{width:32,height:32,margin:'0 auto 14px'}}/><div style={{fontWeight:500}}>Claude AI writing 7-section shift report…</div></div>}

        {report && (
          <div>
            {/* Section 1-2: Header + KPIs */}
            <div style={{marginBottom:16,padding:'12px 14px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
              <div style={{fontWeight:700,fontSize:12,color:'var(--text-primary)',marginBottom:4}}>📋 SECTION 1-2: Header + Executive KPIs</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>
                Shift: {report.header?.shift} · Line: {report.header?.line} · Period: {report.header?.period} · Generated: {report.header?.generated_at}
              </div>
              {report.executive_kpis && (
                <div style={{display:'flex',gap:16,marginTop:8,flexWrap:'wrap'}}>
                  {[
                    ['Boards', report.executive_kpis.boards_inspected],
                    ['Pass%',  `${report.executive_kpis.pass_rate_pct?.toFixed(1)}%`],
                    ['DPMO',   report.executive_kpis.dpmo?.toLocaleString()],
                    ['OEE',    `${report.executive_kpis.oee_pct}%`],
                    ['Scrap Cost', `₹${((report.executive_kpis.scrap_cost_inr||0)/1000).toFixed(1)}K`],
                  ].map(([l,v])=>(
                    <div key={l} style={{fontSize:11}}>
                      <span style={{color:'var(--text-muted)'}}>{l}: </span>
                      <span style={{fontWeight:600,color:'var(--text-primary)'}}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: AI Summary */}
            <div className="ai-box" style={{marginBottom:12}}>
              <div className="ai-label">⬡ Section 6: AI Recommendations</div>
              {report.executive_kpis && (
                <div className="ai-text" style={{marginBottom:8}}>
                  Shift inspected <strong>{report.executive_kpis.boards_inspected}</strong> boards. Pass rate: <strong>{report.executive_kpis.pass_rate_pct?.toFixed(1)}%</strong>. DPMO: <strong>{report.executive_kpis.dpmo?.toLocaleString()}</strong>. OEE: <strong>{report.executive_kpis.oee_pct}%</strong>.
                </div>
              )}
              {report.hindi_summary && <div className="ai-hindi">{report.hindi_summary}</div>}
            </div>

            {/* SPC Status */}
            {report.spc_status && (
              <div style={{marginBottom:12,padding:'10px 12px',background:report.spc_status.was_in_control?'var(--green-light)':'var(--amber-light)',border:`1px solid ${report.spc_status.was_in_control?'var(--green-border)':'var(--amber-border)'}`,borderRadius:'var(--r-sm)',fontSize:12}}>
                <strong>📊 Section 4 — SPC Status:</strong> {report.spc_status.was_in_control?'✓ Process was in statistical control':'⚠ Process had control violations'} · UCL breaches: {report.spc_status.ucl_breaches}
                <div style={{marginTop:4,color:'var(--text-secondary)'}}>{report.spc_status.summary}</div>
              </div>
            )}

            {/* Next Shift Actions */}
            <div style={{marginBottom:12}}>
              <div className="section-title">Section 6: Next Shift Action Plan</div>
              {(report.ai_recommendations||[]).map((a,i)=>(
                <div key={i} style={{padding:'8px 12px',background:'var(--bg)',border:'1px solid var(--border)',borderLeft:'3px solid var(--brand)',borderRadius:'var(--r-sm)',marginBottom:6,fontSize:12}}>
                  {i+1}. {a}
                </div>
              ))}
            </div>

            {/* Maintenance Notes */}
            {report.maintenance_notes && (
              <div style={{padding:'10px 12px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',fontSize:11}}>
                <div className="section-title" style={{marginBottom:6}}>Section 7: Maintenance Notes</div>
                <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                  {[
                    ['CAM-01 Lens Wear', `${report.maintenance_notes.lens_wear_pct}%`],
                    ['Stencil Cycles',   `${report.maintenance_notes.stencil_cycles?.toLocaleString()} (limit 5,000)`],
                    ['Calibration Due',  report.maintenance_notes.calibration_due],
                  ].map(([l,v])=>(
                    <div key={l}>
                      <span style={{color:'var(--text-muted)'}}>{l}: </span>
                      <span style={{fontWeight:600}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
