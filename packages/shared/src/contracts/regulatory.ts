import { z } from 'zod';
import { SOURCE_VERIFICATION_STATUSES, VALIDATION_OPERATORS } from '../domain/regulatory.js';
import { isoDateSchema } from './inspection.js';

export const createRegulatorySourceBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  sourceType: z.string().trim().min(1).max(80),
  issuingAuthority: z.string().trim().min(1).max(500),
  officialUrl: z.string().url().max(2000),
  documentHash: z.string().trim().min(1).max(128).optional(),
  publicationDate: isoDateSchema.optional(),
  effectiveDate: isoDateSchema.optional(),
});
export type CreateRegulatorySourceBody = z.infer<typeof createRegulatorySourceBodySchema>;

export const createRuleProposalBodySchema = z.object({
  sourceId: z.string().uuid(),
  ruleId: z.string().uuid().optional(),
  proposedChange: z.record(z.unknown()),
});
export type CreateRuleProposalBody = z.infer<typeof createRuleProposalBodySchema>;

export const createRuleVersionBodySchema = z.object({
  ruleId: z.string().uuid(),
  sourceId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  clauseReference: z.string().trim().max(150).optional(),
  requirementText: z.string().trim().min(1),
  applicability: z.record(z.unknown()).default({}),
  conditions: z.record(z.unknown()).default({}),
  exceptions: z.record(z.unknown()).default({}),
  validationType: z.enum(VALIDATION_OPERATORS),
  validationConfig: z.record(z.unknown()).default({}),
  severity: z.string().trim().min(1).max(40).default('review'),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable().optional(),
});
export type CreateRuleVersionBody = z.infer<typeof createRuleVersionBodySchema>;

export const sourceVerificationStatusSchema = z.enum(SOURCE_VERIFICATION_STATUSES);
