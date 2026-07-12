import assert from 'node:assert/strict';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db.ts';
import {
  insertPricingChangeEvent,
  listPricingChangeEvents,
} from '../frontend/server/pricing-admin/event-store.ts';

type QueryCall = {
  text: string;
  params?: ReadonlyArray<unknown>;
};

const rawEvent = {
  id: '10000000-0000-0000-0000-000000000001',
  domain: 'policy_rule',
  operation: 'update',
  target_id: 'rule-kling-t2v-1080p',
  actor_id: '00000000-0000-0000-0000-000000000001',
  previous_state: { marginPercent: 0.3 },
  next_state: { marginPercent: 0.35 },
  preview_summary: { deltaCents: 2 },
  affected_scenario_ids: ['kling-3-pro:t2v:1080p:5s'],
  created_at: new Date('2026-07-12T10:00:00.000Z'),
};

function buildExecutor(rows: unknown[], calls: QueryCall[]): QueryExecutor {
  return {
    async query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<TRecord[]> {
      calls.push({ text, params });
      return rows as TRecord[];
    },
  };
}

test('insertPricingChangeEvent inserts exactly one complete immutable event', async () => {
  const calls: QueryCall[] = [];
  const event = await insertPricingChangeEvent(buildExecutor([rawEvent], calls), {
    domain: 'policy_rule',
    operation: 'update',
    targetId: 'rule-kling-t2v-1080p',
    actorId: '00000000-0000-0000-0000-000000000001',
    previousState: { marginPercent: 0.3 },
    nextState: { marginPercent: 0.35 },
    previewSummary: { deltaCents: 2 },
    affectedScenarioIds: ['kling-3-pro:t2v:1080p:5s'],
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.text, /INSERT INTO app_pricing_change_events/);
  assert.match(calls[0]!.text, /RETURNING/);
  assert.deepEqual(calls[0]!.params, [
    'policy_rule',
    'update',
    'rule-kling-t2v-1080p',
    '00000000-0000-0000-0000-000000000001',
    JSON.stringify({ marginPercent: 0.3 }),
    JSON.stringify({ marginPercent: 0.35 }),
    JSON.stringify({ deltaCents: 2 }),
    JSON.stringify(['kling-3-pro:t2v:1080p:5s']),
  ]);
  assert.deepEqual(event, {
    id: rawEvent.id,
    domain: 'policy_rule',
    operation: 'update',
    targetId: rawEvent.target_id,
    actorId: rawEvent.actor_id,
    previousState: { marginPercent: 0.3 },
    nextState: { marginPercent: 0.35 },
    previewSummary: { deltaCents: 2 },
    affectedScenarioIds: ['kling-3-pro:t2v:1080p:5s'],
    createdAt: '2026-07-12T10:00:00.000Z',
  });
});

test('listPricingChangeEvents applies domain and target filters and caps history at 200 rows', async () => {
  const calls: QueryCall[] = [];
  const events = await listPricingChangeEvents(
    { domain: 'policy_rule', targetId: 'rule-kling-t2v-1080p', limit: 999 },
    buildExecutor([rawEvent], calls)
  );

  assert.equal(events.length, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.text, /domain = \$1/);
  assert.match(calls[0]!.text, /target_id = \$2/);
  assert.match(calls[0]!.text, /LIMIT \$3/);
  assert.deepEqual(calls[0]!.params, ['policy_rule', 'rule-kling-t2v-1080p', 200]);
});

test('listPricingChangeEvents maps malformed JSON fields defensively', async () => {
  const calls: QueryCall[] = [];
  const [event] = await listPricingChangeEvents(
    { limit: 10 },
    buildExecutor(
      [
        {
          ...rawEvent,
          previous_state: '{"marginPercent":0.3}',
          next_state: '{not-json',
          preview_summary: ['unexpected'],
          affected_scenario_ids: ['valid', 42, '', null],
          created_at: '2026-07-12T10:00:00.000Z',
        },
      ],
      calls
    )
  );

  assert.deepEqual(event?.previousState, { marginPercent: 0.3 });
  assert.equal(event?.nextState, null);
  assert.deepEqual(event?.previewSummary, {});
  assert.deepEqual(event?.affectedScenarioIds, ['valid']);
});
