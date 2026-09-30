import assert from 'node:assert/strict';
import test from 'node:test';
import { revalidateCustomerTariffChangeSurfaces, revalidatePricingChangeSurfaces } from '../frontend/server/pricing-admin/revalidation.ts';

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

test('price edits also invalidate model catalogue cards and fixed-product Pricing rows', () => {
  const modelPaths: string[] = [];
  revalidateCustomerTariffChangeSurfaces('pika-text-to-video', (path) => { modelPaths.push(path); });
  for (const path of ['/models', '/fr/modeles', '/es/modelos']) assert.ok(modelPaths.includes(path), path);
  const toolPaths: string[] = [];
  revalidatePricingChangeSurfaces({ affectedSurfaces: ['tool'], rows: [] } as never, (path) => { toolPaths.push(path); });
  for (const path of ['/pricing', '/fr/tarifs', '/es/precios']) assert.ok(toolPaths.includes(path), path);
});
