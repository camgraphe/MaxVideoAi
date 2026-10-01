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

test('both manual and policy changes invalidate the real English and localized comparison routes', () => {
  for (const invalidate of [
    (callback: (path: string, type?: 'page' | 'layout') => void) => revalidateCustomerTariffChangeSurfaces('wan-3', callback),
    (callback: (path: string, type?: 'page' | 'layout') => void) => revalidatePricingChangeSurfaces({ affectedSurfaces: ['model-page'], rows: [] } as never, callback),
  ]) {
    const calls: Array<[string, string | undefined]> = [];
    invalidate((path, type) => calls.push([path, type]));
    for (const path of ['/ai-video-engines/[slug]', '/[locale]/ai-video-engines/[slug]']) {
      assert.ok(calls.some(([value, type]) => value === path && type === 'page'), path);
    }
    assert.equal(new Set(calls.map(([path]) => path)).size, calls.length);
  }
});

test('policy changes invalidate model pages even when their scenario is absent from representative preview rows', () => {
  const calls: Array<[string, string | undefined]> = [];
  revalidatePricingChangeSurfaces({ affectedSurfaces: ['pricing-hub'], rows: [] } as never,
    (path, type) => calls.push([path, type]));
  for (const path of ['/models/[slug]', '/[locale]/models/[slug]']) {
    assert.ok(calls.some(([value, type]) => value === path && type === 'page'), path);
  }
});

test('both price edit paths invalidate category cards and actual localized routes behind translated URLs', () => {
  for (const invalidate of [
    (callback: (path: string, type?: 'page' | 'layout') => void) => revalidateCustomerTariffChangeSurfaces('pika-text-to-video', callback),
    (callback: (path: string, type?: 'page' | 'layout') => void) => revalidatePricingChangeSurfaces({ affectedSurfaces: [], rows: [] } as never, callback),
  ]) {
    const calls: Array<[string, string | undefined]> = [];
    invalidate((path, type) => calls.push([path, type]));
    for (const path of ['/pricing', '/models/video', '/models/image']) {
      assert.ok(calls.some(([value]) => value === path), path);
    }
    for (const path of ['/[locale]/pricing', '/[locale]/models', '/[locale]/models/video',
      '/[locale]/models/image', '/models/[slug]', '/[locale]/models/[slug]', '/[locale]',
      '/[locale]/examples', '/[locale]/examples/[model]', '/[locale]/video/[videoId]',
      '/[locale]/pay-as-you-go-ai-video-generator']) {
      assert.ok(calls.some(([value, type]) => value === path && type === 'page'), path);
    }
    assert.equal(new Set(calls.map(([path]) => path)).size, calls.length);
  }
});
