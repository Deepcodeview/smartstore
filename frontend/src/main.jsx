import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './App.css';
import App from './App.jsx';

// Production mein console.log band karo (performance + security)
if (import.meta.env.PROD) {
  console.log  = () => {};
  console.debug = () => {};
  console.info  = () => {};
  // console.warn aur console.error rakho — errors track karne ke liye
}

// ── Error Boundary MUST be defined BEFORE use ─────────────────
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error('[RetailVision] Crash:', e, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ fontFamily:'system-ui,sans-serif', padding:40, textAlign:'center',
        background:'#0f172a', color:'#fff', minHeight:'100vh',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
        <div style={{ fontSize:48 }}>⚠️</div>
        <h2 style={{ margin:0, fontSize:22, fontWeight:700 }}>RetailVision Crashed</h2>
        <pre style={{ background:'#1e293b', padding:16, borderRadius:10, fontSize:12,
          color:'#f87171', maxWidth:620, textAlign:'left', overflow:'auto', whiteSpace:'pre-wrap' }}>
          {this.state.error?.message}{'\n\n'}{this.state.error?.stack?.split('\n').slice(1,4).join('\n')}
        </pre>
        <button onClick={() => window.location.reload()}
          style={{ padding:'10px 28px', background:'#0057ff', color:'#fff',
            border:'none', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:14 }}>
          🔄 Reload App
        </button>
      </div>
    );
  }
}

// ── Mount ─────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
