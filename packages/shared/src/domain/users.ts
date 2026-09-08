export const USER_ROLES = ['inspector', 'reviewer', 'administrator'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const RBAC_ROLES = {
  INSPECTOR: 'inspector',
  REVIEWER: 'reviewer',
  ADMIN: 'administrator',
} as const satisfies Record<'INSPECTOR' | 'REVIEWER' | 'ADMIN', UserRole>;
