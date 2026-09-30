import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { buildDynamicToolProductPreviews } from '../frontend/server/pricing-admin/billing-product-dynamic-preview';
import { AdminPricingChangePreviewDialog } from '../frontend/components/admin-system/pricing/AdminPricingChangePreviewDialog';
import type { PricingChangePreview } from '../frontend/lib/admin/pricing-change-contract';

const frontendRequire = createRequire(resolve('frontend/package.json'));
const React = frontendRequire('react');
Object.assign(globalThis, { React });
const { renderToStaticMarkup } = frontendRequire('react-dom/server');
const provenance = { source: 'database' as const, matchedBy: 'global' as const,
  sourceRuleId: 'default', compatibilityProfile: 'fixed-product-current' };

test('dynamic processing references carry readable duration and resolution labels alongside stable audit identities', () => {
  const rows = buildDynamicToolProductPreviews({ productKey: 'upscale-video-topaz', surface: 'upscale',
    label: 'Upscale Video Topaz', currency: 'USD', unitKind: 'run', unitPriceCents: 80,
    active: true, metadata: null });
  const tenSeconds = rows.find(row => row.scenarioId.endsWith(':10s:1080p:720p-source:30fps'))!;
  assert.ok(tenSeconds);
  assert.equal((tenSeconds as typeof tenSeconds & { scenarioLabel?: string }).scenarioLabel, '10 s · 720p → 1080p · 30 fps');
  assert.equal(tenSeconds.totalCents, 80);
});

test('factor-only FlashVSR references name the actual processing factor while preserving the current billing amount', () => {
  const rows = buildDynamicToolProductPreviews({ productKey: 'upscale-video-flashvsr', surface: 'upscale',
    label: 'FlashVSR Video Upscale', currency: 'USD', unitKind: 'run', unitPriceCents: 80,
    active: true, metadata: null });
  const tenSeconds = rows.find(row => row.scenarioId.endsWith(':10s:1080p:720p-source:30fps'))!;
  assert.equal(tenSeconds.scenarioLabel, '10 s · 720p source · 2× · 30 fps');
  assert.equal(tenSeconds.totalCents, 125, 'labels must not silently change the current quote calculation');
});

test('price review leads with readable scenarios and accurate changed count while audit details stay collapsed', () => {
  const preview = { previewFingerprint: 'fixture', operation: 'update', domain: 'billing_product',
    targetId: 'upscale-video-topaz', currentState: { label: 'Upscale Video Topaz', currency: 'USD' },
    proposedState: { label: 'Upscale Video Topaz', currency: 'USD' }, affectedScenarioIds: ['minimum', 'processing'],
    affectedSurfaces: ['upscale'], warnings: [], rows: [
      { scenarioId: 'billing-product:upscale-video-topaz', scenarioLabel: 'Minimum per run', engineId: 'upscale-video-topaz',
        surface: 'upscale', currentTotalCents: 80, proposedTotalCents: 60, deltaCents: -20, deltaPercent: -0.25,
        currentProvenance: provenance, proposedProvenance: provenance, compatibilityProfile: 'fixed-product-current' },
      { scenarioId: 'billing-product:upscale-video-topaz:10s:1080p:720p-source:30fps', scenarioLabel: '10 s · 720p → 1080p · 30 fps',
        engineId: 'upscale-video-topaz', surface: 'upscale', currentTotalCents: 80, proposedTotalCents: 80, deltaCents: 0, deltaPercent: 0,
        currentProvenance: provenance, proposedProvenance: provenance, compatibilityProfile: 'fixed-product-current' },
    ] } as unknown as PricingChangePreview;
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(AdminPricingChangePreviewDialog,
    { preview, busy: false, onCancel() {}, onConfirm() {} })));
  const document = dom.window.document;
  assert.match(document.querySelector('h2')!.textContent!, /Upscale Video Topaz/);
  assert.match(document.querySelector('header')!.textContent!, /2 scenarios · 1 price changed/);
  const priceTable = document.querySelector('table')!;
  assert.equal(priceTable.querySelectorAll('thead th').length, 4);
  assert.match(priceTable.textContent!, /Minimum per run/);
  assert.match(priceTable.textContent!, /10 s · 720p → 1080p · 30 fps/);
  assert.doesNotMatch(priceTable.textContent!, /billing-product:|fixed-product-current/);
  const details = document.querySelector('details')!;
  assert.ok(details);
  assert.equal(details.open, false);
  assert.match(details.textContent!, /billing-product:upscale-video-topaz:10s:1080p:720p-source:30fps/);
  assert.match(details.textContent!, /fixed-product-current/);
  assert.match(document.querySelector('footer')!.textContent!, /Cancel.*Confirm and apply now/);
  dom.window.close();
});
