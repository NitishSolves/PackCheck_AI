import type { RegulatorySourceRepository, RuleProposalRepository, RuleRepository } from '../repositories/types.js';

export class RegulatoryService {
  constructor(
    private readonly rules: RuleRepository,
    private readonly sources: RegulatorySourceRepository,
    private readonly proposals: RuleProposalRepository,
  ) {}

  listRules() {
    return this.rules.listCatalog();
  }

  listSources() {
    return this.sources.list();
  }

  listProposals() {
    return this.proposals.list();
  }
}
