export const TRI_STATES = ['true', 'false', 'unknown'] as const;
export type TriState = (typeof TRI_STATES)[number];

export function isTriState(value: unknown): value is TriState {
  return value === 'true' || value === 'false' || value === 'unknown';
}

export function asTriState(value: unknown, fallback: TriState = 'unknown'): TriState {
  return isTriState(value) ? value : fallback;
}

export function unknownIfAbsent(present: boolean): TriState {
  return present ? 'true' : 'unknown';
}
