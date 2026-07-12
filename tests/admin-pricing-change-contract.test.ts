import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PRICING_CHANGE_DOMAINS,
  PRICING_CHANGE_OPERATIONS,
  type PricingChangeEvent,
} from '../frontend/lib/admin/pricing-change-contract.ts';

const contractPath = 'frontend/lib/admin/pricing-change-contract.ts';

test('pricing change contract exposes the complete immutable event vocabulary', () => {
  assert.deepEqual(PRICING_CHANGE_DOMAINS, ['policy_rule', 'membership', 'billing_product']);
  assert.deepEqual(PRICING_CHANGE_OPERATIONS, ['create', 'update', 'delete', 'rollback']);
});

test('pricing change event DTOs are browser-safe and JSON serializable', () => {
  const source = readFileSync(contractPath, 'utf8');
  assert.doesNotMatch(source, /@\/lib\/db|node:|frontend\/server|@\/server/);

  const event: PricingChangeEvent = {
    id: '10000000-0000-0000-0000-000000000001',
    domain: 'policy_rule',
    operation: 'update',
    targetId: 'rule-kling-t2v-1080p',
    actorId: '00000000-0000-0000-0000-000000000001',
    previousState: { marginPercent: 0.3 },
    nextState: { marginPercent: 0.35 },
    previewSummary: { changedFields: ['marginPercent'], deltaCents: 2 },
    affectedScenarioIds: ['kling-3-pro:t2v:1080p:5s'],
    createdAt: '2026-07-12T10:00:00.000Z',
  };

  assert.deepEqual(JSON.parse(JSON.stringify(event)), event);
});
