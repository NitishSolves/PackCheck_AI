import type { PublicUser } from '@packcheck/shared';
import { forbidden } from '../errors.js';
import type { AuditListFilter, AuditRepository } from '../repositories/types.js';

export class AuditService {
  constructor(private readonly audit: AuditRepository) {}

  record(input: Parameters<AuditRepository['record']>[0]) {
    return this.audit.record(input);
  }

  async list(actor: PublicUser, filter: AuditListFilter) {
    if (actor.role === 'inspector') {
      throw forbidden('Inspectors cannot list audit logs');
    }
    return this.audit.list(filter);
  }
}
