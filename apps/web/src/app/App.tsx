import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardScreen } from '../screens/DashboardScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { NewInspectionScreen } from '../screens/NewInspectionScreen';
import { RegulatoryAdminScreen } from '../screens/RegulatoryAdminScreen';

const links = [
  { to: '/login', label: 'Login' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/inspections/new', label: 'New inspection' },
  { to: '/history', label: 'History' },
  { to: '/regulatory', label: 'Regulatory admin' },
];

export function App() {
  return (
    <div className="app-shell">
      <nav aria-label="Primary">
        <h1>PackCheck AI</h1>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/inspections/new" element={<NewInspectionScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/regulatory" element={<RegulatoryAdminScreen />} />
        </Routes>
      </main>
    </div>
  );
}
