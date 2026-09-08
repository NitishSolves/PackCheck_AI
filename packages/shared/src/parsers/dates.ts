const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export type ParsedDate = {
  year: number;
  month: number | null;
  day: number | null;
  iso: string | null;
  precision: 'day' | 'month' | 'year';
  raw: string;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function asIso(year: number, month: number | null, day: number | null): string | null {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return null;
  }
  if (month === null) {
    return `${year}`;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  if (day === null) {
    return `${year}-${pad(month)}`;
  }
  if (day < 1 || day > 31) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseYear(value: string): number | null {
  if (/^\d{2}$/.test(value)) {
    const two = Number.parseInt(value, 10);
    return two >= 70 ? 1900 + two : 2000 + two;
  }
  if (/^\d{4}$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return null;
}

export function parseDate(raw: string): ParsedDate | null {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) {
    return null;
  }

  const iso = text.match(/\b(\d{4})-(\d{2})(?:-(\d{2}))?\b/);
  if (iso) {
    const year = Number.parseInt(iso[1] ?? '', 10);
    const month = Number.parseInt(iso[2] ?? '', 10);
    const day = iso[3] ? Number.parseInt(iso[3], 10) : null;
    return {
      year,
      month,
      day,
      iso: asIso(year, month, day),
      precision: day ? 'day' : 'month',
      raw: text,
    };
  }

  const numeric = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (numeric) {
    const first = Number.parseInt(numeric[1] ?? '', 10);
    const second = Number.parseInt(numeric[2] ?? '', 10);
    const year = parseYear(numeric[3] ?? '');
    if (year) {
      const dayFirst = first > 12 || second <= 12;
      const day = dayFirst ? first : second;
      const month = dayFirst ? second : first;
      return {
        year,
        month,
        day,
        iso: asIso(year, month, day),
        precision: 'day',
        raw: text,
      };
    }
  }

  const numericMonthYear = text.match(/\b(\d{1,2})[./-](\d{4})\b/);
  if (numericMonthYear) {
    const month = Number.parseInt(numericMonthYear[1] ?? '', 10);
    const year = Number.parseInt(numericMonthYear[2] ?? '', 10);
    if (month >= 1 && month <= 12) {
      return {
        year,
        month,
        day: null,
        iso: asIso(year, month, null),
        precision: 'month',
        raw: text,
      };
    }
  }

  const monthYear = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[./-]?[\s]*(\d{4}|\d{2})\b/i,
  );
  if (monthYear) {
    const month = MONTHS[(monthYear[1] ?? '').toLowerCase()] ?? null;
    const year = parseYear(monthYear[2] ?? '');
    if (month && year) {
      return {
        year,
        month,
        day: null,
        iso: asIso(year, month, null),
        precision: 'month',
        raw: text,
      };
    }
  }

  const yearOnly = text.match(/\b((?:19|20)\d{2})\b/);
  if (yearOnly) {
    const year = Number.parseInt(yearOnly[1] ?? '', 10);
    return {
      year,
      month: null,
      day: null,
      iso: asIso(year, null, null),
      precision: 'year',
      raw: text,
    };
  }

  return null;
}

export function formatDateNormalized(parsed: ParsedDate): string | null {
  return parsed.iso;
}
