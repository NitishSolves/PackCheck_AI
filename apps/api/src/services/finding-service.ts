import {
  FINDING_OUTCOMES,
  REVIEW_DECISIONS,
  findingOutcomeWording,
  reviewerStateForDecision,
  type FindingOutcome,
  type PublicUser,
  type ReviewDecision,
} from '@packcheck/shared';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import type {
  AuditRepository,
  FindingDetail,
  FindingRepository,
  ImageRepository,
  InspectionRecord,
  InspectionRepository,
} from '../repositories/types.js';
import type { ObjectStorage } from '../storage/object-storage.js';

const REVIEWER_ROLES = ['reviewer', 'administrator'] as const;

export class FindingService {
  constructor(
    private readonly findings: FindingRepository,
    private readonly inspections: InspectionRepository,
    private readonly images: ImageRepository,
    private readonly audit: AuditRepository,
    private readonly storage?: ObjectStorage,
  ) {}

  async listByInspection(actor: PublicUser, inspectionId: string) {
    await this.requireInspection(actor, inspectionId);
    const items = await this.findings.listByInspection(inspectionId);
    return items.map((finding) => this.present(finding));
  }

  async getById(actor: PublicUser, findingId: string) {
    const finding = await this.requireFinding(actor, findingId);
    return this.present(finding);
  }

  async originalImage(actor: PublicUser, imageId: string) {
    const image = await this.images.getById(imageId);
    if (!image) {
      throw notFound('Image not found');
    }
    await this.requireInspection(actor, image.inspectionId);
    if (!this.storage?.read) {
      throw badRequest('Object storage is not configured');
    }
    const buffer = await this.storage.read(image.storageKey);
    return { image, buffer };
  }

  async evidenceCrop(actor: PublicUser, findingId: string, evidenceId: string) {
    const finding = await this.requireFinding(actor, findingId);
    const evidence = finding.evidence.find((item) => item.id === evidenceId);
    if (!evidence) {
      throw notFound('Evidence not found');
    }
    if (!evidence.cropStorageKey) {
      throw notFound('Evidence crop is not stored; use the original image and bounding box');
    }
    if (!this.storage?.read) {
      throw badRequest('Object storage is not configured');
    }
    const buffer = await this.storage.read(evidence.cropStorageKey);
    return { evidence, buffer };
  }

  async review(
    actor: PublicUser,
    findingId: string,
    input: { decision: ReviewDecision; note?: string; editedOutcome?: FindingOutcome },
  ) {
    if (actor.role === 'inspector') {
      throw forbidden('Inspectors cannot review findings');
    }
    if (!(REVIEWER_ROLES as readonly string[]).includes(actor.role)) {
      throw forbidden();
    }
    if (!(REVIEW_DECISIONS as readonly string[]).includes(input.decision)) {
      throw badRequest('Unknown review decision');
    }
    const finding = await this.requireFinding(actor, findingId);
    const inspection = await this.requireInspection(actor, finding.inspectionId);
    if (inspection.status === 'finalized') {
      throw conflict('Finalized inspections cannot be reviewed');
    }
    if (inspection.status !== 'review_pending' && inspection.status !== 'evaluating') {
      throw conflict(`Cannot review findings while inspection is ${inspection.status}`);
    }
    if (input.decision === 'edit') {
      if (!input.editedOutcome) {
        throw badRequest('editedOutcome is required when decision is edit');
      }
      if (!(FINDING_OUTCOMES as readonly string[]).includes(input.editedOutcome)) {
        throw badRequest('Unknown edited outcome');
      }
    }

    const reviewerState = reviewerStateForDecision(input.decision);
    const outcome: FindingOutcome =
      input.decision === 'not_applicable'
        ? 'NOT_APPLICABLE'
        : input.decision === 'edit' && input.editedOutcome
          ? input.editedOutcome
          : finding.outcome;

    const result = await this.findings.applyReview({
      findingId,
      reviewerUserId: actor.id,
      decision: input.decision,
      note: input.note?.trim(),
      editedOutcome: input.decision === 'edit' ? input.editedOutcome : undefined,
      reviewerState,
      outcome,
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'finding.review',
      entityType: 'finding',
      entityId: findingId,
      payload: {
        inspectionId: finding.inspectionId,
        decision: input.decision,
        reviewerState,
        outcome,
      },
    });
    const detail = await this.findings.getDetail(findingId);
    return {
      finding: this.present(
        detail ?? { ...finding, ...result.finding, reviews: [...finding.reviews, result.review] },
      ),
      review: result.review,
    };
  }

  private present(finding: FindingDetail) {
    return {
      ...finding,
      wording: findingOutcomeWording(finding.outcome),
    };
  }

  private async requireInspection(actor: PublicUser, inspectionId: string): Promise<InspectionRecord> {
    const inspection = await this.inspections.getById(inspectionId);
    if (!inspection) {
      throw notFound('Inspection not found');
    }
    this.assertCanRead(actor, inspection);
    return inspection;
  }

  private async requireFinding(actor: PublicUser, findingId: string) {
    const finding = await this.findings.getDetail(findingId);
    if (!finding) {
      throw notFound('Finding not found');
    }
    await this.requireInspection(actor, finding.inspectionId);
    return finding;
  }

  private assertCanRead(actor: PublicUser, inspection: InspectionRecord): void {
    if (actor.role === 'administrator' || actor.role === 'reviewer') {
      return;
    }
    if (inspection.createdByUserId !== actor.id) {
      throw forbidden('Inspectors may only access their own inspections');
    }
  }
}
