export type ParsedPhone = {
  e164Like: string;
  digits: string;
  raw: string;
};

export type ParsedEmail = {
  email: string;
  raw: string;
};

export function parsePhone(raw: string): ParsedPhone | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }
  const digits = text.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return null;
  }
  const withCountry =
    digits.length === 10 ? `91${digits}` : digits.startsWith('0') ? `91${digits.slice(1)}` : digits;
  return {
    digits: withCountry,
    e164Like: `+${withCountry}`,
    raw: text,
  };
}

export function parseEmail(raw: string): ParsedEmail | null {
  const match = raw.trim().toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (!match) {
    return null;
  }
  return { email: match[0].toLowerCase(), raw: raw.trim() };
}

export function parseConsumerCare(raw: string): { phone: ParsedPhone | null; email: ParsedEmail | null } {
  return {
    phone: parsePhone(raw),
    email: parseEmail(raw),
  };
}
