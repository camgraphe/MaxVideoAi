/** Dated public price observation. This is editorial arithmetic, never a live quote. */
export const projectCostExample = {
  checked: '2026-11-10',
  unitCents: 156,
  initialFundingCents: 1000,
  pricePath: '/pricing',
  priceFragment: 'ltx-2-5-pro-pricing',
} as const;

export type ProjectAttemptCount = 1 | 3 | 6;

export function projectAttemptBudget(attempts: ProjectAttemptCount) {
  if (![1, 3, 6].includes(attempts)) throw new RangeError('Unsupported editorial scenario');
  const spentCents = attempts * projectCostExample.unitCents;
  return { attempts, spentCents, remainingCents: projectCostExample.initialFundingCents - spentCents };
}
