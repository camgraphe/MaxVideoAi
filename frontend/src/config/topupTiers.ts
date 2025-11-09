export type TopupTier = {
  id: string;
  label: string;
  amountCents: number;
};

export const USD_TOPUP_TIERS: TopupTier[] = [
  { id: 'usd_10', label: '$10', amountCents: 1000 },
  { id: 'usd_25', label: '$25', amountCents: 2500 },
  { id: 'usd_50', label: '$50', amountCents: 5000 },
  { id: 'usd_100', label: '$100', amountCents: 10000 },
];

export function findTopupTier({
  usdAmountCents,
  tierId,
}: {
  usdAmountCents?: number;
  tierId?: string | null;
}): TopupTier | null {
  if (tierId) {
    const byId = USD_TOPUP_TIERS.find((tier) => tier.id === tierId);
    if (byId) return byId;
  }
  if (typeof usdAmountCents === 'number' && Number.isFinite(usdAmountCents)) {
    const byAmount = USD_TOPUP_TIERS.find((tier) => tier.amountCents === usdAmountCents);
    if (byAmount) return byAmount;
  }
  return null;
}
