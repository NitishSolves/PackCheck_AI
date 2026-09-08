import type { ReportRepository } from '../repositories/types.js';

export class ReportService {
  constructor(private readonly reports: ReportRepository) {}

  listByInspection(inspectionId: string) {
    return this.reports.listByInspection(inspectionId);
  }
}
