import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateKling3TurboProviderCost } from '../frontend/src/lib/kling-3-turbo';

test('Kling 3 Turbo uses the approved Standard provider-cost ceiling at every supported duration', () => {
  assert.deepEqual(
    [3, 5, 10, 15].map((durationSec) => calculateKling3TurboProviderCost({
      engineId: 'kling-3-turbo-standard',
      durationSec,
    })),
    [
      { rateCentsPerSecond: 11.2, providerCostExactCents: 33.6 },
      { rateCentsPerSecond: 11.2, providerCostExactCents: 56 },
      { rateCentsPerSecond: 11.2, providerCostExactCents: 112 },
      { rateCentsPerSecond: 11.2, providerCostExactCents: 168 },
    ],
  );
});

test('Kling 3 Turbo uses the approved Pro provider-cost ceiling at every supported duration', () => {
  assert.deepEqual(
    [3, 5, 10, 15].map((durationSec) => calculateKling3TurboProviderCost({
      engineId: 'kling-3-turbo-pro',
      durationSec,
    })),
    [
      { rateCentsPerSecond: 14, providerCostExactCents: 42 },
      { rateCentsPerSecond: 14, providerCostExactCents: 70 },
      { rateCentsPerSecond: 14, providerCostExactCents: 140 },
      { rateCentsPerSecond: 14, providerCostExactCents: 210 },
    ],
  );
});
