import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeRequestGenerationFailureContext } from '../frontend/lib/analytics/generation-correlation';

test('request failure inherits the prepared start sequence and consumes its local context', () => {
  const contexts = new Map<string, Record<string, unknown>>();
  contexts.set('local-1', {
    generation_sequence: 1,
    is_first_generation: true,
    local_key: 'local-1',
  });

  const correlated = mergeRequestGenerationFailureContext({
    payload: {
      local_key: 'local-1',
      failure_category: 'generation_request_failed',
    },
    generationContextByLocalKey: contexts,
  });

  assert.deepEqual(correlated, {
    generation_sequence: 1,
    is_first_generation: true,
    local_key: 'local-1',
    failure_category: 'generation_request_failed',
  });
  assert.equal(contexts.has('local-1'), false);
});

test('unmatched request failure remains bounded and does not consume other starts', () => {
  const contexts = new Map<string, Record<string, unknown>>([
    ['local-other', { generation_sequence: 2, is_first_generation: false }],
  ]);
  const payload = { local_key: 'local-missing', failure_category: 'generation_request_failed' };

  assert.deepEqual(
    mergeRequestGenerationFailureContext({ payload, generationContextByLocalKey: contexts }),
    payload
  );
  assert.equal(contexts.has('local-other'), true);
});
