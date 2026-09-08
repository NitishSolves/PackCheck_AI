import { describe, expect, it } from 'vitest';
import { parseDate } from './dates.js';
import { parseEmail, parsePhone } from './contact.js';
import { parseMoney } from './money.js';
import { parseQuantity } from './quantity.js';
import { normalizeDeclarationField, normalizeDeclarationFields } from './normalize-declaration.js';

describe('parseMoney', () => {
  it('parses INR MRP with symbol and inclusive taxes', () => {
    const parsed = parseMoney('MRP Rs. 1,299.00 inclusive of all taxes');
    expect(parsed).toMatchObject({ amount: 1299, amountMinor: 129900, currency: 'INR', inclusiveOfTaxes: true });
  });

  it('returns null for non-money text', () => {
    expect(parseMoney('Packed by Acme Foods')).toBeNull();
  });
});

describe('parseQuantity', () => {
  it('normalizes grams and millilitres', () => {
    expect(parseQuantity('Net Qty 500 g')).toMatchObject({ value: 500, unit: 'g' });
    expect(parseQuantity('Net Quantity: 1.5 L')).toMatchObject({ value: 1.5, unit: 'l' });
    expect(parseQuantity('10 pieces')).toMatchObject({ value: 10, unit: 'pcs', count: 10 });
  });

  it('returns null when no numeric quantity exists', () => {
    expect(parseQuantity('see label')).toBeNull();
  });
});

describe('parseDate', () => {
  it('parses day/month/year and month-year forms', () => {
    expect(parseDate('Packed on 07/03/2024')?.iso).toBe('2024-03-07');
    expect(parseDate('MFD Jan 2025')?.iso).toBe('2025-01');
    expect(parseDate('2024-11')?.iso).toBe('2024-11');
  });

  it('returns null for unparseable periods', () => {
    expect(parseDate('best before 12 months')).toBeNull();
  });
});

describe('parsePhone and parseEmail', () => {
  it('normalizes Indian consumer-care contacts', () => {
    expect(parsePhone('Customer care: 1800-425-1234')?.e164Like).toBe('+18004251234');
    expect(parsePhone('+91 98765 43210')?.e164Like).toBe('+919876543210');
    expect(parseEmail('Care: Care@Brand.example.com')?.email).toBe('care@brand.example.com');
    expect(parsePhone('no digits')).toBeNull();
  });
});

describe('normalizeDeclarationFields', () => {
  it('normalizes known fields and keeps unknown keys as evidence', () => {
    const [mrp, date, unknown] = normalizeDeclarationFields([
      { fieldKey: 'mrp', rawValue: 'MRP ₹ 99.00', confidence: 0.9 },
      { fieldKey: 'manufacture_or_pack_date', rawValue: '07/2024', confidence: 0.7 },
      { fieldKey: 'other_marking', rawValue: 'FSSAI 123', confidence: 0.4 },
    ]);
    expect(mrp?.normalizedValue).toBe('INR 99.00');
    expect(date?.normalizedValue).toBe('2024-07');
    expect(unknown?.fieldKey).toBe('other_marking');
    expect(unknown?.normalizedValue).toBe('FSSAI 123');
  });

  it('marks unparsed money as low-confidence without inventing a value', () => {
    const result = normalizeDeclarationField({ fieldKey: 'mrp', rawValue: 'see sticker', confidence: 0.9 });
    expect(result.normalizedValue).toBe('see sticker');
    expect(result.parseConfidence).toBeLessThan(0.5);
    expect(result.parseNotes).toContain('unparsed_money');
  });
});
