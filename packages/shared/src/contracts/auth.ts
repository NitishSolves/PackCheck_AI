import { z } from 'zod';
import { USER_ROLES } from '../domain/users.js';

export const loginBodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: z.enum(USER_ROLES),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const sessionResponseSchema = z.object({
  token: z.string().min(1),
  user: publicUserSchema,
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
