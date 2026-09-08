# PackCheck AI — APP FLOW

## Inspection flow

```text
Login
→ Dashboard
→ New Inspection
→ Upload/Capture Package Images
→ Image Quality Gate
→ OCR + CV
→ Extraction Review
→ Package Context
→ Applicable Rule Version
→ Compliance Engine
→ Findings + Evidence
→ Human Review
→ Finalize
→ PDF Report
→ History
```

## Regulatory update flow

```text
Official Source
→ Register Document
→ Store Hash/Metadata
→ Extract Proposed Change
→ Human Verification
→ Create Rule Version
→ Regression Tests
→ Scheduled Activation
```

Draft material never becomes ACTIVE automatically.

## Error flows

Poor image → request retake.
Low OCR confidence → REVIEW.
Unknown applicability → REVIEW.
No verified rule → REVIEW.
Conflicting fields → finding + review.

## Winning demo flow

1. Show a real package.
2. Scan/upload.
3. Show OCR and detected declarations.
4. Show package context.
5. Run rule engine.
6. Open one finding.
7. Highlight evidence.
8. Open rule/source.
9. Confirm finding.
10. Generate report.
11. Show history.
12. Show rule-version change demo using a verified real amendment or clearly synthetic test rule.
