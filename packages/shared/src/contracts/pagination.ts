import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export function paginateOffset(page: number, pageSize: number): { limit: number; offset: number } {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
