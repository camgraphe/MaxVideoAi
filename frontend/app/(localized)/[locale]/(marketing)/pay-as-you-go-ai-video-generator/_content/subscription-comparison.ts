import type { PaygHeaderCopy } from './types';

/** Authored platform-comparison copy and contextual destinations, without pricing logic. */
export type PaygSubscriptionComparison = {
  header: PaygHeaderCopy;
  higgsfieldLinkLabel: string;
  openartLinkLabel: string;
  budgetLink: { label: string; slug: string };
  columns: [string, string, string];
  rows: Array<{ label: string; payg: string; subscription: string }>;
};
