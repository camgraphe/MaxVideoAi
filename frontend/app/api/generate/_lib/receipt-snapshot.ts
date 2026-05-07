import type { PricingSnapshot } from '@/types/engines';

type DiscountCandidate = {
  amountCents?: number;
  percentApplied?: number;
  label?: string;
};

type TaxCandidate = {
  amountCents?: number;
  label?: string;
};

export function buildReceiptSnapshot(pricing: PricingSnapshot): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {
    totalCents: pricing.totalCents,
    currency: pricing.currency,
  };

  const discountCandidate = (pricing as unknown as { discount?: DiscountCandidate }).discount;
  if (discountCandidate && typeof discountCandidate.amountCents === 'number' && discountCandidate.amountCents > 0) {
    snapshot.discount = {
      amountCents: discountCandidate.amountCents,
      percentApplied: discountCandidate.percentApplied ?? null,
      label: discountCandidate.label ?? null,
    };
  }

  const taxesCandidate = (pricing as unknown as { taxes?: TaxCandidate[] }).taxes;
  if (Array.isArray(taxesCandidate)) {
    const taxes = taxesCandidate
      .filter((tax) => tax && typeof tax.amountCents === 'number' && tax.amountCents > 0)
      .map((tax) => ({
        amountCents: tax.amountCents!,
        label: tax.label ?? null,
      }));
    if (taxes.length) {
      snapshot.taxes = taxes;
    }
  }

  return snapshot;
}
