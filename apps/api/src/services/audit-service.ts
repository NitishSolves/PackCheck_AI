import type { AuditRepository } from '../repositories/types.js';

export class AuditService {
  constructor(private readonly audit: AuditRepository) {}

  record(input: Parameters<AuditRepository['record']>[0]) {
    return this.audit.record(input);
  }
}
