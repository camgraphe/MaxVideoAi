import assert from 'node:assert/strict';
import test from 'node:test';
import { revalidateCustomerTariffChangeSurfaces } from '../frontend/server/pricing-admin/revalidation.ts';

test('a live customer price edit invalidates Pricing, the model, current examples and watch pages', () => {
  const calls: Array<[string, string | undefined]> = [];
  revalidateCustomerTariffChangeSurfaces('pika-text-to-video', (path, type) => { calls.push([path, type]); });
  for (const path of ['/pricing', '/fr/tarifs', '/es/precios', '/', '/fr', '/es',
    '/models/pika-text-to-video', '/fr/modeles/pika-text-to-video', '/es/modelos/pika-text-to-video', '/examples']) {
    assert.ok(calls.some(([value]) => value === path), path);
  }
  assert.ok(calls.some(([path, type]) => path === '/video/[id]' && type === 'page'));
  assert.equal(new Set(calls.map(([path]) => path)).size, calls.length);
});
