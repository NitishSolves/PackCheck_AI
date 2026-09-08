import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const inspections = pgTable(
  'inspections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    status: varchar('status', { length: 40 }).notNull().default('draft'),
    referenceDate: date('reference_date').notNull(),
    locationNote: text('location_note'),
    overallOutcome: varchar('overall_outcome', { length: 40 }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('inspections_created_by_user_id_idx').on(table.createdByUserId),
    index('inspections_status_idx').on(table.status),
    index('inspections_created_at_idx').on(table.createdAt),
  ],
);

export const inspectionImages = pgTable(
  'inspection_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    inspectionId: uuid('inspection_id')
      .notNull()
      .references(() => inspections.id),
    storageKey: text('storage_key').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    panelLabel: varchar('panel_label', { length: 100 }),
    byteSize: integer('byte_size'),
    qualityStatus: varchar('quality_status', { length: 40 }).notNull().default('pending'),
    qualityScore: real('quality_score'),
    qualityIssues: jsonb('quality_issues').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('inspection_images_inspection_id_idx').on(table.inspectionId)],
);

export const ocrResults = pgTable('ocr_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  imageId: uuid('image_id')
    .notNull()
    .references(() => inspectionImages.id),
  fullText: text('full_text').notNull(),
  tokens: jsonb('tokens').notNull(),
  meanConfidence: real('mean_confidence').notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  modelVersion: varchar('model_version', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const extractedFields = pgTable('extracted_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  inspectionId: uuid('inspection_id')
    .notNull()
    .references(() => inspections.id),
  imageId: uuid('image_id').references(() => inspectionImages.id),
  fieldKey: varchar('field_key', { length: 120 }).notNull(),
  rawValue: text('raw_value'),
  normalizedValue: text('normalized_value'),
  confidence: real('confidence').notNull(),
  panel: varchar('panel', { length: 100 }),
  boundingBox: jsonb('bounding_box'),
  needsReview: boolean('needs_review').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const packageContexts = pgTable('package_contexts', {
  id: uuid('id').primaryKey().defaultRandom(),
  inspectionId: uuid('inspection_id')
    .notNull()
    .references(() => inspections.id)
    .unique(),
  context: jsonb('context').notNull(),
  unknownApplicability: boolean('unknown_applicability').notNull().default(true),
  confirmedByUserId: uuid('confirmed_by_user_id').references(() => users.id),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const modelVersions = pgTable('model_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 100 }).notNull(),
  capability: varchar('capability', { length: 80 }).notNull(),
  version: varchar('version', { length: 100 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
