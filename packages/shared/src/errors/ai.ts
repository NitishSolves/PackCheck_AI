export const AI_ERROR_CODES = [
  'MISSING_CREDENTIALS',
  'TIMEOUT',
  'MALFORMED_RESPONSE',
  'LOW_CONFIDENCE',
  'UNCONFIGURED',
  'DECODE_FAILED',
  'PROVIDER_ERROR',
  'IMAGE_UNREADABLE',
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export const FORBIDDEN_AI_VERDICT_KEYS = [
  'LEGAL_VIOLATION',
  'legalViolation',
  'legal_verdict',
  'legalVerdict',
  'violation',
  'isIllegal',
  'illegal',
] as const;

export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;

  constructor(code: AiErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function containsForbiddenLegalVerdict(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  for (const key of FORBIDDEN_AI_VERDICT_KEYS) {
    if (key in record) {
      return true;
    }
  }
  return Object.values(record).some((entry) => containsForbiddenLegalVerdict(entry));
}

export function assertNoLegalVerdict(value: unknown): void {
  if (containsForbiddenLegalVerdict(value)) {
    throw new AiProviderError(
      'MALFORMED_RESPONSE',
      'AI response included a legal verdict; evidence pipeline rejects legal conclusions.',
    );
  }
}
