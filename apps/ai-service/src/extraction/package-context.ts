import {
  emptyPackageContextFlags,
  hasUnknownApplicability,
  type PackageClassification,
  type PackageContextFlags,
  type TriState,
} from '@packcheck/shared';

function evidenceTrue(texts: string[], pattern: RegExp): boolean {
  return texts.some((text) => pattern.test(text));
}

function flagFromEvidence(positive: boolean, negative: boolean): TriState {
  if (positive && !negative) {
    return 'true';
  }
  if (negative && !positive) {
    return 'false';
  }
  return 'unknown';
}

export function classifyPackageContext(input: {
  texts: string[];
  metadata?: Record<string, unknown>;
  provider: string;
  modelVersion: string | null;
}): PackageClassification {
  const texts = input.texts.map((text) => text.toLowerCase());
  const notes: string[] = [];

  const imported = flagFromEvidence(
    evidenceTrue(texts, /\b(?:imported\s+by|country\s+of\s+origin|made\s+in)\b/),
    evidenceTrue(texts, /\bnot\s+imported\b/),
  );
  const retail = flagFromEvidence(
    evidenceTrue(texts, /\b(?:m\.?r\.?p\.?|maximum\s+retail\s+price|for\s+retail\s+sale)\b/),
    evidenceTrue(texts, /\bnot\s+for\s+retail\s+sale\b/),
  );
  const wholesale = flagFromEvidence(
    evidenceTrue(texts, /\b(?:wholesale|institutional\s+pack|not\s+for\s+retail\s+sale)\b/),
    evidenceTrue(texts, /\bnot\s+for\s+wholesale\b/),
  );
  const multiPiece = flagFromEvidence(
    evidenceTrue(texts, /\b(?:multi[\s-]?pack|multi[\s-]?piece|\d+\s*(?:pcs|pieces|n)\b)/),
    false,
  );
  const group = flagFromEvidence(evidenceTrue(texts, /\b(?:group\s+pack|combo\s+group)\b/), false);
  const combination = flagFromEvidence(
    evidenceTrue(texts, /\b(?:combination|combo\s+pack|assorted)\b/),
    false,
  );
  const special = flagFromEvidence(
    evidenceTrue(texts, /\b(?:export\s+only|industrial\s+use|sample\s+not\s+for\s+sale)\b/),
    false,
  );

  if (typeof input.metadata?.declaredImported === 'boolean') {
    notes.push('metadata.declaredImported ignored unless corroborated by label evidence');
  }

  const flags: PackageContextFlags = {
    ...emptyPackageContextFlags(),
    retail,
    wholesale,
    imported,
    multiPiece,
    group,
    combination,
    special,
  };

  const knownCount = Object.values(flags).filter((value) => value !== 'unknown').length;
  const confidence = knownCount === 0 ? 0 : Math.min(1, 0.35 + knownCount * 0.1);

  return {
    suggestedContext: { ...flags },
    flags,
    confidence,
    unknownApplicability: hasUnknownApplicability(flags),
    evidenceNotes: notes,
    provider: input.provider,
    modelVersion: input.modelVersion,
  };
}
