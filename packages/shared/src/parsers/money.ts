export type ParsedMoney = {
  amountMinor: number;
  amount: number;
  currency: string;
  inclusiveOfTaxes: boolean | null;
  raw: string;
};

const INR_SYMBOLS = /(?:₹|rs\.?|inr|rupees?)/i;

export function parseMoney(raw: string): ParsedMoney | null {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) {
    return null;
  }

  const inclusive = /inclusive of all taxes/i.test(text)
    ? true
    : /exclusive of (?:all )?taxes/i.test(text)
      ? false
      : null;

  const hasMoneyContext = /m\.?r\.?p\.?|maximum retail price|unit sale price|\busp\b|₹|\brs\.?\b|\binr\b|rupees?|\bprice\b/i.test(
    text,
  );
  if (!hasMoneyContext) {
    return null;
  }

  const match = text.match(
    /(?:m\.?r\.?p\.?|maximum retail price|unit sale price|usp|price)?[:\s]*(₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
  );
  if (!match) {
    return null;
  }

  const numeric = (match[2] ?? '').replace(/,/g, '');
  const amount = Number.parseFloat(numeric);
  if (!Number.isFinite(amount)) {
    return null;
  }

  return {
    amount,
    amountMinor: Math.round(amount * 100),
    currency: INR_SYMBOLS.test(text) || match[1] ? 'INR' : 'INR',
    inclusiveOfTaxes: inclusive,
    raw: text,
  };
}

export function formatMoneyNormalized(parsed: ParsedMoney): string {
  return `${parsed.currency} ${parsed.amount.toFixed(2)}`;
}
