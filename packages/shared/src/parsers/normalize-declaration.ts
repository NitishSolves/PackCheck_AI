import { isDeclarationFieldKey, type DeclarationFieldKey } from '../domain/declaration-fields.js';
import { clampConfidence } from '../domain/confidence.js';
import { parseDate, formatDateNormalized } from './dates.js';
import { parseMoney, formatMoneyNormalized } from './money.js';
import { parseQuantity, formatQuantityNormalized } from './quantity.js';
import { parseConsumerCare, parseEmail, parsePhone } from './contact.js';

export type NormalizeDeclarationInput = {
  fieldKey: string;
  rawValue: string | null;
  confidence?: number;
};

export type NormalizedDeclaration = {
  fieldKey: DeclarationFieldKey | string;
  rawValue: string | null;
  normalizedValue: string | null;
  parseConfidence: number;
  parseNotes: string[];
};

function clean(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeDeclarationFields(
  inputs: NormalizeDeclarationInput[],
): NormalizedDeclaration[] {
  return inputs.map((input) => normalizeDeclarationField(input));
}

export function normalizeDeclarationField(input: NormalizeDeclarationInput): NormalizedDeclaration {
  const rawValue = clean(input.rawValue);
  const notes: string[] = [];
  const fieldKey = isDeclarationFieldKey(input.fieldKey) ? input.fieldKey : input.fieldKey;
  if (!rawValue) {
    return {
      fieldKey,
      rawValue: null,
      normalizedValue: null,
      parseConfidence: 0,
      parseNotes: ['empty'],
    };
  }

  let normalizedValue: string | null = rawValue;
  let parseConfidence = clampConfidence(input.confidence ?? 0.5);

  switch (fieldKey) {
    case 'mrp':
    case 'unit_sale_price': {
      const money = parseMoney(rawValue);
      if (money) {
        normalizedValue = formatMoneyNormalized(money);
        parseConfidence = Math.max(parseConfidence, 0.8);
      } else {
        notes.push('unparsed_money');
        parseConfidence = Math.min(parseConfidence, 0.3);
      }
      break;
    }
    case 'net_quantity':
    case 'dimensions': {
      const quantity = parseQuantity(rawValue);
      if (quantity) {
        normalizedValue = formatQuantityNormalized(quantity);
        parseConfidence = Math.max(parseConfidence, 0.75);
      } else {
        notes.push('unparsed_quantity');
        parseConfidence = Math.min(parseConfidence, 0.3);
      }
      break;
    }
    case 'manufacture_or_pack_date':
    case 'import_date':
    case 'best_before':
    case 'use_by': {
      const date = parseDate(rawValue);
      if (date?.iso) {
        normalizedValue = formatDateNormalized(date);
        parseConfidence = Math.max(parseConfidence, date.precision === 'day' ? 0.85 : 0.7);
      } else {
        notes.push('unparsed_date');
        parseConfidence = Math.min(parseConfidence, 0.3);
      }
      break;
    }
    case 'consumer_care': {
      const care = parseConsumerCare(rawValue);
      const parts: string[] = [];
      if (care.phone) {
        parts.push(care.phone.e164Like);
      }
      if (care.email) {
        parts.push(care.email.email);
      }
      if (parts.length > 0) {
        normalizedValue = parts.join(' ');
        parseConfidence = Math.max(parseConfidence, 0.8);
      } else {
        const phone = parsePhone(rawValue);
        const email = parseEmail(rawValue);
        if (phone || email) {
          normalizedValue = [phone?.e164Like, email?.email].filter(Boolean).join(' ');
        } else {
          notes.push('unparsed_contact');
          parseConfidence = Math.min(parseConfidence, 0.3);
        }
      }
      break;
    }
    default: {
      normalizedValue = rawValue;
    }
  }

  return {
    fieldKey,
    rawValue,
    normalizedValue,
    parseConfidence: clampConfidence(parseConfidence),
    parseNotes: notes,
  };
}
