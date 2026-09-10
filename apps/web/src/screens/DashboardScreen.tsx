import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiListInspections, getStoredUser, type Inspection } from '../lib/api';

export function DashboardScreen() {
  const user = getStoredUser();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiListInspections({ pageSize: 20 });
      setInspections(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load inspections');
    } finally {
      setLoading(false);
    }
  };

  const total = inspections.length;
  const passCount = inspections.filter((i) => i.overallOutcome === 'PASS').length;
  const issueCount = inspections.filter((i) => i.overallOutcome === 'POTENTIAL_NON_COMPLIANCE').length;
  const reviewCount = inspections.filter((i) => i.overallOutcome === 'NEEDS_VERIFICATION' || i.status === 'review_pending').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Inspection Dashboard</h1>
          <p className="page-subtitle">
            Welcome, {user?.displayName || 'Officer'} • Legal Metrology Department Circle
          </p>
        </div>
        <Link to="/inspections/new" className="btn btn-primary">
          + Start New Inspection
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <span className="stat-label">Total Audits</span>
          <span className="stat-value">{total}</span>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
          <span className="stat-label" style={{ color: 'var(--accent-green)' }}>Compliant (PASS)</span>
          <span className="stat-value" style={{ color: 'var(--accent-green)' }}>{passCount}</span>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <span className="stat-label" style={{ color: 'var(--accent-red)' }}>Potential Non-Compliance</span>
          <span className="stat-value" style={{ color: 'var(--accent-red)' }}>{issueCount}</span>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
          <span className="stat-label" style={{ color: 'var(--accent-saffron)' }}>Needs Verification</span>
          <span className="stat-value" style={{ color: 'var(--accent-saffron)' }}>{reviewCount}</span>
        </div>
      </div>

      {/* Quick Launch & Guidelines Card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #131f37, #1e293b)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
              Standard Compliance Pipeline (LMPC Rules, 2011)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Every declaration is evaluated through deterministic validation operators with statutory evidence linking.
            </p>
          </div>
          <Link to="/inspections/new" className="btn btn-primary">
            Launch Inspection Engine →
          </Link>
        </div>
      </div>

      {/* Recent Inspections Table */}
      <div className="card">
        <div className="card-title">
          <span>Recent Audited Packages</span>
          <Link to="/history" style={{ fontSize: '0.85rem', color: '#60a5fa', textDecoration: 'none' }}>
            View All →
          </Link>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Loading inspection records...</p>
        ) : error ? (
          <p style={{ color: '#f87171', padding: '1rem 0' }}>{error}</p>
        ) : inspections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>No inspections recorded yet.</p>
            <Link to="/inspections/new" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}>
              Create First Inspection
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference ID</th>
                  <th>Location / Note</th>
                  <th>Inspection Date</th>
                  <th>Status</th>
                  <th>Outcome</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {inspections.slice(0, 8).map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {item.id.slice(0, 8)}...
                    </td>
                    <td>{item.locationNote || 'Package Specimen'}</td>
                    <td>{item.referenceDate}</td>
                    <td>
                      <span className="badge badge-na" style={{ fontSize: '0.7rem' }}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {item.overallOutcome === 'PASS' && (
                        <span className="badge badge-pass">PASS</span>
                      )}
                      {item.overallOutcome === 'POTENTIAL_NON_COMPLIANCE' && (
                        <span className="badge badge-potential">NON-COMPLIANT</span>
                      )}
                      {item.overallOutcome === 'NEEDS_VERIFICATION' && (
                        <span className="badge badge-needs-verification">REVIEW</span>
                      )}
                      {!item.overallOutcome && (
                        <span className="badge badge-na">PENDING</span>
                      )}
                    </td>
                    <td>
                      <Link to={`/inspections/${item.id}`} className="btn btn-secondary btn-sm">
                        View Results
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
