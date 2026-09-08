export const USER_ROLES = ['inspector', 'reviewer', 'administrator'] as const;
export type UserRole = (typeof USER_ROLES)[number];
