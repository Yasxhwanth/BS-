import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Login          from './Login';
import Dashboard      from './Dashboard';
import OntologyBuilder from './OntologyBuilder';
import Analytics      from './Analytics';
import Chat           from './Chat';
import Alerts         from './Alerts';

// ── Nav icons (inline SVG) ──────────────────────────────────
const Icons = {
  Dashboard:   <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 0h7v7H0V0zm9 0h7v7H9V0zM0 9h7v7H0V9zm9 0h7v7H9V9z"/></svg>,
  Ontology:    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="4" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><path d="M4 4h8M4 4l4 8m4-8l-4 8" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>,
  Analytics:   <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 16L5 9l3 4 3-8 5 5V16H0z"/></svg>,
  Chat:        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 0h16v11H9l-4 5V11H0V0z"/></svg>,
  Alerts:      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0L0 14h16L8 0zm0 5v5H7V5h1zm0 7a1 1 0 110-2 1 1 0 010 2z"/></svg>,
  Logout:      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 2H2v12h4v-2H4V4h2V2zm4 3l4 3-4 3V9H6V7h4V5z"/></svg>,
};

const NAV = [
  { path: '/',          label: 'Dashboard',           icon: Icons.Dashboard  },
  { path: '/ontology',  label: 'Digital Twin Studio', icon: Icons.Ontology },
  { path: '/analytics', label: 'Analytics',            icon: Icons.Analytics },
  { path: '/chat',      label: 'AI Assistant',         icon: Icons.Chat      },
  { path: '/alerts',    label: 'Alerts',               icon: Icons.Alerts    },
];

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aip_user')); } catch { return null; }
  });

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('aip_sidebar_width');
      return saved ? Math.min(Math.max(parseInt(saved, 10), 180), 480) : 256;
    } catch {
      return 256;
    }
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(e.clientX, 180), 480);
      setSidebarWidth(newWidth);
      try {
        localStorage.setItem('aip_sidebar_width', newWidth);
      } catch {}
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleDoubleClick = () => {
    setSidebarWidth(256);
    try {
      localStorage.setItem('aip_sidebar_width', 256);
    } catch {}
  };

  const handleLogin  = (u) => setUser(u);
  const handleLogout = () => {
    localStorage.removeItem('aip_token');
    localStorage.removeItem('aip_user');
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <div className="app-shell" style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}>

        {/* ── Header ── */}
        <header className="app-header">
          <a href="/" className="brand">
            <div className="brand-icon" />
            ManufactureAIP
          </a>
          <div style={{ fontSize: 11, color: 'var(--text-helper)', marginLeft: 8 }}>
            Manufacturing AI Platform
          </div>
          <div className="header-spacer" />
          <div className="user-badge">
            <span>{user.name}</span>
            <span className="role-tag">{user.role}</span>
            <span style={{ color: 'var(--text-helper)' }}>·</span>
            <span style={{ color: 'var(--text-helper)' }}>{user.department}</span>
          </div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={handleLogout} title="Sign out">
            {Icons.Logout}
          </button>
        </header>

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-section-label">Navigation</div>
          {NAV.map(n => (
            <NavLink key={n.path} to={n.path} end={n.path === '/'}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              {n.icon}
              <span className="sidebar-item-label">{n.label}</span>
            </NavLink>
          ))}
          <div style={{ flex: 1 }} />
          <div className="sidebar-section-label" style={{ marginTop: 32 }}>Platform</div>
          <div className="sidebar-item" style={{ fontSize: 12, color: 'var(--text-helper)' }}>
            <span>v1.0.0</span>
            <span>· MERN Stack</span>
          </div>

          {/* Resizer Handle */}
          <div
            className={`sidebar-resizer ${isResizing ? 'active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
            onDoubleClick={handleDoubleClick}
            title="Drag to resize sidebar, double-click to reset"
          />
        </aside>

        {/* ── Main Content ── */}
        <main className="main-content">
          <Routes>
            <Route path="/"          element={<Dashboard user={user} />} />
            <Route path="/ontology"  element={<OntologyBuilder />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/chat"      element={<Chat user={user} />} />
            <Route path="/alerts"    element={<Alerts />} />
            <Route path="*"          element={<Navigate to="/" />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}
