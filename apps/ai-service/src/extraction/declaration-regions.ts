import type {
  BoundingBox,
  DeclarationRegion,
  OcrBlock,
  OcrResult,
  OcrToken,
} from '@packcheck/shared';
import type { DeclarationFieldKey } from '@packcheck/shared';

const FIELD_PATTERNS: Array<{ fieldKey: DeclarationFieldKey; pattern: RegExp; label: string }> = [
  { fieldKey: 'manufacturer', pattern: /\b(?:mfg|manufactured\s+by|manufacturer|mfr)\b/i, label: 'Manufacturer' },
  { fieldKey: 'packer', pattern: /\b(?:packed\s+by|packer|pkd\s+by|packed\s+at)\b/i, label: 'Packer' },
  { fieldKey: 'importer', pattern: /\b(?:imported\s+by|importer|import(?:ed)?\s+by)\b/i, label: 'Importer' },
  {
    fieldKey: 'country_of_origin',
    pattern: /\b(?:country\s+of\s+origin|origin\s*:\s*|made\s+in)\b/i,
    label: 'Country of origin',
  },
  {
    fieldKey: 'common_generic_name',
    pattern: /\b(?:common\s+name|generic\s+name|commodity)\b/i,
    label: 'Common/generic name',
  },
  { fieldKey: 'net_quantity', pattern: /\b(?:net\s*(?:qty|quantity|wt|weight|content)|qty|quantity)\b/i, label: 'Net quantity' },
  {
    fieldKey: 'manufacture_or_pack_date',
    pattern: /\b(?:mfg|mfd|pkd|packed\s+on|manufactured\s+on|date\s+of\s+(?:manufacture|pack))\b/i,
    label: 'Manufacture/pack date',
  },
  { fieldKey: 'import_date', pattern: /\b(?:import(?:ed)?\s+on|date\s+of\s+import)\b/i, label: 'Import date' },
  { fieldKey: 'best_before', pattern: /\b(?:best\s+before|bb(?:\s*date)?|best\s+by)\b/i, label: 'Best before' },
  { fieldKey: 'use_by', pattern: /\b(?:use\s+by|expiry|exp(?:iry)?\s*date|use-by)\b/i, label: 'Use by' },
  { fieldKey: 'mrp', pattern: /\b(?:m\.?r\.?p\.?|maximum\s+retail\s+price|incl(?:usive)?\s+of\s+all\s+taxes)\b/i, label: 'MRP' },
  { fieldKey: 'consumer_care', pattern: /\b(?:consumer\s+care|customer\s+care|careline|helpline|contact)\b/i, label: 'Consumer care' },
  { fieldKey: 'unit_sale_price', pattern: /\b(?:unit\s+sale\s+price|usp|price\s+per)\b/i, label: 'Unit sale price' },
  { fieldKey: 'dimensions', pattern: /\b(?:dimensions?|size\s*:|l\s*x\s*w|mm\s*x)\b/i, label: 'Dimensions' },
];

function unionBox(tokens: OcrToken[]): BoundingBox | null {
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
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) {
    return tokens[0]?.box ?? null;
  }
  return { x: minX, y: minY, width, height, imageId: tokens[0]?.box.imageId };
}

function blockAsTokens(ocr: OcrResult): OcrBlock[] {
  if (ocr.blocks.length > 0) {
    return ocr.blocks;
  }
  if (ocr.tokens.length === 0) {
    return [];
  }
  return [
    {
      text: ocr.fullText,
      confidence: ocr.meanConfidence,
      box: unionBox(ocr.tokens) ?? { x: 0, y: 0, width: 1, height: 1 },
      tokens: ocr.tokens,
    },
  ];
}

export function detectDeclarationRegions(ocr: OcrResult): DeclarationRegion[] {
  const regions: DeclarationRegion[] = [];
  const blocks = blockAsTokens(ocr);
  for (const block of blocks) {
    const text = block.text || block.tokens.map((token) => token.text).join(' ');
    for (const candidate of FIELD_PATTERNS) {
      if (candidate.pattern.test(text)) {
        regions.push({
          label: candidate.label,
          fieldKey: candidate.fieldKey,
          box: block.box,
          confidence: block.confidence,
          ocrText: text,
        });
      }
    }
  }

  if (regions.length === 0 && ocr.fullText.trim().length > 0) {
    for (const candidate of FIELD_PATTERNS) {
      if (candidate.pattern.test(ocr.fullText)) {
        regions.push({
          label: candidate.label,
          fieldKey: candidate.fieldKey,
          box: unionBox(ocr.tokens) ?? { x: 0, y: 0, width: 1, height: 1 },
          confidence: ocr.meanConfidence,
          ocrText: ocr.fullText,
        });
      }
    }
  }

  return regions;
}
