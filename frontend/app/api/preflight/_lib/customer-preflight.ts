import { customerPricingSnapshot } from '@/lib/customer-pricing-snapshot';
import type { PreflightResponse } from '@/types/engines';

export function customerPreflightResponse(response: PreflightResponse) {
  if (!response.ok) {
    if (response.error?.code === 'PRICING_ERROR') {
      const message = 'Pricing is unavailable for these settings.';
      return { ok: false, messages: [message], error: { code: 'PRICING_ERROR', message } };
    }
    const error = response.error;
    return {
      ok: false, messages: response.messages,
      ...(error ? { error: {
        code: error.code, message: error.message, field: error.field,
        durationSec: error.durationSec, maxDurationSec: error.maxDurationSec,
      } } : {}),
    };
  }
  const pricing = customerPricingSnapshot(response.pricing);
  const caps = response.caps;
  const base = pricing?.subtotalBeforeDiscountCents ?? response.total;
  const taxes = (response.itemization?.taxes ?? []).map(line => ({ type: 'tax', subtotal: line.subtotal }));
  const discounts = (response.itemization?.discounts ?? []).map(line => ({ type: 'discount', subtotal: line.subtotal, tier: line.tier }));
  const fees = pricing?.customerFees?.map(line => ({ type: 'customer_fee', subtotal: line.amountCents }));
  return {
    ok: true, total: response.total, currency: response.currency, ttlSec: response.ttlSec, messages: response.messages, pricing,
    ...(typeof base === 'number' ? { itemization: {
      base: { type: 'base', subtotal: base - taxes.reduce((sum, line) => sum + line.subtotal, 0) - (fees ?? []).reduce((sum, line) => sum + line.subtotal, 0) },
      addons: [], fees, discounts, taxes,
    } } : {}),
    ...(caps ? { caps: {
      id: caps.id, label: caps.label, maxDurationSec: caps.maxDurationSec, resolutions: caps.resolutions,
      aspectRatios: caps.aspectRatios, fps: caps.fps, params: caps.params, inputLimits: caps.inputLimits, inputSchema: caps.inputSchema,
    } } : {}),
  };
}
