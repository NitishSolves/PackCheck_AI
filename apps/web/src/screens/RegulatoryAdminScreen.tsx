import React, { useEffect, useState } from 'react';
import { apiListRules, type RegulatoryRule } from '../lib/api';

export function RegulatoryAdminScreen() {
  const [rules, setRules] = useState<RegulatoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await apiListRules();
      setRules(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load statutory rules matrix');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Regulatory Authority & Rule Catalog</h1>
          <p className="page-subtitle">
            Legal Metrology (Packaged Commodities) Rules, 2011 • Department of Consumer Affairs
          </p>
        </div>
      </div>

      <div className="card" style={{ background: 'linear-gradient(135deg, #131f37, #1e293b)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
          Statutory Authority Hierarchy
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Rules are verified against Official Gazette notifications, India Code legislation, and Department of Consumer Affairs guidelines. All historical rule versions are immutable.
        </p>
      </div>

      <div className="card">
        <div className="card-title">
          <span>Active P0 Compliance Rule Catalog</span>
          <span className="badge badge-pass">Verified Active</span>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '1.5rem 0', textAlign: 'center' }}>
            Loading regulatory catalog...
          </p>
        ) : error ? (
          <p style={{ color: '#f87171', padding: '1.5rem 0', textAlign: 'center' }}>{error}</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule ID</th>
                  <th>Statutory Mandate</th>
                  <th>Legal Metrology Clause</th>
                  <th>Adjudication Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-saffron)' }}>
                      {rule.ruleCode}
                    </td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{rule.title}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {rule.clauseReference || 'LMPC Rules 2011'}
                    </td>
                    <td>
                      <span className="badge badge-na" style={{ fontSize: '0.7rem' }}>
                        Deterministic
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-pass" style={{ fontSize: '0.7rem' }}>
                        ACTIVE
                      </span>
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
