export type CustomerPriceLine = { amountCents: number; label?: string };
export type CustomerPricingSnapshot = {
  totalCents: number;
  currency: string;
  subtotalBeforeDiscountCents?: number;
  discount?: CustomerPriceLine & { percentApplied?: number; tier?: string };
  taxes?: CustomerPriceLine[];
  customerFees?: CustomerPriceLine[];
  membershipTier?: string;
  meta?: { pricingMode?: 'manual_tariff'; customerTariffRevision?: number; workflowStep?: 'draft' | 'final' };
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function priceLine(value: unknown): CustomerPriceLine | undefined {
  if (!record(value) || !cents(value.amountCents)) return undefined;
  return { amountCents: value.amountCents, ...(typeof value.label === 'string' ? { label: value.label } : {}) };
}

function customerLines(value: unknown): CustomerPriceLine[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const lines = value.map(priceLine).filter((line): line is CustomerPriceLine => line !== undefined);
  return lines.length ? lines : undefined;
}

/** Public API and account export contract. Full snapshots are used only by server-side accounting. */
export function customerPricingSnapshot(value: unknown): CustomerPricingSnapshot | undefined {
  if (!record(value) || !cents(value.totalCents) || typeof value.currency !== 'string' || !/^[a-z]{3}$/i.test(value.currency)) return undefined;
  const result: CustomerPricingSnapshot = { totalCents: value.totalCents, currency: value.currency.toUpperCase() };
  if (cents(value.subtotalBeforeDiscountCents)) result.subtotalBeforeDiscountCents = value.subtotalBeforeDiscountCents;
  if (typeof value.membershipTier === 'string') result.membershipTier = value.membershipTier;
  const discount = priceLine(value.discount);
  if (discount && record(value.discount)) {
    result.discount = discount;
    if (typeof value.discount.percentApplied === 'number' && Number.isFinite(value.discount.percentApplied)) result.discount.percentApplied = value.discount.percentApplied;
    if (typeof value.discount.tier === 'string') result.discount.tier = value.discount.tier;
  }
  const taxes = customerLines(value.taxes);
  if (taxes) result.taxes = taxes;
  const fees = customerLines(value.customerFees);
  if (fees) result.customerFees = fees;
  if (record(value.meta)) {
    const meta: NonNullable<CustomerPricingSnapshot['meta']> = {};
    if (value.meta.pricingMode === 'manual_tariff') {
      meta.pricingMode = 'manual_tariff';
      if (cents(value.meta.customerTariffRevision)) meta.customerTariffRevision = value.meta.customerTariffRevision;
    }
    if (value.meta.workflowStep === 'draft' || value.meta.workflowStep === 'final') meta.workflowStep = value.meta.workflowStep;
    if (Object.keys(meta).length) result.meta = meta;
  }
  return result;
}
