import assert from 'node:assert/strict';
import test from 'node:test';

import { createJobsRouteTiming } from '../frontend/app/api/jobs/_lib/jobs-route-timing.ts';

test('jobs route timing exposes only bounded phase durations', async () => {
  const ticks = [100, 110, 127.65, 130, 150.05, 150.05];
  const timing = createJobsRouteTiming({
    enabled: true,
    now: () => ticks.shift() ?? 150.05,
  });

  const value = await timing.measure('schema', async () => 'ready');
  await timing.measure('auth', async () => undefined);

  assert.equal(value, 'ready');
  assert.equal(timing.headerValue(), 'schema;dur=17.7, auth;dur=20.1, total;dur=50.1');
  assert.doesNotMatch(timing.headerValue() ?? '', /user|job|url|prompt/i);
});

test('disabled jobs route timing does not sample the clock or emit a header', async () => {
  let samples = 0;
  const timing = createJobsRouteTiming({
    enabled: false,
    now: () => {
      samples += 1;
      return 1;
    },
  });

  await timing.measure('list', async () => undefined);

  assert.equal(samples, 0);
  assert.equal(timing.headerValue(), null);
});
