import assert from 'node:assert/strict';
import test from 'node:test';
import { customerTariffRequestHeaders, notifyCustomerPricingRefresh, CUSTOMER_PRICING_REFRESH_EVENT } from '../frontend/lib/customer-tariff-revision';

test('browser confirmation sends only a valid displayed manual revision', () => {
  assert.deepEqual(customerTariffRequestHeaders({ meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } }),
    { 'x-maxvideoai-customer-tariff': '7' });
  assert.deepEqual(customerTariffRequestHeaders({ meta: { customerTariffRevision: 7 } }), {});
  assert.deepEqual(customerTariffRequestHeaders({ meta: { pricingMode: 'manual_tariff', customerTariffRevision: NaN } }), {});
});

test('a stale confirmation invalidates displayed prices without automatically submitting another generation', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const window = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  let refreshes = 0;
  window.addEventListener(CUSTOMER_PRICING_REFRESH_EVENT, () => { refreshes += 1; });
  try {
    notifyCustomerPricingRefresh('PRICING_REFRESH_REQUIRED');
    notifyCustomerPricingRefresh('INSUFFICIENT_FUNDS');
    assert.equal(refreshes, 1);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
