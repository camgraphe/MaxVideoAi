import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearPendingWalletCheckoutReturn,
  consumePendingWalletCheckoutReturn,
  persistPendingWalletCheckoutReturn,
} from '../frontend/lib/wallet/checkout-return';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

test('pending checkout return accepts /app and consumes it once', () => {
  const storage = createStorage();
  assert.equal(persistPendingWalletCheckoutReturn('/app', { storage, now: 1_000 }), true);
  assert.equal(consumePendingWalletCheckoutReturn({ storage, now: 2_000 }), '/app');
  assert.equal(consumePendingWalletCheckoutReturn({ storage, now: 2_000 }), null);
});

test('pending checkout return rejects non-allowlisted and expired values', () => {
  const storage = createStorage();
  assert.equal(persistPendingWalletCheckoutReturn('/billing', { storage, now: 1_000 }), false);
  assert.equal(persistPendingWalletCheckoutReturn('/app', { storage, now: 1_000 }), true);
  assert.equal(consumePendingWalletCheckoutReturn({ storage, now: 3_601_001 }), null);
});

test('pending checkout return tolerates unavailable storage and can be cleared', () => {
  const throwingStorage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.equal(persistPendingWalletCheckoutReturn('/app', { storage: throwingStorage, now: 1_000 }), false);
  assert.equal(consumePendingWalletCheckoutReturn({ storage: throwingStorage, now: 1_000 }), null);
  assert.doesNotThrow(() => clearPendingWalletCheckoutReturn({ storage: throwingStorage }));
});
