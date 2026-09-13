export type AcceptedToolQuote = { totalCents: number; currency: string };
/** Repricing is checked before any job/debit. Legacy callers can omit acceptance. */
export function matchesAcceptedToolQuote(accepted: unknown, current: AcceptedToolQuote): boolean {
  if (accepted === undefined) return true;
  if (!accepted || typeof accepted !== 'object') return false;
  const quote = accepted as Partial<AcceptedToolQuote>;
  return Number.isSafeInteger(quote.totalCents) && quote.totalCents === current.totalCents && quote.currency === current.currency;
}
