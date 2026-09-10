import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCreateInspection, apiUploadImage, apiRunExtraction } from '../lib/api';

const SAMPLE_PRESETS = [
  {
    id: 'cookies',
    title: 'NutriDelight Almond Cookies (400g)',
    desc: 'Triggers Rule 6(1)(e) MRP inclusive statement non-compliance',
    filename: 'nutridelight-cookies-specimen.jpg',
    location: 'Supermarket Shelf Audit, Noida Sector 62',
    date: '2026-09-10',
    type: 'Snack Commodity',
  },
  {
    id: 'honey',
    title: 'Himalayan Organic Raw Honey (500g)',
    desc: 'Fully compliant packaged food commodity under LMPC 2011',
    filename: 'himalayan-honey-specimen.jpg',
    location: 'E-Commerce Marketplace Listing Audit',
    date: '2026-09-10',
    type: 'Food Commodity',
  },
  {
    id: 'gel',
    title: 'UltraClean Fabric Wash Gel (1L)',
    desc: 'Triggers Rule 6(1)(c) non-standard metric unit (1000 ml vs 1 L)',
    filename: 'ultraclean-gel-specimen.jpg',
    location: 'Retail Distribution Warehouse, Vapi',
    date: '2026-09-10',
    type: 'Non-Food Commodity',
  },
];

export function NewInspectionScreen() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [referenceDate, setReferenceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [locationNote, setLocationNote] = useState<string>('Retail Packaged Specimen Audit');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setSelectedPreset(null);
    }
  };

  const handleSelectPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setSelectedPreset(preset.id);
    setLocationNote(`${preset.title} • ${preset.location}`);
    setReferenceDate(preset.date);
    
    // Create a virtual file with specimen filename
    const dummyBlob = new Blob(['sample-specimen-bytes'], { type: 'image/jpeg' });
    const virtualFile = new File([dummyBlob], preset.filename, { type: 'image/jpeg' });
    setSelectedFile(virtualFile);
    setPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please upload a packaging image or select a sample specimen.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCurrentStep(1);

    try {
      // Step 1 & 2: Create inspection in PostgreSQL
      const inspection = await apiCreateInspection({ referenceDate, locationNote });
      setCurrentStep(2);

      // Step 3: Upload image file to backend object storage
      await apiUploadImage(inspection.id, selectedFile, 'Principal Display Panel (PDP)');
      setCurrentStep(3);

      // Step 4 & 5 & 6: AI/OCR Extraction + Normalization + Deterministic Rules
      await new Promise((r) => setTimeout(r, 600)); // smooth visual transition
      setCurrentStep(4);
      await new Promise((r) => setTimeout(r, 600));
      setCurrentStep(5);

      await apiRunExtraction(inspection.id);
      setCurrentStep(6);
      await new Promise((r) => setTimeout(r, 500));
      setCurrentStep(7);

      // Redirect to Inspection Results page
      navigate(`/inspections/${inspection.id}`);
    } catch (err: any) {
      setError(err.message || 'Inspection pipeline failed. Please check backend.');
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Packaged Commodity Inspection</h1>
          <p className="page-subtitle">
            Upload physical packaging photographs or test specimens for statutory compliance adjudication.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* Stepper Display During Processing */}
      {isProcessing ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>
            Running Automated Statutory Compliance Pipeline
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
            Processing specimen declarations through deterministic Legal Metrology rules...
          </p>

          <div className="stepper">
            {[
              { num: 1, label: 'Intake' },
              { num: 2, label: 'Ingestion' },
              { num: 3, label: 'Quality' },
              { num: 4, label: 'Vision OCR' },
              { num: 5, label: 'Facts' },
              { num: 6, label: 'Rule Engine' },
              { num: 7, label: 'Adjudication' },
            ].map((step) => (
              <div
                key={step.num}
                className={`step-item ${currentStep === step.num ? 'active' : currentStep > step.num ? 'complete' : ''}`}
              >
                <div className="step-bubble">
                  {currentStep > step.num ? '✓' : step.num}
                </div>
                <span className="step-label">{step.label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2rem', display: 'inline-flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--bg-surface)', padding: '0.75rem 1.5rem', borderRadius: '9999px' }}>
            <div className="badge badge-needs-verification" style={{ animation: 'pulse 1.5s infinite' }}>
              ● PROCESSING
            </div>
            <span style={{ fontSize: '0.85rem', color: '#fff' }}>
              {currentStep === 1 && 'Initializing inspection record in PostgreSQL...'}
              {currentStep === 2 && 'Uploading specimen image to object storage...'}
              {currentStep === 3 && 'Validating image quality & resolution...'}
              {currentStep === 4 && 'Running multimodal OCR on Principal Display Panel...'}
              {currentStep === 5 && 'Structuring and normalizing extracted declarations...'}
              {currentStep === 6 && 'Evaluating active LMPC 2011 deterministic rules...'}
              {currentStep === 7 && 'Linking evidence coordinates and finalizing findings...'}
            </span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Quick Presets Row */}
          <div className="card">
            <div className="card-title">
              <span>1-Click Test Specimen Presets (SIH Demo)</span>
              <span className="badge badge-needs-verification">Demo Helper</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Select a pre-configured packaged commodity specimen to test specific rule conditions instantly:
            </p>
            <div className="grid-3">
              {SAMPLE_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="specimen-chip"
                  style={{
                    border: selectedPreset === preset.id ? '2px solid #3b82f6' : '1px solid var(--border-light)',
                    backgroundColor: selectedPreset === preset.id ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface)',
                  }}
                  onClick={() => handleSelectPreset(preset)}
                >
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{preset.title}</div>
                  <div style={{ color: 'var(--accent-saffron)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {preset.desc}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                    📁 {preset.filename}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload Dropzone */}
          <div className="card">
            <div className="card-title">
              <span>Custom Specimen Label Upload</span>
            </div>

            <label className="dropzone" htmlFor="file-upload">
              <input
                id="file-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div className="dropzone-icon">📷</div>
              <div>
                <span style={{ fontWeight: 600, color: '#60a5fa' }}>Click to upload</span> or drag and drop image
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                PNG, JPG or WebP packaging images (Principal Display Panel)
              </p>
              {selectedFile && (
                <div className="badge badge-pass" style={{ marginTop: '0.5rem' }}>
                  ✓ Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </label>

            {previewUrl && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <p className="form-label">Specimen Preview</p>
                <img
                  src={previewUrl}
                  alt="Specimen Preview"
                  style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                />
              </div>
            )}
          </div>

          {/* Specimen Metadata */}
          <div className="card">
            <div className="card-title">
              <span>Inspection Parameters</span>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Inspection Reference Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Location / Audit Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  placeholder="e.g. Retail Store Shelf Scan, Connaught Place"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '1rem' }}
            >
              🚀 Submit Specimen for Legal Metrology Adjudication
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
