/* store/appStore.js — Retail AI Global State */
import { create } from 'zustand';

const WS_URL = 'ws://localhost:8000/ws/alerts';

function loadAuth() {
  try {
    const token   = localStorage.getItem('retail_token');
    const user    = JSON.parse(localStorage.getItem('retail_user')    || 'null');
    const company = JSON.parse(localStorage.getItem('retail_company') || 'null');
    if (token && user) return { token, user, company };
  } catch (_) {}
  return { token: null, user: null, company: null };
}
const _auth = loadAuth();

let _ws = null;

const useAppStore = create((set, get) => ({

  /* ── Auth ── */
  user: _auth.user, company: _auth.company, token: _auth.token,

  login: (user, company, token) => {
    try {
      localStorage.setItem('retail_token',   token);
      localStorage.setItem('retail_user',    JSON.stringify(user));
      localStorage.setItem('retail_company', JSON.stringify(company));
    } catch (_) {}
    set({ user, company, token });
    get().connectWS();
  },

  logout: () => {
    localStorage.removeItem('retail_token');
    localStorage.removeItem('retail_user');
    localStorage.removeItem('retail_company');
    if (_ws) { _ws.close(); _ws = null; }
    set({ user: null, company: null, token: null, alerts: [], consoleLog: [], systemStatus: 'IDLE', wsConnected: false });
  },

  /* ── WebSocket ── */
  wsConnected: false,

  connectWS: () => {
    if (_ws && _ws.readyState <= 1) return; // already open/connecting
    try {
      _ws = new WebSocket(WS_URL);

      _ws.onopen = () => {
        set({ wsConnected: true });
        // Keep-alive ping every 20s
        _ws._pingInterval = setInterval(() => {
          if (_ws?.readyState === 1) _ws.send(JSON.stringify({ type: 'ping' }));
        }, 20000);
      };

      _ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'alert') {
            get().addAlert({
              severity:  msg.severity || 'INFO',
              message:   msg.message  || 'New alert',
              zone:      msg.zone,
              timestamp: msg.ts,
            });
          }
        } catch (_) {}
      };

      _ws.onclose = () => {
        set({ wsConnected: false });
        clearInterval(_ws?._pingInterval);
        // Auto-reconnect after 5s if user is still logged in
        setTimeout(() => { if (get().token) get().connectWS(); }, 5000);
      };

      _ws.onerror = () => {
        set({ wsConnected: false });
      };
    } catch (_) {
      set({ wsConnected: false });
    }
  },

  /* ── Alerts ── */
  alerts: [],
  addAlert:          (a) => set(s => ({ alerts: [...s.alerts.slice(-199), { ...a, id: Date.now(), read: false }] })),
  markAlertRead:     (id) => set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, read: true } : a) })),
  markAllAlertsRead: ()   => set(s => ({ alerts: s.alerts.map(a => ({ ...a, read: true })) })),

  /* ── Console Log ── */
  consoleLog: [],
  addConsoleEntry: (e) => set(s => ({ consoleLog: [...s.consoleLog.slice(-299), e] })),

  /* ── System Status ── */
  systemStatus: 'IDLE',
  setSystemStatus: (s) => set({ systemStatus: s }),

  /* ── Live KPIs (from SSE) ── */
  liveKpis: null,
  setLiveKpis: (kpis) => set({ liveKpis: kpis }),

  /* ── API Key (for Claude agents) ── */
  apiKey: localStorage.getItem('retail_ak') || '',
  setApiKey: (k) => { localStorage.setItem('retail_ak', k); set({ apiKey: k }); },

  /* ── Simulation (PCB compat stubs) ── */
  simRunning: false,
  startSim: () => set({ simRunning: true }),
  stopSim:  () => set({ simRunning: false }),
  pauseSim: () => {},

  /* ── Boards (PCB compat — unused in retail but referenced) ── */
  boards: [],
  addBoard: () => {},

  /* ── Class Confidence (PCB compat) ── */
  classConfidence: {},
  setClassConfidence: (v) => set({ classConfidence: v }),

  /* ── Camera State (PCB compat) ── */
  cameraState: 'idle',
  setCameraState: (v) => set({ cameraState: v }),

  /* ── Autonomous / Active Learning (PCB compat) ── */
  autonomousMode: false,
  setAutonomousMode: (v) => set({ autonomousMode: v }),
  activeLearning: false,
  setActiveLearning: (v) => set({ activeLearning: v }),

  /* ── Confidence Thresholds (PCB compat) ── */
  confThresholdFlag:   0.6,
  setConfThresholdFlag:   (v) => set({ confThresholdFlag: v }),
  confThresholdReject: 0.85,
  setConfThresholdReject: (v) => set({ confThresholdReject: v }),

  /* ── AI Result ── */
  aiResult: null,
  setAiResult: (r) => set({ aiResult: r }),
  aiLoading: false,
  setAiLoading: (v) => set({ aiLoading: v }),

  /* ── Computed ── */
  getStats: () => {
    const alerts = get().alerts;
    const unread   = alerts.filter(a => !a.read).length;
    const critical = alerts.filter(a => a.severity === 'CRITICAL').length;
    return {
      unread,
      critical,
      total:    alerts.length,
      approved: 0,
      rejected: 0,
      flagged:  0,
      passRate: 100,
    };
  },

  getDefectCounts: () => ({
    total: 0, REJECT: 0, FLAG_FOR_REVIEW: 0, APPROVE: 0, PASS_WITH_LOG: 0,
  }),

  getBatchRate: () => ({ pass_rate: 0, dpmo: 0, total: 0 }),
}));

// Auto-connect WS if already logged in on page load
if (_auth.token) {
  setTimeout(() => useAppStore.getState().connectWS(), 500);
}

export default useAppStore;
