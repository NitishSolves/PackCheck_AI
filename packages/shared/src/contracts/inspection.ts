import { z } from 'zod';
import { INSPECTION_STATUSES } from '../domain/inspection.js';

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const createInspectionBodySchema = z.object({
  referenceDate: isoDateSchema,
  locationNote: z.string().trim().max(2000).optional(),
});
export type CreateInspectionBody = z.infer<typeof createInspectionBodySchema>;

export const updateInspectionBodySchema = z
  .object({
    referenceDate: isoDateSchema.optional(),
    locationNote: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(INSPECTION_STATUSES).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field is required',
  });
export type UpdateInspectionBody = z.infer<typeof updateInspectionBodySchema>;

export const registerImageBodySchema = z.object({
  mimeType: z.string().min(1).max(100),
  originalFilename: z.string().min(1).max(255),
  panelLabel: z.string().trim().max(100).optional(),
  storageKey: z.string().min(1).max(500).optional(),
});
export type RegisterImageBody = z.infer<typeof registerImageBodySchema>;

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
