import {
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const regulatorySources = pgTable('regulatory_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  sourceType: varchar('source_type', { length: 80 }).notNull(),
  issuingAuthority: text('issuing_authority').notNull(),
  officialUrl: text('official_url').notNull(),
  documentHash: varchar('document_hash', { length: 128 }),
  publicationDate: date('publication_date'),
  effectiveDate: date('effective_date'),
  verificationStatus: varchar('verification_status', { length: 40 }).notNull().default('unverified'),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }),
  verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const regulatoryRules = pgTable('regulatory_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleCode: varchar('rule_code', { length: 100 }).notNull().unique(),
  title: text('title').notNull(),
  ruleNumber: varchar('rule_number', { length: 100 }),
  clauseReference: varchar('clause_reference', { length: 150 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ruleVersions = pgTable(
  'rule_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => regulatoryRules.id),
    versionNumber: integer('version_number').notNull(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => regulatorySources.id),
    clauseReference: varchar('clause_reference', { length: 150 }),
    requirementText: text('requirement_text').notNull(),
    applicability: jsonb('applicability').notNull().default({}),
    conditions: jsonb('conditions').notNull().default({}),
    exceptions: jsonb('exceptions').notNull().default({}),
    validationType: varchar('validation_type', { length: 60 }).notNull(),
    validationConfig: jsonb('validation_config').notNull().default({}),
    severity: varchar('severity', { length: 40 }).notNull().default('review'),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    status: varchar('status', { length: 30 }).notNull().default('draft'),
    verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('rule_versions_rule_id_version_number').on(table.ruleId, table.versionNumber)],
);

export const ruleConditions = pgTable('rule_conditions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleVersionId: uuid('rule_version_id')
    .notNull()
    .references(() => ruleVersions.id),
  conditionKey: varchar('condition_key', { length: 120 }).notNull(),
  operator: varchar('operator', { length: 60 }).notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ruleProposals = pgTable('rule_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => regulatorySources.id),
  ruleId: uuid('rule_id').references(() => regulatoryRules.id),
  proposedChange: jsonb('proposed_change').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('proposed'),
  submittedByUserId: uuid('submitted_by_user_id').references(() => users.id),
  reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
