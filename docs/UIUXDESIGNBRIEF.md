# PackCheck AI — UI/UX Design Brief

## 1. Design Goal

Make the product look like an inspection instrument, not a generic AI SaaS dashboard.

Primary UX questions:
1. What did the system detect?
2. What failed or needs review?
3. Why?
4. What evidence supports the finding?
5. Which rule version was used?

## 2. Screens

1. Login
2. Dashboard
3. New Inspection
4. Image Upload/Capture
5. Processing
6. Extraction Review
7. Package Context
8. Compliance Results
9. Evidence Viewer
10. Inspection History
11. Report Preview
12. Rule Detail
13. Regulatory Admin

## 3. Results hierarchy

```text
Overall status
↓
Passed / Review / Potential Issues
↓
Finding
↓
Evidence
↓
Rule
↓
Reviewer action
```

## 4. Finding card

Show:
- finding;
- severity;
- detected value;
- expected requirement;
- evidence image;
- rule ID/version;
- source;
- explanation;
- reviewer state.

## 5. Evidence viewer

Support zoom, pan, bounding boxes, crop, original image and extracted text.

## 6. Rule drawer

Show rule ID, version, requirement, applicability, effective date, source authority, source document, clause and verification status. Provide an official-source link.

## 7. UX copy

Use: “Potential non-compliance detected.”
Use: “Needs verification.”
Avoid: “AI says this is illegal.”
Avoid: “100% legally compliant.”

## 8. Accessibility

Keyboard support, readable contrast, visible focus states, semantic HTML, and status not conveyed by color alone.
