/* pages/ProductionDashboard.jsx — 100% Real API Data */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import useAppStore from '../store/appStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, BarChart, Bar } from 'recharts';
import DPMOGauge from '../components/DPMOGauge';
import api from '../utils/api';
const API_BASE = 'http://localhost:8000';

const TABS = [
  { id:'lines',  label:'🏭 Production Lines' },
  { id:'spc',    label:'📈 SPC Control Chart' },
  { id:'dpmo',   label:'⚡ DPMO Trend' },
  { id:'report', label:'📋 Shift Report' },
];

function NoData({ msg }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 24px', color:'#94a3b8', border:'2px dashed #e2e8f0', borderRadius:12 }}>
      <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
      <div style={{ fontWeight:600, color:'#64748b', marginBottom:4 }}>No Data Yet</div>
      <div style={{ fontSize:13 }}>{msg || 'Run real camera inspections to populate data.'}</div>
    </div>
  );
}

function StatCard({ label, value, sub, color='#0057ff', icon }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e8ecf0', borderRadius:12, padding:'18px 20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:11, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px' }}>{label}</span>
        {icon && <span style={{ fontSize:18 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily:'Outfit,sans-serif', fontSize:26, fontWeight:800, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{sub}</div>}
    </div>
  );
}

export default function ProductionDashboard({ defaultTab = 'lines' }) {
  const { boards, getStats, getDefectCounts } = useAppStore();
  const { total, approved, rejected, flagged, passRate } = getStats();
  const defCounts = getDefectCounts();

  const [tab,       setTab]      = useState(defaultTab);
  const [lines,     setLines]    = useState([]);
  const [spcData,   setSpcData]  = useState(null);   // null = loading
  const [dpmoData,  setDpmoData] = useState(null);
  const [oeeData,   setOeeData]  = useState(null);
  const [report,    setReport]   = useState(null);
  const [loading,   setLoading]  = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  // FIX 3: SSE real-time state
  const [sseStats,  setSseStats]  = useState(null);
  const [sseStatus, setSseStatus] = useState('idle');
  const sseRef = useRef(null);

  useEffect(() => { setTab(defaultTab); }, [defaultTab]);

  // FIX 3: SSE real-time stream — pushes stats + lines every 5s
  useEffect(() => {
    const token = localStorage.getItem('pcbg_token');
    if (!token) return;
    const ctrl  = new AbortController();
    sseRef.current = ctrl;
    setSseStatus('connecting');

    fetch(`${API_BASE}/dashboard/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      signal:  ctrl.signal,
    }).then(async res => {
      if (!res.ok) { setSseStatus('error'); return; }
      setSseStatus('connected');
      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) { setSseStatus('idle'); break; }
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop();
        for (const part of parts) {
          if (part.startsWith('data: ')) {
            try {
              const p = JSON.parse(part.slice(6));
              if (p.type === 'stats') {
                setSseStats(p);
                if (p.lines) setLines(p.lines);
              }
            } catch (_) {}
          }
        }
      }
    }).catch(err => {
      if (err.name !== 'AbortError') {
        setSseStatus('error');
      }
    });
    return () => { ctrl.abort(); setSseStatus('idle'); };
  }, []); // eslint-disable-line

  // Fetch production lines + stats (initial load — SSE keeps it updated after)
  useEffect(() => {
    api.get('/dashboard/production-lines')
      .then(r => setLines(r.data.lines || []))
      .catch(e => { /* SSE will handle updates */ });
    // Also fetch stats immediately so KPIs show before SSE connects
    api.get('/dashboard/stats')
      .then(r => {
        if (r.data && !sseStats) {
          setSseStats({
            type: 'stats',
            today_boards: r.data.today_boards || r.data.total_boards || 0,
            pass_rate: r.data.pass_rate || 0,
            rejected: r.data.total_rejected || 0,
            dpmo: r.data.dpmo || 0,
            timestamp: r.data.timestamp,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch SPC on tab open
  useEffect(() => {
    if (tab !== 'spc') return;
    setSpcData(null);
    // FIX BUG 6b: Use api.get() for SPC
    api.get('/spc/control-chart?line_id=LINE-A&hours=24')
      .then(r => setSpcData(r.data))
      .catch(e => setSpcData({ error: e.response?.data?.detail || e.message }));
  }, [tab]);

  // Fetch DPMO trend
  useEffect(() => {
    if (tab !== 'dpmo') return;
    setDpmoData(null);
    // FIX BUG 6c: Use api.get() for DPMO/OEE (all need auth)
    Promise.all([
      api.get('/spc/dpmo-trend?days=30').then(r => r.data),
      api.get('/spc/oee').then(r => r.data),
      api.get('/spc/defect-breakdown?days=7').then(r => r.data),
    ])
    .then(([dpmo, oee, breakdown]) => {
      setDpmoData(dpmo);
      setOeeData({ ...oee, breakdown: breakdown.breakdown || {} });
    })
    .catch(e => setDpmoData({ error: e.response?.data?.detail || e.message }));
  }, [tab]);

  // Real stats from DB
  const dpmoValue = total > 0 ? Math.round((rejected / total) * 1_000_000 / 6) : 0;
  const pr        = parseFloat(passRate) || 0;

  // Run optimizer via real backend API
  const runOpt = async () => {
    setAiLoading(true);
    try {
      // FIX BUG 6d: Use api.post() for optimizer
      const r = await api.post('/dashboard/optimizer', { line_id:'LINE-A', defect_history: defCounts });
      setReport(prev => ({ ...prev, optimizer: r.data }));
    } catch (e) {
      setReport(prev => ({ ...prev, optimizerError: e.response?.data?.detail || e.message }));
    }
    setAiLoading(false);
  };

  // Generate shift report via real backend API
  const genReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      // FIX BUG 6e: Use api.post() for shift report
      const r = await api.post('/reports/shift', { shift:'Morning', line_id:'LINE-A' });
      setReport(r.data);
    } catch (e) {
      setReport({ error: e.message });
    }
    setLoading(false);
  };

  // Download PDF
  const downloadPdf = async () => {
    try {
      // FIX BUG 6f: PDF blob download needs manual auth header (can't use axios for blob cleanly)
      const _pdfToken = localStorage.getItem('pcbg_token');
      const res = await fetch(`${API_BASE}/reports/shift/pdf`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ..._pdfToken ? { Authorization: `Bearer ${_pdfToken}` } : {},
        },
        body: JSON.stringify({ shift:'Morning', line_id:'LINE-A' }),
      });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `shift-report-${new Date().toISOString().slice(0,10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('PDF error: ' + e.message);
    }
  };

  // ── Tab: Production Lines ─────────────────────────────────
  const LinesTab = () => {
    const livePass   = sseStats ? parseFloat(sseStats.pass_rate   || 0) : pr;
    const liveTotal  = sseStats ? (sseStats.today_boards ?? total)    : total;
    const liveReject = sseStats ? (sseStats.rejected     ?? rejected) : rejected;
    const liveDpmo   = sseStats ? (sseStats.dpmo         ?? dpmoValue) : dpmoValue;
    return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* FIX 3: SSE live stream status bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
        background: sseStatus==='connected'?'#f0fdf4':sseStatus==='error'?'#fff5f5':'#f8fafc',
        border:`1px solid ${sseStatus==='connected'?'#bbf7d0':sseStatus==='error'?'#fecaca':'#e2e8f0'}`,
        borderRadius:10, fontSize:12, marginBottom:4 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
          background: sseStatus==='connected'?'#16a34a':sseStatus==='error'?'#dc2626':'#94a3b8',
          animation: sseStatus==='connected'?'livePulse 2s infinite':undefined }}/>
        <span style={{ fontWeight:600, color: sseStatus==='connected'?'#166534':sseStatus==='error'?'#991b1b':'#64748b' }}>
          {sseStatus==='connected'?'⚡ Live stream — auto-updates every 5s'
          :sseStatus==='connecting'?'⟳ Connecting to live stream…'
          :sseStatus==='error'?'⚠ Stream unavailable — showing cached data'
          :'Connect backend for live updates'}
        </span>
        {sseStats?.timestamp && (
          <span style={{ marginLeft:'auto', color:'#94a3b8', fontFamily:'monospace', fontSize:10 }}>
            {new Date(sseStats.timestamp).toLocaleTimeString('en-GB',{hour12:false})}
          </span>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        <StatCard label="Total Boards"  value={liveTotal || 0}            icon="📋" color="#0057ff" sub={sseStats?'Today — live':'This session'} />
        <StatCard label="Pass Rate"     value={`${livePass.toFixed(1)}%`} icon="✅" color={livePass>=97?'#16a34a':'#d97706'} sub="Target: 97%" />
        <StatCard label="Rejected"      value={liveReject || 0}           icon="⊘"  color="#dc2626" sub="CRITICAL defects" />
        <StatCard label="DPMO"          value={liveDpmo}                  icon="📊" color={liveDpmo<=3400?'#16a34a':'#d97706'} sub={liveDpmo<=3400?'Six Sigma ≥ 4σ':'Above target'} />
      </div>

      {/* Lines from real backend */}
      {lines.length === 0 ? (
        <NoData msg="Backend not connected or no production lines configured." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {lines.map(line => (
            <div key={line.id} style={{ background:'#fff', border:'1px solid #e8ecf0', borderRadius:12, padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div>
                  <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:700, fontSize:15 }}>{line.name}</div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Shift: {line.shift} · Target: {line.target_speed} boards/hr</div>
                </div>
                <span style={{
                  padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:700,
                  background: line.status==='running'?'#f0fdf4':'#fff5f5',
                  color:      line.status==='running'?'#16a34a':'#dc2626',
                  border:     `1px solid ${line.status==='running'?'#bbf7d0':'#fecaca'}`,
                }}>{line.status==='running' ? '● RUNNING' : '⊘ HALTED'}</span>
              </div>
              {/* Progress bars */}
              {[
                { label:'OEE',         value:line.oee,         max:100, color:'#0057ff', suffix:'%' },
                { label:'Speed',       value:line.speed,       max:line.target_speed||500, color:'#16a34a', suffix:' brd/hr' },
                { label:'Defect Rate', value:line.defect_rate, max:10,  color: line.defect_rate>5?'#dc2626':'#d97706', suffix:'%' },
              ].map(p => (
                <div key={p.label} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <span style={{ color:'#64748b', fontWeight:500 }}>{p.label}</span>
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:p.color }}>{p.value}{p.suffix}</span>
                  </div>
                  <div style={{ height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:p.color, borderRadius:3, width:`${Math.min((p.value/p.max)*100,100)}%`, transition:'width .5s ease' }}/>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
    );
  };

  // ── Tab: SPC Control Chart ────────────────────────────────
  const SPCTab = () => {
    if (!spcData) return <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>⟳ Loading SPC data from database…</div>;
    if (spcData.error) return <div style={{ padding:20, background:'#fff5f5', borderRadius:12, color:'#dc2626' }}>Error: {spcData.error}</div>;
    if (spcData.source === 'no_data' || !spcData.data?.length) return (
      <NoData msg="No SPC data yet. Run real camera inspections — SPC auto-calculates every 15 minutes." />
    );

    const { data, ucl, mean, lcl, spc } = spcData;
    const violated = data.filter(d => d.out_of_control);

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
          <StatCard label="SPC Status"   value={spc?.status?.replace(/_/g,' ')||'—'}   icon="📈" color={spc?.status==='IN_CONTROL'?'#16a34a':spc?.status==='TRENDING'?'#d97706':'#dc2626'} />
          <StatCard label="UCL"          value={ucl?.toFixed(2)||'—'}                  icon="⬆" color="#dc2626" sub="Upper Control Limit" />
          <StatCard label="Mean"         value={mean?.toFixed(2)||'—'}                 icon="—" color="#0057ff" sub="Process Mean" />
          <StatCard label="Violations"   value={violated.length}                        icon="⚠" color={violated.length>0?'#dc2626':'#16a34a'} sub="Points out of control" />
        </div>

        <div style={{ background:'#fff', border:'1px solid #e8ecf0', borderRadius:12, padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:700, fontSize:14, marginBottom:16 }}>
            SPC Control Chart — LINE-A · {data.length} data points · Source: {spcData.source}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top:10, right:20, bottom:0, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [v?.toFixed(2), n]} contentStyle={{ borderRadius:8, border:'1px solid #e8ecf0', fontSize:12 }} />
              <ReferenceLine y={ucl}  stroke="#dc2626" strokeDasharray="5 3" label={{ value:`UCL ${ucl?.toFixed(1)}`, position:'right', fontSize:10, fill:'#dc2626' }} />
              <ReferenceLine y={mean} stroke="#0057ff" strokeDasharray="5 3" label={{ value:`Mean ${mean?.toFixed(1)}`, position:'right', fontSize:10, fill:'#0057ff' }} />
              <ReferenceLine y={lcl}  stroke="#16a34a" strokeDasharray="5 3" label={{ value:`LCL ${lcl?.toFixed(1)}`, position:'right', fontSize:10, fill:'#16a34a' }} />
              <Line type="monotone" dataKey="value" stroke="#0057ff" strokeWidth={2} dot={(props) => {
                const { cx, cy, payload } = props;
                const fill = payload.out_of_control ? '#dc2626' : '#0057ff';
                return <circle key={cx} cx={cx} cy={cy} r={payload.out_of_control ? 5 : 3} fill={fill} />;
              }} activeDot={{ r:6 }} name="Defect Rate %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {spc?.violations?.length > 0 && (
          <div style={{ background:'#fff5f5', border:'1px solid #fecaca', borderRadius:12, padding:16 }}>
            <div style={{ fontWeight:700, color:'#dc2626', marginBottom:8 }}>⚠ Western Electric Violations</div>
            {spc.violations.map((v,i) => <div key={i} style={{ fontSize:13, color:'#7f1d1d', marginBottom:4 }}>• {v}</div>)}
          </div>
        )}
      </div>
    );
  };

  // ── Tab: DPMO Trend ───────────────────────────────────────
  const DPMOTab = () => {
    if (!dpmoData) return <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>⟳ Loading DPMO data…</div>;
    if (dpmoData.error) return <div style={{ padding:20, background:'#fff5f5', borderRadius:12, color:'#dc2626' }}>Error: {dpmoData.error}</div>;

    const hasData = dpmoData.data?.some(d => d.dpmo > 0);
    if (!hasData) return <NoData msg="No DPMO data yet. Run real inspections to calculate defect rates." />;

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
          <StatCard label="Current DPMO" value={dpmoData.latest||0}       icon="📊" color={dpmoData.latest<=3400?'#16a34a':'#dc2626'} sub={`Target: 3,400`} />
          <StatCard label="Sigma Level"  value={dpmoData.sigma||'—'}      icon="σ"  color="#0057ff" sub="Process capability" />
          <StatCard label="Status"       value={dpmoData.status||'—'}     icon="🎯" color={dpmoData.status==='GOOD'?'#16a34a':'#dc2626'} />
          <StatCard label="OEE Overall"  value={`${oeeData?.overall||0}%`}icon="⚡" color={oeeData?.overall>=85?'#16a34a':'#d97706'} sub="Target: 85%" />
        </div>

        <div style={{ background:'#fff', border:'1px solid #e8ecf0', borderRadius:12, padding:20 }}>
          <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:700, fontSize:14, marginBottom:16 }}>30-Day DPMO Trend — Real DB Data</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dpmoData.data||[]} margin={{ top:0, right:0, bottom:0, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={v => [v, 'DPMO']} contentStyle={{ borderRadius:8, border:'1px solid #e8ecf0', fontSize:12 }} />
              <ReferenceLine y={3400} stroke="#dc2626" strokeDasharray="4 2" label={{ value:'Target 3400', position:'right', fontSize:10, fill:'#dc2626' }} />
              <Bar dataKey="dpmo" radius={[4,4,0,0]} maxBarSize={30}
                fill="#0057ff"
                label={{ position:'top', fontSize:9, fill:'#94a3b8', formatter: v => v > 0 ? v : '' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* OEE Breakdown */}
        {oeeData && (
          <div style={{ background:'#fff', border:'1px solid #e8ecf0', borderRadius:12, padding:20 }}>
            <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:700, fontSize:14, marginBottom:16 }}>OEE Breakdown — Source: {oeeData.source}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[
                { label:'Availability', value:oeeData.availability, color:'#0057ff' },
                { label:'Performance',  value:oeeData.performance,  color:'#7c3aed' },
                { label:'Quality',      value:oeeData.quality,      color:'#16a34a' },
              ].map(m => (
                <div key={m.label} style={{ textAlign:'center', padding:'16px 12px', background:'#f8fafc', borderRadius:10 }}>
                  <div style={{ fontFamily:'Outfit,sans-serif', fontSize:28, fontWeight:800, color:m.color }}>{m.value?.toFixed(1)}%</div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{m.label}</div>
                  <div style={{ height:4, background:'#e2e8f0', borderRadius:2, marginTop:8, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:m.color, width:`${m.value}%`, borderRadius:2 }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Defect Breakdown */}
            {Object.keys(oeeData.breakdown||{}).length > 0 && (
              <div style={{ marginTop:16 }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Defect Breakdown — Last 7 Days</div>
                {(() => {
                  // FIX BUG 4: Extract Math.max(...Object.values()) OUTSIDE JSX —
                  // JSX parser treats '...' as spread attribute → causes '}' syntax error
                  const breakdownVals = Object.values(oeeData.breakdown);
                  const maxBreakdown  = breakdownVals.length > 0 ? Math.max(...breakdownVals) : 1;
                  return Object.entries(oeeData.breakdown).map(([cls, cnt]) => {
                    const barPct = Math.min((cnt / Math.max(maxBreakdown, 1)) * 100, 100);
                    return (
                      <div key={cls} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                        <div style={{ width:120, fontSize:12, color:'#374151', fontFamily:'JetBrains Mono,monospace' }}>{cls}</div>
                        <div style={{ flex:1, height:8, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                          <div style={{ height:'100%', background:'#0057ff', borderRadius:4,
                            width:`${barPct}%` }} />
                        </div>
                        <div style={{ width:30, fontSize:12, fontWeight:700, color:'#0057ff', textAlign:'right' }}>{cnt}</div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Tab: Shift Report ─────────────────────────────────────
  const ReportTab = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ background:'#fff', border:'1px solid #e8ecf0', borderRadius:12, padding:20 }}>
        <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:700, fontSize:15, marginBottom:4 }}>📋 AI Shift Report Generator</div>
        <div style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>
          Fetches REAL shift data from database and generates Claude AI analysis.
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={genReport} disabled={loading} style={{
            padding:'10px 22px', background:'#0057ff', color:'#fff', border:'none',
            borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:14,
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? '⟳ Generating…' : '⚡ Generate Shift Report'}
          </button>
          <button onClick={downloadPdf} style={{
            padding:'10px 22px', background:'#f8fafc', color:'#374151',
            border:'1px solid #e2e8f0', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:14,
          }}>⬇ Download PDF</button>
          <button onClick={runOpt} disabled={aiLoading} style={{
            padding:'10px 22px', background:'#7c3aed', color:'#fff', border:'none',
            borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:14,
            opacity: aiLoading ? 0.6 : 1,
          }}>
            {aiLoading ? '⟳ Running…' : '🤖 Agent 4 Optimizer'}
          </button>
        </div>
      </div>

      {report?.error && (
        <div style={{ padding:16, background:'#fff5f5', borderRadius:12, border:'1px solid #fecaca', color:'#dc2626' }}>
          Error: {report.error}
        </div>
      )}

      {report && !report.error && (
        <>
          {/* Real shift KPIs */}
          {report.shift_data && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
              <StatCard label="Total Boards"  value={report.shift_data.total}          icon="📋" color="#0057ff" sub={`Source: ${report.shift_data.source}`} />
              <StatCard label="Pass Rate"     value={`${report.shift_data.pass_rate}%`} icon="✅" color="#16a34a" />
              <StatCard label="DPMO"          value={report.shift_data.dpmo}           icon="📊" color={report.shift_data.dpmo<=3400?'#16a34a':'#dc2626'} />
              <StatCard label="Scrap Cost"    value={`₹${(report.shift_data.scrap_cost_inr||0).toLocaleString('en-IN')}`} icon="💸" color="#d97706" />
            </div>
          )}

          {/* AI Report */}
          {report.ai_report && (
            <div style={{ background:'#fff', border:'1px solid #e8ecf0', borderRadius:12, padding:20 }}>
              <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:700, fontSize:15, marginBottom:16 }}>🤖 Claude AI Analysis</div>
              <div style={{ padding:16, background:'#f8fafc', borderRadius:10, marginBottom:12 }}>
                <div style={{ fontWeight:600, fontSize:12, color:'#64748b', marginBottom:6 }}>Executive Summary</div>
                <div style={{ fontSize:14, color:'#374151', lineHeight:1.6 }}>{report.ai_report.executive_summary || '—'}</div>
              </div>
              {report.ai_report.quality_verdict && (
                <div style={{ display:'inline-block', padding:'6px 16px', borderRadius:20, marginBottom:12,
                  background: report.ai_report.quality_verdict.includes('EXCEL')?'#f0fdf4':report.ai_report.quality_verdict.includes('CRIT')?'#fff5f5':'#fffbeb',
                  color: report.ai_report.quality_verdict.includes('EXCEL')?'#16a34a':report.ai_report.quality_verdict.includes('CRIT')?'#dc2626':'#d97706',
                  fontWeight:700, fontSize:13 }}>
                  Verdict: {report.ai_report.quality_verdict}
                </div>
              )}
              {report.ai_report.next_shift_actions?.length > 0 && (
                <div>
                  <div style={{ fontWeight:600, fontSize:12, color:'#64748b', marginBottom:8 }}>Next Shift Actions</div>
                  {report.ai_report?.next_shift_actions?.map((a,i) => (
                    <div key={i} style={{ display:'flex', gap:10, marginBottom:8, padding:'10px 14px', background:'#f0f7ff', borderRadius:8, borderLeft:'3px solid #0057ff' }}>
                      <span style={{ fontWeight:700, color:'#0057ff', flexShrink:0 }}>{i+1}.</span>
                      <span style={{ fontSize:13, color:'#374151' }}>{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Optimizer result */}
          {report.optimizer && (
            <div style={{ background:'#fff', border:'1px solid #e8ecf0', borderRadius:12, padding:20 }}>
              <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:700, fontSize:15, marginBottom:12 }}>🤖 Agent 4 — Production Optimizer</div>
              {/* Primary adjustment */}
              {report.optimizer.primary_adjustment && (
                <div style={{ padding:'12px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, marginBottom:14, fontSize:13, fontWeight:600, color:'#166534' }}>
                  ⚡ {report.optimizer.primary_adjustment}
                </div>
              )}
              {/* SPC + OEE summary */}
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:14 }}>
                {report.optimizer.spc_status && <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background: report.optimizer.spc_status==='IN_CONTROL'?'#f0fdf4':'#fff5f5', color: report.optimizer.spc_status==='IN_CONTROL'?'#16a34a':'#dc2626', border:`1px solid ${report.optimizer.spc_status==='IN_CONTROL'?'#bbf7d0':'#fecaca'}` }}>SPC: {report.optimizer.spc_status.replace(/_/g,' ')}</span>}
                {report.optimizer.current_dpmo != null && <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background:'#f0f7ff', color:'#0057ff', border:'1px solid #bfdbfe' }}>DPMO: {report.optimizer.current_dpmo}</span>}
                {report.optimizer.urgency && <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background: report.optimizer.urgency==='immediate'?'#fff5f5':'#fffbeb', color: report.optimizer.urgency==='immediate'?'#dc2626':'#d97706', border:`1px solid ${report.optimizer.urgency==='immediate'?'#fecaca':'#fde68a'}` }}>Urgency: {report.optimizer.urgency}</span>}
                {report.optimizer.monthly_savings_inr > 0 && <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0' }}>💰 ₹{report.optimizer.monthly_savings_inr.toLocaleString('en-IN')}/mo savings</span>}
              </div>
              {/* Top 3 actions */}
              {(report.optimizer.top_3_actions || report.optimizer.actions || []).map((a,i) => (
                <div key={i} style={{ display:'flex', gap:10, marginBottom:8, padding:'10px 14px', background:'#f5f3ff', borderRadius:8, borderLeft:'3px solid #7c3aed' }}>
                  <span style={{ fontWeight:700, color:'#7c3aed', flexShrink:0 }}>{i+1}.</span>
                  <span style={{ fontSize:13 }}>{a}</span>
                </div>
              ))}
              {/* Hindi summary */}
              {report.optimizer.hindi_summary && (
                <div style={{ marginTop:12, padding:'10px 14px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, fontSize:12, color:'#92400e' }}>
                  🇮🇳 {report.optimizer.hindi_summary}
                </div>
              )}
              {/* OEE comment */}
              {report.optimizer.oee_comment && (
                <div style={{ marginTop:8, fontSize:12, color:'#64748b', fontStyle:'italic' }}>
                  📊 {report.optimizer.oee_comment}
                </div>
              )}
            </div>
          )}
          {report.optimizerError && (
            <div style={{ padding:12, background:'#fff5f5', borderRadius:8, color:'#dc2626', fontSize:13 }}>Optimizer error: {report.optimizerError}</div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'Outfit,sans-serif', fontSize:20, fontWeight:800, margin:0 }}>🏭 Production Dashboard</h1>
          <p style={{ fontSize:12, color:'#94a3b8', margin:'4px 0 0' }}>Live data from PostgreSQL database · Real YOLO inspections</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:24, background:'#f1f5f9', padding:5, borderRadius:12, width:'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'8px 18px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:600,
            border:'none', transition:'all .15s',
            background: tab===t.id ? '#fff' : 'transparent',
            color:       tab===t.id ? '#0f1923' : '#64748b',
            boxShadow:   tab===t.id ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'lines'  && <LinesTab />}
      {tab === 'spc'    && <SPCTab />}
      {tab === 'dpmo'   && <DPMOTab />}
      {tab === 'report' && <ReportTab />}
    </div>
  );
}
