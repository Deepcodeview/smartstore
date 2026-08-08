/**
 * App.jsx — Retail AI System Root
 * Role-based nav: store_manager | analyst | admin
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import useAppStore from './store/appStore';
import { authFetch } from './utils/api';

import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Jobs       from './pages/Jobs';
import Alerts     from './pages/Alerts';
import Crossings  from './pages/Crossings';
import Settings   from './pages/Settings';
import LiveMonitor from './pages/LiveMonitor';
import Reports    from './pages/Reports';
import Trends     from './pages/Trends';
import Sales      from './pages/Sales';
import Inventory  from './pages/Inventory';
import Security   from './pages/Security';
import Enterprise from './pages/Enterprise';
import AIInsights     from './pages/AIInsights';
import StaffOps       from './pages/StaffOps';
import Compliance     from './pages/Compliance';
import Engagement     from './pages/Engagement';
import ReportBuilder  from './pages/ReportBuilder';
import PlatformConfig from './pages/PlatformConfig';
import EdgeConfig     from './pages/EdgeConfig';
import AdminDashboard from './pages/AdminDashboard';
import JobAnalytics  from './pages/JobAnalytics';

const API_BASE_APP = 'http://localhost:8000';

// ── WebSocket Alert Toast ─────────────────────────────────────────────────────
function WsToastContainer() {
  const { alerts } = useAppStore();
  const [toasts, setToasts] = useState([]);
  const prevLen = useRef(0);

  useEffect(() => {
    if (alerts.length > prevLen.current) {
      const newest = alerts[alerts.length - 1];
      if (!newest.read) {
        const id = newest.id;
        setToasts(t => [...t.slice(-4), { ...newest, toastId: id }]);
        setTimeout(() => setToasts(t => t.filter(x => x.toastId !== id)), 5000);
      }
    }
    prevLen.current = alerts.length;
  }, [alerts]);

  const icons = { CRITICAL: '🔴', HIGH: '🟡', WARNING: '🟠', INFO: '🔵' };

  return (
    <div className="ws-toast-container">
      {toasts.map(t => (
        <div key={t.toastId} className={`ws-toast sev-${t.severity}`}
          onClick={() => setToasts(ts => ts.filter(x => x.toastId !== t.toastId))}>
          <div className="ws-toast-icon">{icons[t.severity] || '⚪'}</div>
          <div className="ws-toast-body">
            <div className="ws-toast-title">{t.severity} Alert{t.zone ? ` — ${t.zone}` : ''}</div>
            <div className="ws-toast-msg">{t.message}</div>
            <div className="ws-toast-time">{t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : 'now'}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const NAV = {
  store_manager: [
    { id: 'dashboard',   label: 'Live Dashboard',   icon: 'chart'    },
    { id: 'live',        label: 'Live Monitor',      icon: 'monitor'  },
    { id: 'jobs',        label: 'Video Jobs',        icon: 'video'    },
    { id: 'crossings',   label: 'Footfall Log',      icon: 'people'   },
    { id: 'trends',      label: 'Trends',            icon: 'trend'    },
    { id: 'sales',       label: 'Sales & Marketing', icon: 'sales'    },
    { id: 'inventory',   label: 'Inventory',         icon: 'box'      },
    { id: 'security',    label: 'Loss Prevention',   icon: 'shield'   },
    { id: 'ai',          label: 'AI Insights',       icon: 'ai'       },
    { id: 'staff',       label: 'Staff & Ops',       icon: 'staff'    },
    { id: 'compliance',  label: 'Compliance',        icon: 'comply'   },
    { id: 'engagement',  label: 'Engagement',        icon: 'engage'   },
    { id: 'reports',     label: 'Reports',           icon: 'report'   },
    { id: 'bi',          label: 'Report Builder',    icon: 'bi'       },
    { id: 'edge',        label: 'Edge & Cameras',    icon: 'edge'     },
    { id: 'alerts',      label: 'Alert Center',      icon: 'bell'     },
  ],
  analyst: [
    { id: 'dashboard',   label: 'Analytics',         icon: 'chart'    },
    { id: 'jobs',        label: 'All Jobs',           icon: 'video'    },
    { id: 'crossings',   label: 'Crossing Events',   icon: 'people'   },
    { id: 'trends',      label: 'Trends',            icon: 'trend'    },
    { id: 'sales',       label: 'Sales & Marketing', icon: 'sales'    },
    { id: 'inventory',   label: 'Inventory',         icon: 'box'      },
    { id: 'ai',          label: 'AI Insights',       icon: 'ai'       },
    { id: 'staff',       label: 'Staff & Ops',       icon: 'staff'    },
    { id: 'engagement',  label: 'Engagement',        icon: 'engage'   },
    { id: 'bi',          label: 'Report Builder',    icon: 'bi'       },
    { id: 'reports',     label: 'Reports',           icon: 'report'   },
    { id: 'alerts',      label: 'Alert Center',      icon: 'bell'     },
  ],
  admin: [
    { id: 'admin',       label: 'Admin Dashboard',   icon: 'globe'    },
    { id: 'dashboard',   label: 'Live Dashboard',    icon: 'chart'    },
    { id: 'live',        label: 'Live Monitor',      icon: 'monitor'  },
    { id: 'jobs',        label: 'All Jobs',           icon: 'video'    },
    { id: 'crossings',   label: 'Footfall Log',      icon: 'people'   },
    { id: 'trends',      label: 'Trends',            icon: 'trend'    },
    { id: 'sales',       label: 'Sales & Marketing', icon: 'sales'    },
    { id: 'inventory',   label: 'Inventory',         icon: 'box'      },
    { id: 'security',    label: 'Loss Prevention',   icon: 'shield'   },
    { id: 'enterprise',  label: 'Enterprise',        icon: 'globe'    },
    { id: 'ai',          label: 'AI Insights',       icon: 'ai'       },
    { id: 'staff',       label: 'Staff & Ops',       icon: 'staff'    },
    { id: 'compliance',  label: 'Compliance',        icon: 'comply'   },
    { id: 'engagement',  label: 'Engagement',        icon: 'engage'   },
    { id: 'bi',          label: 'Report Builder',    icon: 'bi'       },
    { id: 'platform',    label: 'Platform Config',   icon: 'platform' },
    { id: 'edge',        label: 'Edge & Cameras',    icon: 'edge'     },
    { id: 'reports',     label: 'Reports',           icon: 'report'   },
    { id: 'alerts',      label: 'Alert Center',      icon: 'bell'     },
  ],
};

const DEFAULT_PAGE = { store_manager: 'dashboard', analyst: 'dashboard', admin: 'admin' };
const PAGE_TITLES  = {
  dashboard: 'Live Dashboard',      live: 'Live Monitor',          jobs: 'Video Jobs',
  crossings: 'Footfall Log',        alerts: 'Alert Center',        settings: 'Settings',
  trends: 'Historical Trends',      reports: 'Export Reports',
  sales: 'Sales & Marketing',       inventory: 'Inventory & Shelves',
  security: 'Loss Prevention',      enterprise: 'Enterprise & Integrations',
  ai: 'AI Insights & Forecasting',  staff: 'Staff & Operations',
  compliance: 'Compliance & Safety',engagement: 'Customer Engagement',
  bi: 'Report Builder',             platform: 'Platform Config',
  edge: 'Edge & Cameras',           admin: 'Admin Control Center',
};
const ROLE_LABELS = { store_manager: 'Store Manager', analyst: 'Analyst', admin: 'Admin' };

function NavIcon({ name }) {
  const icons = {
    chart:   <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    video:   <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>,
    people:  <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    bell:    <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    globe:   <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    gear:    <><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    logout:  <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></>,
    trend:   <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    report:  <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    sales:   <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    box:     <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></>,
    shield:  <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    ai:       <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></>,
    staff:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="21" x2="23" y2="19"/><line x1="19" y1="21" x2="19" y2="19"/><path d="M21 15a2 2 0 0 1 0 4"/></>,
    comply:   <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    engage:   <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    bi:       <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>,
    platform: <><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></>,
    edge:     <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="2"/></>,
  };
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.monitor}
    </svg>
  );
}

function Layout({ children, page, setPage }) {
  const { user, company, logout, getStats } = useAppStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifData, setNotifData] = useState({ notifications: [], unread: 0 });
  const API_BASE = 'http://localhost:8000';

  useEffect(() => {
    const fetchNotifs = () => {
      authFetch(`${API_BASE}/dashboard/notifications`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setNotifData(d); })
        .catch(() => {});
    };
    fetchNotifs();
    const t = setInterval(fetchNotifs, 15000);
    return () => clearInterval(t);
  }, []);

  const stats    = getStats();
  const role     = user?.role || 'store_manager';
  const navItems = NAV[role] || NAV.store_manager;
  const initials = (user?.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const { wsConnected } = useAppStore();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('retail_dark') === '1');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('retail_dark', darkMode ? '1' : '0');
  }, [darkMode]);

  return (
    <div className="app-layout">
      <nav className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <div className="logo-text">RetailVision</div>
            <div className="logo-sub">{company?.store || 'AI Analytics'}</div>
          </div>
        </div>

        {/* Plan badge */}
        {company?.plan && (
          <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Plan</span>
            <span className={`badge badge-${company.plan}`}>{company.plan}</span>
          </div>
        )}

        {/* Nav */}
        <div className="sidebar-section">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map(item => (
            <div key={item.id}
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon"><NavIcon name={item.icon}/></span>
              {item.label}
              {item.id === 'alerts' && stats.unread > 0 && (
                <span className="nav-badge">{stats.unread > 99 ? '99+' : stats.unread}</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: '4px 12px' }}>
          <div className={`nav-item${page === 'settings' ? ' active' : ''}`} onClick={() => setPage('settings')}>
            <span className="nav-icon"><NavIcon name="gear"/></span>Settings
          </div>
        </div>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="user-card" onClick={logout} title="Sign out">
            <div className="user-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div className="user-role">{ROLE_LABELS[user?.role] || user?.role}</div>
            </div>
            <NavIcon name="logout"/>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">{PAGE_TITLES[page] || page}</div>
            <div className="topbar-breadcrumb">
              <span>{company?.name}</span><span>·</span><span>{ROLE_LABELS[user?.role] || user?.role}</span>
            </div>
          </div>
          <div className="topbar-right">
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <div className="notif-bell" onClick={() => setNotifOpen(p => !p)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke={notifData.unread > 0 ? 'var(--red)' : 'var(--text-muted)'}
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {notifData.unread > 0 && <div className="notif-dot"/>}
              </div>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>🔔 Notifications</span>
                    <span style={{ fontSize: 11, background: 'var(--red-light)', color: 'var(--red)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                      {notifData.unread} unread
                    </span>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {notifData.notifications.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>✅ All caught up!</div>
                    ) : notifData.notifications.map((n, i) => (
                      <div key={n.id || i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 14 }}>{n.type === 'CRITICAL' ? '🔴' : n.type === 'HIGH' ? '🟡' : '🔵'}</span>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{n.title}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 22 }}>{n.message}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-light)', marginLeft: 22, marginTop: 2 }}>
                          {n.time ? new Date(n.time).toLocaleTimeString('en-GB', { hour12: false }) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <button onClick={() => { setPage('alerts'); setNotifOpen(false); }}
                      style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                      View all alerts →
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '4px 12px', background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'livePulse 1.5s infinite' }}/>
              LIVE
            </div>
            {/* WS status */}
            <div style={{ padding: '4px 10px', background: wsConnected ? 'var(--green-light)' : 'var(--amber-light)', border: `1px solid ${wsConnected ? 'var(--green-border)' : 'var(--amber-border)'}`, borderRadius: 20, fontSize: 10, fontWeight: 600, color: wsConnected ? 'var(--green)' : 'var(--amber)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: wsConnected ? 'var(--green)' : 'var(--amber)' }}/>
              WS {wsConnected ? 'ON' : 'OFF'}
            </div>
            {/* Dark mode toggle */}
            <button className="dark-toggle" onClick={() => setDarkMode(d => !d)} title="Toggle dark mode">
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        <div className="page-content page-enter">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, token } = useAppStore();
  const [page,          setPage]          = useState(null);
  const [jobs,          setJobs]          = useState([]);
  const [analyticsJobId, setAnalyticsJobId] = useState(null);

  useEffect(() => {
    if (user) setPage(DEFAULT_PAGE[user.role] || 'dashboard');
  }, [user?.role]);

  const refreshJobs = useCallback(() => {
    fetch(`${API_BASE_APP}/jobs/`)
      .then(r => r.ok ? r.json() : { jobs: [] })
      .then(d => setJobs(d.jobs || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) refreshJobs();
    const t = setInterval(refreshJobs, 5000);
    return () => clearInterval(t);
  }, [user]);

  if (!token || !user) return <Login/>;

  function renderPage(p) {
    switch (p) {
      case 'dashboard': return <Dashboard/>;
      case 'live':      return <LiveMonitor/>;
      case 'jobs':      return <Jobs jobs={jobs} onRefresh={refreshJobs} onSelectJob={(jid) => { setAnalyticsJobId(jid); setPage('analytics'); }} selectedJobId={analyticsJobId}/>;
      case 'analytics': return <JobAnalytics jobId={analyticsJobId} onBack={() => setPage('jobs')}/>;
      case 'crossings': return <Crossings/>;
      case 'alerts':    return <Alerts/>;
      case 'trends':    return <Trends/>;
      case 'reports':   return <Reports/>;
      case 'sales':     return <Sales/>;
      case 'inventory': return <Inventory/>;
      case 'security':  return <Security/>;
      case 'enterprise':  return <Enterprise/>;
      case 'ai':           return <AIInsights/>;
      case 'staff':        return <StaffOps/>;
      case 'compliance':   return <Compliance/>;
      case 'engagement':   return <Engagement/>;
      case 'bi':           return <ReportBuilder/>;
      case 'platform':     return <PlatformConfig/>;
      case 'edge':         return <EdgeConfig/>;
      case 'admin':        return <AdminDashboard/>;
      case 'settings':     return <Settings/>;
      default:             return <Dashboard/>;
    }
  }

  return (
    <Layout page={page} setPage={setPage}>
      {renderPage(page)}
      <WsToastContainer/>
    </Layout>
  );
}
