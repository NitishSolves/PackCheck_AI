import { randomUUID } from 'node:crypto';
import type { BoundingBox, DeclarationRegion, ExtractedField, OcrResult, OcrToken } from '@packcheck/shared';
import {
  DECLARATION_FIELD_KEYS,
  isLowConfidence,
  normalizeDeclarationField,
  type DeclarationFieldKey,
} from '@packcheck/shared';

const LINE_PATTERNS: Array<{ fieldKey: DeclarationFieldKey; pattern: RegExp }> = [
  {
    fieldKey: 'manufacturer',
    pattern: /(?:mfg|manufactured\s+by|manufacturer|mfr)\s*[:.\-]\s*(.+)/i,
  },
  { fieldKey: 'packer', pattern: /(?:packed\s+by|packer|pkd\s+by)\s*[:.\-]\s*(.+)/i },
  { fieldKey: 'importer', pattern: /(?:imported\s+by|importer)\s*[:.\-]\s*(.+)/i },
  {
    fieldKey: 'country_of_origin',
    pattern: /(?:country\s+of\s+origin|origin|made\s+in)\s*[:.\-]\s*(.+)/i,
  },
  {
    fieldKey: 'common_generic_name',
    pattern: /(?:common\s+name|generic\s+name|commodity)\s*[:.\-]\s*(.+)/i,
  },
  {
    fieldKey: 'net_quantity',
    pattern:
      /(?:net\s*(?:qty|quantity|wt|weight|content)|qty|quantity)\s*[:.\-]\s*([0-9]+(?:\.[0-9]+)?\s*[a-zA-Z]+)/i,
  },
  {
    fieldKey: 'manufacture_or_pack_date',
    pattern:
      /(?:mfg|mfd|pkd|packed\s+on|manufactured\s+on|date\s+of\s+(?:manufacture|pack))\s*[:.\-]\s*([0-9A-Za-z./\- ]{4,20})/i,
  },
  {
    fieldKey: 'import_date',
    pattern: /(?:import(?:ed)?\s+on|date\s+of\s+import)\s*[:.\-]\s*([0-9A-Za-z./\- ]{4,20})/i,
  },
  {
    fieldKey: 'best_before',
    pattern: /(?:best\s+before|best\s+by|bb)\s*[:.\-]\s*([0-9A-Za-z./\- ]{4,24})/i,
  },
  {
    fieldKey: 'use_by',
    pattern: /(?:use\s+by|expiry|exp(?:iry)?(?:\s*date)?)\s*[:.\-]\s*([0-9A-Za-z./\- ]{4,24})/i,
  },
  {
    fieldKey: 'mrp',
    pattern: /(?:m\.?r\.?p\.?|maximum\s+retail\s+price)\s*[:.\-]?\s*(₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  },
  {
    fieldKey: 'consumer_care',
    pattern:
      /(?:consumer\s+care|customer\s+care|careline|helpline|contact)\s*[:.\-]\s*(.+)/i,
  },
  {
    fieldKey: 'unit_sale_price',
    pattern: /(?:unit\s+sale\s+price|usp|price\s+per)\s*[:.\-]?\s*(₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  },
  {
    fieldKey: 'dimensions',
    pattern: /(?:dimensions?|size)\s*[:.\-]\s*([0-9]+(?:\.[0-9]+)?\s*[a-z]+(?:\s*[x×]\s*[0-9]+(?:\.[0-9]+)?\s*[a-z]*)*)/i,
  },
];

function lineTokens(all: OcrToken[], lineYTolerance = 12): OcrToken[][] {
  if (all.length === 0) {
    return [];
  }
  const sorted = [...all].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const lines: OcrToken[][] = [];
  for (const token of sorted) {
    const last = lines[lines.length - 1];
    const lastY = last?.[0]?.box.y ?? 0;
    if (!last || Math.abs(token.box.y - lastY) > lineYTolerance) {
      lines.push([token]);
    } else {
      last.push(token);
    }
  }
  return lines;
}

function boxFor(tokens: OcrToken[]): BoundingBox | null {
  if (tokens.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = 0;
  let maxY = 0;
  for (const token of tokens) {
    minX = Math.min(minX, token.box.x);
    minY = Math.min(minY, token.box.y);
    maxX = Math.max(maxX, token.box.x + token.box.width);
    maxY = Math.max(maxY, token.box.y + token.box.height);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    imageId: tokens[0]?.box.imageId,
  };
}

function rawFromMatch(fieldKey: DeclarationFieldKey, match: RegExpMatchArray): string {
  if (fieldKey === 'mrp' || fieldKey === 'unit_sale_price') {
    return [match[1], match[2]].filter(Boolean).join(' ').trim() || match[0];
  }
  return (match[1] ?? match[0]).trim();
}

function toField(input: {
  fieldKey: DeclarationFieldKey;
  rawValue: string;
  confidence: number;
  panel: string | null;
  imageId: string | null;
  box: BoundingBox | null;
  minFieldConfidence: number;
}): ExtractedField {
  const normalized = normalizeDeclarationField({
    fieldKey: input.fieldKey,
    rawValue: input.rawValue,
    confidence: input.confidence,
  });
  const confidence = Math.min(input.confidence, normalized.parseConfidence);
  return {
    fieldKey: input.fieldKey,
    rawValue: normalized.rawValue,
    normalizedValue: normalized.normalizedValue,
    confidence,
    panel: input.panel,
    imageId: input.imageId,
    box: input.box,
    needsReview: isLowConfidence(confidence, input.minFieldConfidence) || normalized.parseNotes.length > 0,
    sourceOccurrenceId: randomUUID(),
    parseNotes: normalized.parseNotes,
  };
}

export function extractDeclarationFields(input: {
  ocr: OcrResult;
  regions: DeclarationRegion[];
  imageId?: string | null;
  panel?: string | null;
  minFieldConfidence?: number;
}): ExtractedField[] {
  const minFieldConfidence = input.minFieldConfidence ?? 0.5;
  const imageId = input.imageId ?? null;
  const panel = input.panel ?? null;
  const fields: ExtractedField[] = [];
  const lines = lineTokens(input.ocr.tokens);
  const tokenLines = lines.map((tokens) => ({
    text: tokens.map((token) => token.text).join(' '),
    tokens,
    confidence: tokens.reduce((sum, token) => sum + token.confidence, 0) / Math.max(tokens.length, 1),
  }));
  const fullTextLines = input.ocr.fullText.split(/\n+/).map((text) => ({
    text,
    tokens: [] as OcrToken[],
    confidence: input.ocr.meanConfidence,
  }));
  const lineTexts = [...tokenLines];
  for (const line of fullTextLines) {
    if (!line.text.trim()) {
      continue;
    }
    const duplicate = tokenLines.some(
      (existing) => existing.text.trim().toLowerCase() === line.text.trim().toLowerCase(),
    );
    if (!duplicate) {
      lineTexts.push(line);
    }
  }

  for (const line of lineTexts) {
    for (const candidate of LINE_PATTERNS) {
      const match = line.text.match(candidate.pattern);
      if (!match) {
        continue;
      }
      fields.push(
        toField({
          fieldKey: candidate.fieldKey,
          rawValue: rawFromMatch(candidate.fieldKey, match),
          confidence: line.confidence,
          panel,
          imageId,
          box: boxFor(line.tokens),
          minFieldConfidence,
        }),
      );
    }
  }

  for (const region of input.regions) {
    if (!region.fieldKey) {
      continue;
    }
    const already = fields.some(
      (field) =>
        field.fieldKey === region.fieldKey &&
        field.rawValue &&
        region.ocrText.includes(field.rawValue),
    );
    if (already) {
      continue;
    }
    const match = LINE_PATTERNS.find((item) => item.fieldKey === region.fieldKey);
    const captured = match ? region.ocrText.match(match.pattern) : null;
    const raw = captured ? rawFromMatch(region.fieldKey as DeclarationFieldKey, captured) : region.ocrText;
    if (!(DECLARATION_FIELD_KEYS as readonly string[]).includes(region.fieldKey)) {
      continue;
    }
    fields.push(
      toField({
        fieldKey: region.fieldKey as DeclarationFieldKey,
        rawValue: raw,
        confidence: region.confidence,
        panel,
        imageId,
        box: region.box,
        minFieldConfidence,
      }),
    );
  }

  return fields;
}

export function mergeOccurrences(fields: ExtractedField[]): ExtractedField[] {
  return [...fields];
}
