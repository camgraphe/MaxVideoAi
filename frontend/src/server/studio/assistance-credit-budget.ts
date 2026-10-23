/** Server-authored authorization. Immutable funding remains the customer cap authority. */
export type StudioCreditCompletion = {
  version: 1;
  customerCapCents: number;
  maximumIncrementCents: number;
  accountedIncrementCents?: number;
  giftCents?: number;
};

export function readStudioCreditCompletion(snapshot: unknown, fundingCapCents?: number): StudioCreditCompletion | null {
  const raw = snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>).creditCompletion : undefined;
  if (raw === undefined) return null;
  const value = raw as StudioCreditCompletion;
  const valid = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
  if (!value || value.version !== 1 || !valid(value.customerCapCents) || value.customerCapCents <= 0
    || !valid(value.maximumIncrementCents) || value.maximumIncrementCents <= value.customerCapCents
    || (fundingCapCents !== undefined && value.customerCapCents !== fundingCapCents)
    || ((value.accountedIncrementCents !== undefined || value.giftCents !== undefined)
      && (!valid(value.accountedIncrementCents) || value.accountedIncrementCents > value.maximumIncrementCents
        || !valid(value.giftCents) || value.giftCents !== Math.max(0, value.accountedIncrementCents - value.customerCapCents)))) {
    throw new Error('Invalid Studio credit completion authorization');
  }
  return value;
}
