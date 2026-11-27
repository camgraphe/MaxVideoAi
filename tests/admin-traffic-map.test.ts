import assert from 'node:assert/strict';
import test from 'node:test';
import { demoProviderNodes, demoTraces, eventKey, newObservedEvents, observedProviderNodes } from '../frontend/app/(core)/admin/routing/_lib/traffic-map-model';
import { routingScenarios } from '../frontend/app/(core)/admin/routing/_lib/routing-scenarios';
import type { RoutingTrafficSnapshot } from '../frontend/app/(core)/admin/routing/_lib/routing-traffic-types';
import type { InstalledRoute } from '../frontend/app/(core)/admin/routing/_lib/installed-routes';

const standby: InstalledRoute = { provider: 'kling_direct', engineId: 'kling-o3-pro', label: 'Kling O3 Pro', mode: 'ref2v', targets: ['fal'], standbyReason: 'out of funds' };

test('the traffic tour visits the different engine families before repeating and honors standby through a simulated refusal', () => {
  const scenarios = routingScenarios();
  const tour = demoTraces(scenarios, [standby], '', 'tour');
  const engineIds = new Set(scenarios.map(row => row.engineId));
  assert.deepEqual(new Set(tour.slice(0, engineIds.size).map(trace => trace.scenario.engineId)), engineIds);
  assert.equal(tour.length, scenarios.length);
  const kling = demoTraces(scenarios, [standby], 'kling-o3-pro', 'fallback')[0];
  assert.ok(kling);
  assert.deepEqual(kling.decision.order, ['fal']);
  const nodes = demoProviderNodes(scenarios, [standby], kling, kling.frames.length - 1);
  assert.equal(nodes.find(node => node.id === 'fal')?.tone, 'failure');
  assert.equal(nodes.find(node => node.id === 'kling_direct')?.standby, true);
  assert.equal(nodes.find(node => node.id === 'kling_direct')?.tone, 'idle');
});

test('observed inspection lists only recorded providers, separates engine filters and identifies stable events across refreshes', () => {
  const at = '2026-11-27T21:30:00Z';
  const snapshot: RoutingTrafficSnapshot = {
    observedAt: at, windowMinutes: 60, sampledJobs: 3, truncated: false,
    routes: [
      { engineId: 'kling-3-pro', provider: 'fal', attempts: 2, jobsOnly: 0, failed: 0, uncertain: 0, fallbacks: 1, latestAt: at },
      { engineId: 'wan-3-prime', provider: 'alibaba_model_studio', attempts: 0, jobsOnly: 1, failed: 0, uncertain: 0, fallbacks: 0, latestAt: at },
    ],
    events: [{ engineId: 'kling-3-pro', provider: 'fal', status: 'accepted', stage: 'fallback', previousProvider: 'kling_direct', at }],
  };
  const observed = observedProviderNodes(snapshot, 'kling-3-pro', snapshot.events[0]);
  assert.deepEqual(observed.map(row => row.id), ['fal']);
  assert.equal(observed[0].tone, 'fallback');
  assert.equal(observed[0].detail, '2 records');
  assert.deepEqual(observedProviderNodes(snapshot, 'seedance-2-5'), []);
  assert.equal(eventKey(snapshot.events[0]), eventKey({ ...snapshot.events[0] }));
  assert.notEqual(eventKey(snapshot.events[0]), eventKey({ ...snapshot.events[0], status: 'failed' }));
});

test('observed playback queues all new matching rows in chronological order across overlapping samples', () => {
  const base = { observedAt: '2026-11-27T20:00:10Z', windowMinutes: 60, sampledJobs: 3, truncated: false, routes: [] };
  const event = (seconds: number, engineId = 'wan') => ({
    engineId, provider: 'fal', stage: 'primary' as const, previousProvider: null, status: 'submitted',
    at: '2026-11-27T20:00:' + String(seconds).padStart(2, '0') + 'Z',
  });
  const old = event(9), a = event(11), b = event(14), other = event(12, 'kling');
  const previous = { ...base, events: [old] };
  const next = { ...base, observedAt: '2026-11-27T20:00:30Z', events: [b, other, a, old] };
  assert.deepEqual(newObservedEvents(null, next, ''), []);
  assert.deepEqual(newObservedEvents(previous, next, 'wan'), [a, b]);
  assert.deepEqual(newObservedEvents(previous, next, ''), [a, other, b]);
  assert.deepEqual(newObservedEvents(next, next, ''), []);
  assert.deepEqual(newObservedEvents(next, previous, ''), []);
  assert.deepEqual(newObservedEvents(next, { ...next, observedAt: '2026-11-27T20:01:00Z' }, ''), []);
  // Indistinguishable projected rows still represent separate records; only the excess is new.
  const duplicate = { ...previous, events: [old, old] };
  assert.deepEqual(newObservedEvents(duplicate, { ...next, events: [b, a, old, old, old] }, ''), [old, a, b]);
  assert.deepEqual(newObservedEvents(duplicate, { ...next, events: [old, old] }, ''), []);
});
