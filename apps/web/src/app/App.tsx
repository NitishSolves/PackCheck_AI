import React, { useState, useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { DashboardScreen } from '../screens/DashboardScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { NewInspectionScreen } from '../screens/NewInspectionScreen';
import { InspectionDetailScreen } from '../screens/InspectionDetailScreen';
import { RegulatoryAdminScreen } from '../screens/RegulatoryAdminScreen';
import { getStoredUser, apiLogout, type User } from '../lib/api';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/inspections/new', label: 'New Inspection', icon: '🔍' },
  { to: '/history', label: 'Inspection History', icon: '📁' },
  { to: '/regulatory', label: 'Regulatory Rules', icon: '⚖️' },
];

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(getStoredUser());

  useEffect(() => {
    setUser(getStoredUser());
  }, [location.pathname]);

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
    navigate('/login');
  };

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="app-shell">
      {!isLoginPage && (
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon">⚖️</div>
            <div>
              <div className="brand-title">PackCheck AI</div>
              <div className="brand-subtitle">Govt of India • Metrology</div>
            </div>
          </div>

          <nav className="nav-links">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-user">
            <div className="user-info">
              <span className="user-name">{user?.displayName || 'Officer'}</span>
              <span className="user-role">{user?.role || 'Inspector'}</span>
            </div>
            <button
              type="button"
              className="btn-logout"
              title="Sign Out"
              onClick={handleLogout}
            >
              🚪
            </button>
          </div>
        </aside>
      )}

      <main className="main-content" style={isLoginPage ? { padding: '1rem', width: '100%', maxWidth: '100%' } : {}}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/inspections/new" element={<NewInspectionScreen />} />
          <Route path="/inspections/:id" element={<InspectionDetailScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/regulatory" element={<RegulatoryAdminScreen />} />
        </Routes>
      </main>
    </div>
  );
}
