export type ParsedQuantity = {
  value: number;
  unit: string | null;
  count: number | null;
  raw: string;
};

const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gm: 'g',
  gms: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kgs: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  litre: 'l',
  litres: 'l',
  liter: 'l',
  liters: 'l',
  mg: 'mg',
  milligram: 'mg',
  milligrams: 'mg',
  cm: 'cm',
  mm: 'mm',
  m: 'm',
  pcs: 'pcs',
  pc: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  nos: 'nos',
  no: 'nos',
  n: 'nos',
  number: 'nos',
  units: 'pcs',
  unit: 'pcs',
};

export function normalizeUnit(raw: string): string | null {
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  return UNIT_ALIASES[key] ?? (key.length > 0 ? key : null);
}

export function parseQuantity(raw: string): ParsedQuantity | null {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) {
    return null;
  }

  const match = text.match(
    /(?:net\s*(?:qty|quantity|wt|weight|content)|qty|quantity|net)?[:\s]*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]+)?/i,
  );
  if (!match) {
    return null;
  }
  const value = Number.parseFloat(match[1] ?? '');
  if (!Number.isFinite(value)) {
    return null;
  }
  const unit = match[2] ? normalizeUnit(match[2]) : null;
  const count = unit === 'pcs' || unit === 'nos' ? value : null;
  return { value, unit, count, raw: text };
}

export function formatQuantityNormalized(parsed: ParsedQuantity): string {
  return parsed.unit ? `${parsed.value} ${parsed.unit}` : String(parsed.value);
}
