import type { PublicUser, UserRole } from '@packcheck/shared';
import { forbidden, notFound } from '../errors.js';
import type {
  AuditRepository,
  RegulatorySourceRepository,
  RuleProposalRepository,
  RuleRepository,
  RuleVersionRepository,
} from '../repositories/types.js';

const ADMIN_ONLY: UserRole[] = ['administrator'];
const READ_ROLES: UserRole[] = ['inspector', 'reviewer', 'administrator'];

export class RegulatoryService {
  constructor(
    private readonly rules: RuleRepository,
    private readonly sources: RegulatorySourceRepository,
    private readonly proposals: RuleProposalRepository,
    private readonly versions: RuleVersionRepository,
    private readonly audit: AuditRepository,
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

  listRuleVersions(ruleId: string) {
    return this.versions.listByRule(ruleId);
  }

  async createSource(
    actor: PublicUser,
    input: {
      title: string;
      sourceType: string;
      issuingAuthority: string;
      officialUrl: string;
      documentHash?: string;
      publicationDate?: string;
      effectiveDate?: string;
    },
  ) {
    this.assertRole(actor, ADMIN_ONLY);
    const source = await this.sources.create(input);
    await this.audit.record({
      actorUserId: actor.id,
      action: 'regulatory.source.create',
      entityType: 'regulatory_source',
      entityId: source.id,
      payload: { verificationStatus: source.verificationStatus },
    });
    return source;
  }

  async createProposal(
    actor: PublicUser,
    input: { sourceId: string; ruleId?: string; proposedChange: Record<string, unknown> },
  ) {
    this.assertRole(actor, ADMIN_ONLY);
    const source = await this.sources.getById(input.sourceId);
    if (!source) {
      throw notFound('Regulatory source not found');
    }
    if (input.ruleId) {
      const rule = await this.rules.getById(input.ruleId);
      if (!rule) {
        throw notFound('Regulatory rule not found');
      }
    }
    const proposal = await this.proposals.create({
      sourceId: input.sourceId,
      ruleId: input.ruleId,
      proposedChange: input.proposedChange,
      submittedByUserId: actor.id,
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'regulatory.proposal.create',
      entityType: 'rule_proposal',
      entityId: proposal.id,
    });
    return proposal;
  }

  async createRuleVersion(
    actor: PublicUser,
    input: {
      ruleId: string;
      sourceId: string;
      versionNumber: number;
      clauseReference?: string;
      requirementText: string;
      applicability: Record<string, unknown>;
      conditions: Record<string, unknown>;
      exceptions: Record<string, unknown>;
      validationType: string;
      validationConfig: Record<string, unknown>;
      severity: string;
      effectiveFrom: string;
      effectiveTo?: string | null;
    },
  ) {
    this.assertRole(actor, ADMIN_ONLY);
    const rule = await this.rules.getById(input.ruleId);
    if (!rule) {
      throw notFound('Regulatory rule not found');
    }
    const source = await this.sources.getById(input.sourceId);
    if (!source) {
      throw notFound('Regulatory source not found');
    }
    const version = await this.versions.create(input);
    await this.audit.record({
      actorUserId: actor.id,
      action: 'regulatory.rule_version.create',
      entityType: 'rule_version',
      entityId: version.id,
      payload: { status: version.status, ruleId: version.ruleId },
    });
    return version;
  }

  assertCanRead(actor: PublicUser): void {
    this.assertRole(actor, READ_ROLES);
  }

  private assertRole(actor: PublicUser, allowed: readonly UserRole[]): void {
    if (!allowed.includes(actor.role)) {
      throw forbidden();
    }
  }
}
