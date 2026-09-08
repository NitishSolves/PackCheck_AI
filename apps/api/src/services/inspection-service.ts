import type { AuditRepository, InspectionRepository } from '../repositories/types.js';

export class InspectionService {
  constructor(
    private readonly inspections: InspectionRepository,
    private readonly audit: AuditRepository,
  ) {}

  list() {
    return this.inspections.list();
  }

  getById(id: string) {
    return this.inspections.getById(id);
  }

  async create(input: { createdByUserId: string; referenceDate: string; locationNote?: string }) {
    const inspection = await this.inspections.create(input);
    await this.audit.record({
      actorUserId: input.createdByUserId,
      action: 'inspection.create',
      entityType: 'inspection',
      entityId: inspection.id,
    });
    return inspection;
  }
}
