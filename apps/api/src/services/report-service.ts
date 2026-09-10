import {
  REPORT_DISCLAIMER,
  findingOutcomeWording,
  type PublicUser,
} from '@packcheck/shared';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { buildTextPdf } from '../reports/pdf.js';
import type {
  AuditRepository,
  ExtractionRepository,
  FindingRepository,
  ImageRepository,
  InspectionRecord,
  InspectionRepository,
  ReportRepository,
} from '../repositories/types.js';
import type { ObjectStorage } from '../storage/object-storage.js';

export class ReportService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly inspections?: InspectionRepository,
    private readonly findings?: FindingRepository,
    private readonly extractions?: ExtractionRepository,
    private readonly images?: ImageRepository,
    private readonly audit?: AuditRepository,
    private readonly storage?: ObjectStorage,
  ) {}

  async listByInspection(inspectionId: string) {
    return this.reports.listByInspection(inspectionId);
  }

  async listForActor(actor: PublicUser, inspectionId: string) {
    await this.requireInspection(actor, inspectionId);
    return this.reports.listByInspection(inspectionId);
  }

  async generate(actor: PublicUser, inspectionId: string) {
    const inspection = await this.requireInspection(actor, inspectionId);
    if (actor.role === 'inspector') {
      throw forbidden('Inspectors cannot generate reports');
    }
    if (inspection.status !== 'finalized' && inspection.status !== 'review_pending') {
      throw conflict(
        'Reports can be generated after review is pending or the inspection is finalized',
      );
    }
    if (!this.findings || !this.extractions || !this.images || !this.storage?.savePdf) {
      throw badRequest('Report generation is not configured');
    }
    const [findingPage, fields, images] = await Promise.all([
      this.findings.listByInspection(inspectionId),
      this.extractions.listByInspection(inspectionId),
      this.images.listByInspection(inspectionId),
    ]);
    const fieldRows = Array.isArray(fields) ? fields : [];
    const lines: string[] = [
      REPORT_DISCLAIMER,
      '',
      `Inspection ID: ${inspection.id}`,
      `Reference date: ${inspection.referenceDate}`,
      `Status: ${inspection.status}`,
      `Overall outcome: ${inspection.overallOutcome ?? 'not set'}`,
      `Location: ${inspection.locationNote ?? 'n/a'}`,
      `Created by: ${inspection.createdByUserId}`,
      `Finalized at: ${inspection.finalizedAt ?? 'not finalized'}`,
      '',
      'Declarations',
    ];
    if (fieldRows.length === 0) {
      lines.push('No extracted declarations stored.');
    } else {
      for (const field of fieldRows) {
        const row = field as {
          fieldKey?: string;
          rawValue?: string | null;
          normalizedValue?: string | null;
          confidence?: number;
          panel?: string | null;
          needsReview?: boolean;
        };
        lines.push(
          `${row.fieldKey ?? 'unknown'}: raw=${row.rawValue ?? 'n/a'} normalized=${row.normalizedValue ?? 'n/a'} confidence=${row.confidence ?? 'n/a'} panel=${row.panel ?? 'n/a'} needsReview=${row.needsReview ?? 'n/a'}`,
        );
      }
    }
    lines.push('', `Images (${images.length})`);
    for (const image of images) {
      lines.push(
        `${image.id} file=${image.originalFilename} panel=${image.panelLabel ?? 'n/a'} quality=${image.qualityStatus}`,
      );
    }
    lines.push('', `Findings (${findingPage.length})`);
    for (const finding of findingPage) {
      lines.push(
        `${finding.id} ${findingOutcomeWording(finding.outcome)} engine=${finding.engineDecision} reviewer=${finding.reviewerState}`,
      );
      lines.push(`Detected: ${finding.detectedValue ?? 'n/a'}`);
      lines.push(`Expected: ${finding.expectedRequirement}`);
      lines.push(`Explanation: ${finding.explanation}`);
      lines.push(
        `Rule: ${finding.rule.ruleCode} version=${finding.ruleVersion.versionNumber} status=${finding.ruleVersion.status} effectiveFrom=${finding.ruleVersion.effectiveFrom}`,
      );
      lines.push(
        `Source: ${finding.source.title} authority=${finding.source.issuingAuthority} verification=${finding.source.verificationStatus} url=${finding.source.officialUrl}`,
      );
      if (finding.evidence.length === 0) {
        lines.push('Evidence: none stored');
      } else {
        for (const evidence of finding.evidence) {
          const box = evidence.boundingBox
            ? `x=${evidence.boundingBox.x},y=${evidence.boundingBox.y},w=${evidence.boundingBox.width},h=${evidence.boundingBox.height}`
            : 'none';
          lines.push(
            `Evidence ${evidence.id} image=${evidence.imageId} field=${evidence.extractedFieldKey ?? 'n/a'} box=${box} snippet=${evidence.ocrSnippet ?? 'n/a'}`,
          );
        }
      }
      for (const review of finding.reviews) {
        lines.push(
          `Review ${review.id} decision=${review.decision} reviewer=${review.reviewerUserId} note=${review.note ?? 'n/a'} edited=${review.editedOutcome ?? 'n/a'}`,
        );
      }
      lines.push('');
    }
    const pdf = buildTextPdf('PackCheck AI inspection report', lines);
    const stored = await this.storage.savePdf(pdf);
    const report = await this.reports.create({
      inspectionId,
      storageKey: stored.storageKey,
      generatedByUserId: actor.id,
    });
    await this.audit?.record({
      actorUserId: actor.id,
      action: 'report.generate',
      entityType: 'report',
      entityId: report.id,
      payload: { inspectionId, storageKey: stored.storageKey },
    });
    return report;
  }

  async download(actor: PublicUser, reportId: string) {
    const report = await this.reports.getById(reportId);
    if (!report) {
      throw notFound('Report not found');
    }
    await this.requireInspection(actor, report.inspectionId);
    if (!this.storage?.read) {
      throw badRequest('Object storage is not configured');
    }
    const buffer = await this.storage.read(report.storageKey);
    return { report, buffer };
  }

  private async requireInspection(actor: PublicUser, inspectionId: string): Promise<InspectionRecord> {
    if (!this.inspections) {
      throw badRequest('Inspection repository is not configured');
    }
    const inspection = await this.inspections.getById(inspectionId);
    if (!inspection) {
      throw notFound('Inspection not found');
    }
    if (actor.role === 'administrator' || actor.role === 'reviewer') {
      return inspection;
    }
    if (inspection.createdByUserId !== actor.id) {
      throw forbidden('Inspectors may only access their own inspections');
    }
    return inspection;
  }
}
