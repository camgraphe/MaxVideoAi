import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { ProductPolicyEditor } from '../frontend/app/(core)/admin/pricing/_components/ProductPolicyEditor.client';
import { createPricingPolicyDraft, type PricingPolicyInventoryRow } from '../frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model';
import { AdminPricingChangePreviewDialog } from '../frontend/components/admin-system/pricing/AdminPricingChangePreviewDialog';

Object.assign(globalThis, { React });
const row: PricingPolicyInventoryRow = { selector: { engineId: 'character-recast', mode: 'recast', resolution: 'video' },
  versionedRule: null, databaseOverride: null, effectiveProvenance: null, representativeQuotes: [], routingContext: null, lastEvent: null };

test('Recast editor shows a bounded coefficient and does not offer incompatible fee controls', () => {
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(ProductPolicyEditor, { row, draft: createPricingPolicyDraft(row, true),
    locked: false, busy: false, onChange: () => {}, onPreview: () => {}, onClose: () => {} })));
  const inputs = dom.window.document.querySelectorAll('input');
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].getAttribute('aria-label'), 'Supplier cost coefficient (×)');
  assert.equal(inputs[0].value, '2');
  assert.equal(inputs[0].min, '1');
  assert.equal(inputs[0].max, '10');
  assert.match(dom.window.document.body.textContent!, /Source and output seconds/);
  dom.window.close();
});

test('first Recast preview renders unavailable baseline without a fabricated zero or delta', () => {
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(AdminPricingChangePreviewDialog, {
    busy: false, onCancel: () => {}, onConfirm: () => {}, preview: {
      previewFingerprint: 'recast-review', domain: 'policy_rule', operation: 'create', targetId: 'recast-only',
      currentState: null, proposedState: {}, affectedScenarioIds: ['sample'], affectedSurfaces: ['tool'], warnings: [],
      rows: [{ scenarioId: 'sample', engineId: 'character-recast', surface: 'tool', currentTotalCents: null,
        proposedTotalCents: 232, deltaCents: null, deltaPercent: null, currentProvenance: null,
        proposedProvenance: { source: 'database', sourceRuleId: 'recast-only', matchedBy: 'precise', compatibilityProfile: 'standard' },
        compatibilityProfile: 'standard' }],
    },
  })));
  const content = dom.window.document.body.textContent!;
  assert.match(content, /Unavailable/);
  assert.match(content, /\$2\.32/);
  assert.match(content, /No current price/);
  assert.doesNotMatch(content, /\$0\.00/);
  assert.equal(dom.window.document.querySelectorAll('input,select').length, 0);
  dom.window.close();
});
