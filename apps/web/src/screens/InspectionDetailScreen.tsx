import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  apiGetInspection,
  apiGetExtractions,
  apiGetFindings,
  apiReviewFinding,
  apiGenerateReport,
  apiGetReportDownloadUrl,
  apiGetImageOriginalUrl,
  getStoredUser,
  type Inspection,
  type InspectionImage,
  type ExtractionSnapshot,
  type Finding,
} from '../lib/api';

export function InspectionDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const user = getStoredUser();

  const [inspection, setInspection] = useState<(Inspection & { images: InspectionImage[] }) | null>(null);
  const [extractions, setExtractions] = useState<ExtractionSnapshot | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review modal state
  const [reviewingFinding, setReviewingFinding] = useState<Finding | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'confirm' | 'reject' | 'edit'>('confirm');
  const [reviewNote, setReviewNote] = useState('');
  const [editedOutcome, setEditedOutcome] = useState('PASS');
  const [reviewLoading, setReviewLoading] = useState(false);

  // Report state
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadInspectionData(id);
    }
  }, [id]);

  const loadInspectionData = async (inspectionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [insp, ext, find] = await Promise.all([
        apiGetInspection(inspectionId),
        apiGetExtractions(inspectionId).catch(() => null),
        apiGetFindings(inspectionId).catch(() => []),
      ]);

      setInspection(insp);
      setExtractions(ext);
      setFindings(find);
      if (find.length > 0 && find[0]) {
        setSelectedFinding(find[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load inspection details');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingFinding) return;

    setReviewLoading(true);
    try {
      await apiReviewFinding(reviewingFinding.id, {
        decision: reviewDecision,
        note: reviewNote,
        editedOutcome: reviewDecision === 'edit' ? editedOutcome : undefined,
      });

      setReviewingFinding(null);
      setReviewNote('');
      if (id) await loadInspectionData(id);
    } catch (err: any) {
      alert(`Review action failed: ${err.message}`);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!id) return;
    setGeneratingReport(true);
    try {
      const res = await apiGenerateReport(id);
      setReportId(res.id);
      window.open(apiGetReportDownloadUrl(res.id), '_blank');
    } catch (err: any) {
      alert(`Report generation failed: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Legal Metrology inspection results...</p>
      </div>
    );
  }

  if (error || !inspection) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <h3 style={{ color: '#f87171' }}>Error Loading Inspection</h3>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>{error || 'Inspection not found'}</p>
        <Link to="/history" className="btn btn-secondary">
          ← Back to History
        </Link>
      </div>
    );
  }

  const primaryImage = inspection.images?.[0];
  const passedFindings = findings.filter((f) => f.outcome === 'PASS');
  const issueFindings = findings.filter((f) => f.outcome === 'POTENTIAL_NON_COMPLIANCE');
  const reviewFindings = findings.filter((f) => f.outcome === 'NEEDS_VERIFICATION' || f.outcome === 'NOT_APPLICABLE');

  return (
    <div>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/history" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← History
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#fff' }}>
            {inspection.id.slice(0, 13)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerateReport}
            disabled={generatingReport}
          >
            {generatingReport ? 'Generating PDF...' : '📄 Download Statutory Notice / Report'}
          </button>
        </div>
      </div>

      {/* Hero Outcome Banner */}
      <div
        className="card"
        style={{
          borderLeft: `6px solid ${
            inspection.overallOutcome === 'PASS'
              ? 'var(--accent-green)'
              : inspection.overallOutcome === 'POTENTIAL_NON_COMPLIANCE'
              ? 'var(--accent-red)'
              : 'var(--accent-saffron)'
          }`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>
                {inspection.locationNote || 'Packaged Commodity Specimen'}
              </h2>
              {inspection.overallOutcome === 'PASS' && (
                <span className="badge badge-pass">PASS • COMPLIANT</span>
              )}
              {inspection.overallOutcome === 'POTENTIAL_NON_COMPLIANCE' && (
                <span className="badge badge-potential">POTENTIAL NON-COMPLIANCE DETECTED</span>
              )}
              {inspection.overallOutcome === 'NEEDS_VERIFICATION' && (
                <span className="badge badge-needs-verification">NEEDS VERIFICATION</span>
              )}
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Audit Date: <strong style={{ color: '#fff' }}>{inspection.referenceDate}</strong> • Reference ID:{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>{inspection.id}</span>
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Compliance Status
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: inspection.overallOutcome === 'PASS' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {findings.length > 0 ? `${passedFindings.length} / ${findings.length} Checks Passed` : 'Evaluation Pending'}
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Layout: Evidence Viewer & Findings List */}
      <div className="grid-2" style={{ alignItems: 'flex-start' }}>
        {/* Left Column: Specimen Image & Interactive Evidence Overlay */}
        <div>
          <div className="card">
            <div className="card-title">
              <span>Specimen Evidence & Principal Display Panel</span>
              {primaryImage && (
                <span className="badge badge-pass" style={{ fontSize: '0.7rem' }}>
                  ✓ Quality Checked
                </span>
              )}
            </div>

            <div className="image-preview-container">
              {primaryImage ? (
                <>
                  <img
                    src={apiGetImageOriginalUrl(primaryImage.id)}
                    alt="Packaging Specimen"
                    className="preview-img"
                    onError={(e) => {
                      // Fallback placeholder image if local file isn't directly on disk
                      (e.target as HTMLImageElement).src =
                        'https://placehold.co/600x400/0f172a/94a3b8?text=Packaging+Specimen+Principal+Display+Panel';
                    }}
                  />
                  {selectedFinding?.evidence?.[0]?.boundingBox && (
                    <div
                      className="bbox-overlay"
                      style={{
                        top: `${(selectedFinding.evidence[0].boundingBox.y / 500) * 100}%`,
                        left: `${(selectedFinding.evidence[0].boundingBox.x / 600) * 100}%`,
                        width: `${Math.max((selectedFinding.evidence[0].boundingBox.width / 600) * 100, 15)}%`,
                        height: `${Math.max((selectedFinding.evidence[0].boundingBox.height / 500) * 100, 8)}%`,
                      }}
                    >
                      <span className="bbox-tag">
                        {selectedFinding.rule?.ruleCode || 'EVIDENCE'}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No image attached to this inspection.
                </div>
              )}
            </div>

            {/* Selected Finding Evidence Details */}
            {selectedFinding && (
              <div style={{ marginTop: '1rem', backgroundColor: 'var(--bg-input)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-saffron)', textTransform: 'uppercase' }}>
                    Linked Evidence: {selectedFinding.rule?.ruleCode} • {selectedFinding.ruleVersion?.clauseReference || 'LMPC 2011'}
                  </span>
                  <span className={`badge ${selectedFinding.outcome === 'PASS' ? 'badge-pass' : 'badge-potential'}`}>
                    {selectedFinding.outcome}
                  </span>
                </div>

                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Detected Value: </span>
                    <strong style={{ color: '#fff' }}>{selectedFinding.detectedValue || 'None / Missing'}</strong>
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Statutory Requirement: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{selectedFinding.expectedRequirement}</span>
                  </div>
                </div>

                {selectedFinding.evidence?.[0]?.ocrSnippet && (
                  <div style={{ marginTop: '0.5rem', backgroundColor: 'rgba(0,0,0,0.4)', padding: '0.5rem', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#93c5fd' }}>
                    🔍 OCR Snippet: "{selectedFinding.evidence[0].ocrSnippet}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Extracted Structured Declarations Table */}
          <div className="card">
            <div className="card-title">
              <span>Extracted Statutory Declarations</span>
            </div>

            {extractions?.fields && extractions.fields.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Declaration</th>
                      <th>Extracted Value</th>
                      <th>Confidence</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractions.fields.map((field, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{field.fieldKey.replace(/_/g, ' ')}</td>
                        <td style={{ color: '#fff' }}>{field.normalizedValue || field.rawValue || '—'}</td>
                        <td>{(field.confidence * 100).toFixed(0)}%</td>
                        <td>
                          {field.needsReview ? (
                            <span className="badge badge-needs-verification" style={{ fontSize: '0.65rem' }}>Review</span>
                          ) : (
                            <span className="badge badge-pass" style={{ fontSize: '0.65rem' }}>Verified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No structured declarations extracted.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Deterministic Rule Adjudication Findings */}
        <div>
          {/* Potential Non-Compliances Section */}
          {issueFindings.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
              <div className="card-title" style={{ color: '#f87171' }}>
                <span>⚠️ Potential Non-Compliance Findings ({issueFindings.length})</span>
              </div>

              {issueFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="finding-card"
                  style={{
                    borderColor: selectedFinding?.id === finding.id ? '#ef4444' : 'var(--border-light)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedFinding(finding)}
                >
                  <div className="finding-header">
                    <div>
                      <div className="finding-title">{finding.rule?.title || 'Mandatory Declaration Check'}</div>
                      <div className="finding-rule">
                        {finding.rule?.ruleCode} • {finding.ruleVersion?.clauseReference || 'LMPC 2011'}
                      </div>
                    </div>
                    <span className="badge badge-potential">NON-COMPLIANT</span>
                  </div>

                  <p className="finding-desc">{finding.explanation}</p>

                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Review Status: <strong style={{ color: '#fff' }}>{finding.reviewerState}</strong>
                    </span>
                    {(user?.role === 'reviewer' || user?.role === 'administrator') && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReviewingFinding(finding);
                        }}
                      >
                        ⚖️ Review Action
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Needs Verification Section */}
          {reviewFindings.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
              <div className="card-title" style={{ color: '#fbbf24' }}>
                <span>🔍 Needs Verification / Context Items ({reviewFindings.length})</span>
              </div>

              {reviewFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="finding-card"
                  style={{
                    borderColor: selectedFinding?.id === finding.id ? '#f59e0b' : 'var(--border-light)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedFinding(finding)}
                >
                  <div className="finding-header">
                    <div>
                      <div className="finding-title">{finding.rule?.title || 'Context Verification'}</div>
                      <div className="finding-rule">
                        {finding.rule?.ruleCode} • {finding.ruleVersion?.clauseReference || 'LMPC 2011'}
                      </div>
                    </div>
                    <span className="badge badge-needs-verification">REVIEW</span>
                  </div>

                  <p className="finding-desc">{finding.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {/* Passed Checks Section */}
          <div className="card">
            <div className="card-title" style={{ color: '#34d399' }}>
              <span>✓ Verified Compliant Rules ({passedFindings.length})</span>
            </div>

            {passedFindings.map((finding) => (
              <div
                key={finding.id}
                className="finding-card"
                style={{
                  borderColor: selectedFinding?.id === finding.id ? '#10b981' : 'var(--border-light)',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedFinding(finding)}
              >
                <div className="finding-header">
                  <div>
                    <div className="finding-title">{finding.rule?.title}</div>
                    <div className="finding-rule" style={{ color: 'var(--text-secondary)' }}>
                      {finding.rule?.ruleCode} • {finding.ruleVersion?.clauseReference}
                    </div>
                  </div>
                  <span className="badge badge-pass">PASS</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviewer Action Modal */}
      {reviewingFinding && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>
                Human Officer Review Action
              </h3>
              <button
                type="button"
                className="btn-logout"
                style={{ fontSize: '1.2rem' }}
                onClick={() => setReviewingFinding(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Adjudicating Finding for <strong>{reviewingFinding.rule?.ruleCode}</strong> ({reviewingFinding.ruleVersion?.clauseReference}):
            </p>

            <form onSubmit={handleReviewSubmit}>
              <div className="form-group">
                <label className="form-label">Review Decision</label>
                <select
                  className="form-input"
                  value={reviewDecision}
                  onChange={(e) => setReviewDecision(e.target.value as any)}
                >
                  <option value="confirm">Confirm Finding (Endorse Potential Non-Compliance)</option>
                  <option value="reject">Reject Finding (False Positive / Not Actionable)</option>
                  <option value="edit">Edit Finding Outcome</option>
                </select>
              </div>

              {reviewDecision === 'edit' && (
                <div className="form-group">
                  <label className="form-label">Adjusted Statutory Outcome</label>
                  <select
                    className="form-input"
                    value={editedOutcome}
                    onChange={(e) => setEditedOutcome(e.target.value)}
                  >
                    <option value="PASS">PASS (Compliant)</option>
                    <option value="POTENTIAL_NON_COMPLIANCE">POTENTIAL NON-COMPLIANCE</option>
                    <option value="NEEDS_VERIFICATION">NEEDS VERIFICATION</option>
                    <option value="NOT_APPLICABLE">NOT APPLICABLE</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Officer Justification / Review Note</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="State statutory rationale for this adjudication decision..."
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReviewingFinding(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={reviewLoading}
                >
                  {reviewLoading ? 'Recording Action...' : 'Save Review Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
