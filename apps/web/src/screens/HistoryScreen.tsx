import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiListInspections, type Inspection } from '../lib/api';

export function HistoryScreen() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [filterStatus]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiListInspections({
        pageSize: 50,
        status: filterStatus === 'ALL' ? undefined : filterStatus,
      });
      setInspections(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load inspection history');
    } finally {
      setLoading(false);
    }
  };

  const filtered = inspections.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.id.toLowerCase().includes(term) ||
      (item.locationNote || '').toLowerCase().includes(term) ||
      (item.referenceDate || '').includes(term)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inspection Audit History</h1>
          <p className="page-subtitle">
            Durable Legal Metrology inspection repository stored in PostgreSQL.
          </p>
        </div>
        <Link to="/inspections/new" className="btn btn-primary">
          + New Inspection
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Status Filter Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['ALL', 'PASS', 'POTENTIAL_NON_COMPLIANCE', 'NEEDS_VERIFICATION'].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${filterStatus === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterStatus(st)}
              >
                {st === 'ALL' ? 'All Audits' : st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div style={{ minWidth: '260px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search reference ID or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '1.5rem 0', textAlign: 'center' }}>
            Loading inspection records...
          </p>
        ) : error ? (
          <p style={{ color: '#f87171', padding: '1.5rem 0', textAlign: 'center' }}>{error}</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>No inspection records match the current filter.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference ID</th>
                  <th>Specimen / Description</th>
                  <th>Reference Date</th>
                  <th>Pipeline State</th>
                  <th>Legal Outcome</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {item.id.slice(0, 13)}...
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.locationNote || 'Packaged Commodity'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Created: {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </td>
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
                        Open Inspection →
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
