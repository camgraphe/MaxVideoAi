export const CUSTOMER_TARIFF_REVISION_HEADER = 'x-maxvideoai-customer-tariff';
export const CUSTOMER_PRICING_REFRESH_EVENT = 'pricing:refresh-required';

/** Refresh the quote only; the customer must confirm the next generation themselves. */
export function notifyCustomerPricingRefresh(code: unknown): void {
  if (code === 'PRICING_REFRESH_REQUIRED' && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CUSTOMER_PRICING_REFRESH_EVENT));
  }
}

export function customerTariffRevision(snapshot: unknown): number | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const meta = (snapshot as { meta?: Record<string, unknown> }).meta;
  if (meta?.pricingMode !== 'manual_tariff') return null;
  const revision = meta.customerTariffRevision;
  return typeof revision === 'number' && Number.isSafeInteger(revision) && revision > 0 ? revision : null;
}

export function customerTariffRequestHeaders(snapshot: unknown): Record<string, string> {
  const revision = customerTariffRevision(snapshot);
  return revision == null ? {} : { [CUSTOMER_TARIFF_REVISION_HEADER]: String(revision) };
}
