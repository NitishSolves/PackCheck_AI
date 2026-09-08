import { TRI_STATES, type TriState } from './tri-state.js';

export const PACKAGE_CONTEXT_FLAGS = [
  'retail',
  'wholesale',
  'imported',
  'multiPiece',
  'group',
  'combination',
  'special',
] as const;

export type PackageContextFlag = (typeof PACKAGE_CONTEXT_FLAGS)[number];

export type PackageContextFlags = Record<PackageContextFlag, TriState>;

export function emptyPackageContextFlags(): PackageContextFlags {
  return {
    retail: 'unknown',
    wholesale: 'unknown',
    imported: 'unknown',
    multiPiece: 'unknown',
    group: 'unknown',
    combination: 'unknown',
    special: 'unknown',
  };
}

export function hasUnknownApplicability(flags: PackageContextFlags): boolean {
  return PACKAGE_CONTEXT_FLAGS.some((flag) => flags[flag] === 'unknown');
}

export const packageContextFlagValues = TRI_STATES;
