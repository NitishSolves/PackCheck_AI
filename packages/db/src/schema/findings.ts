import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { inspections, inspectionImages } from './inspections.js';
import { ruleVersions } from './regulatory.js';
import { users } from './users.js';

export const findings = pgTable('findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  inspectionId: uuid('inspection_id')
    .notNull()
    .references(() => inspections.id),
  ruleVersionId: uuid('rule_version_id')
    .notNull()
    .references(() => ruleVersions.id),
  outcome: varchar('outcome', { length: 40 }).notNull(),
  engineDecision: varchar('engine_decision', { length: 20 }).notNull(),
  detectedValue: text('detected_value'),
  expectedRequirement: text('expected_requirement').notNull(),
  explanation: text('explanation').notNull(),
  reviewerState: varchar('reviewer_state', { length: 40 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const findingEvidence = pgTable('finding_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  findingId: uuid('finding_id')
    .notNull()
    .references(() => findings.id),
  imageId: uuid('image_id')
    .notNull()
    .references(() => inspectionImages.id),
  boundingBox: jsonb('bounding_box'),
  extractedFieldKey: varchar('extracted_field_key', { length: 120 }),
  ocrSnippet: text('ocr_snippet'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reviewActions = pgTable('review_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  findingId: uuid('finding_id')
    .notNull()
    .references(() => findings.id),
  reviewerUserId: uuid('reviewer_user_id')
    .notNull()
    .references(() => users.id),
  decision: varchar('decision', { length: 40 }).notNull(),
  note: text('note'),
  editedOutcome: varchar('edited_outcome', { length: 40 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  inspectionId: uuid('inspection_id')
    .notNull()
    .references(() => inspections.id),
  storageKey: text('storage_key').notNull(),
  generatedByUserId: uuid('generated_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  action: varchar('action', { length: 120 }).notNull(),
  entityType: varchar('entity_type', { length: 80 }).notNull(),
  entityId: uuid('entity_id'),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
