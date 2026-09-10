import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiLogin } from '../lib/api';

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('inspector@packcheck.local');
  const [password, setPassword] = useState('PackCheckInspector!dev');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiLogin(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: 'inspector' | 'reviewer' | 'admin') => {
    if (role === 'inspector') {
      setEmail('inspector@packcheck.local');
      setPassword('PackCheckInspector!dev');
    } else if (role === 'reviewer') {
      setEmail('reviewer@packcheck.local');
      setPassword('PackCheckReviewer!dev');
    } else {
      setEmail('admin@packcheck.local');
      setPassword('PackCheckAdmin!dev');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '80vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div className="brand-icon" style={{ width: '48px', height: '48px', margin: '0 auto 1rem auto', fontSize: '1.5rem' }}>
            ⚖️
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>PackCheck AI</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Legal Metrology Packaged Commodities Inspection System
          </p>
          <div className="badge badge-needs-verification" style={{ marginTop: '0.5rem' }}>
            SIH 2026 • PS26034
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Officer Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center' }}>
            DEMO PRESET ACCOUNTS
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('inspector')}
            >
              Inspector
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('reviewer')}
            >
              Reviewer
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('admin')}
            >
              Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
