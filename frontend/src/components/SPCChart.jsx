/* components/SPCChart.jsx — Renders real SPC data passed as props */
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

export default function SPCChart({ data = [], ucl = 5.0, mean = 2.8, lcl = 0.5, height = 180 }) {
  if (!data.length) {
    return (
      <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center',
        color:'#94a3b8', fontSize:13, border:'2px dashed #e2e8f0', borderRadius:10 }}>
        No SPC data — run real inspections to populate
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top:8, right:16, bottom:0, left:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize:9, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} axisLine={false} tickLine={false} width={28} />
        <Tooltip formatter={v => [v?.toFixed?.(2)||v, 'Defect Rate %']}
          contentStyle={{ borderRadius:8, border:'1px solid #e8ecf0', fontSize:11 }} />
        <ReferenceLine y={ucl}  stroke="#dc2626" strokeDasharray="4 2" />
        <ReferenceLine y={mean} stroke="#0057ff" strokeDasharray="4 2" />
        <ReferenceLine y={lcl}  stroke="#16a34a" strokeDasharray="4 2" />
        <Line type="monotone" dataKey="value" stroke="#0057ff" strokeWidth={2}
          dot={(p) => <circle key={p.cx} cx={p.cx} cy={p.cy} r={p.payload?.out_of_control ? 5 : 2.5}
            fill={p.payload?.out_of_control ? '#dc2626' : '#0057ff'} />}
          activeDot={{ r:5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
