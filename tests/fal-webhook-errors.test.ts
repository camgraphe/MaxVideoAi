import assert from 'node:assert/strict';
import test from 'node:test';

import { extractFalErrorMessage } from '../frontend/server/fal-webhook-errors.ts';

test('Fal webhook diagnostics prefer a nested provider message over an error type token', () => {
  const message = extractFalErrorMessage({
    status: 'ERROR',
    error: {
      detail: [
        {
          type: 'value_error',
          loc: ['body', 'prompt'],
          msg: 'The provider rejected the rendered input.',
        },
      ],
    },
  });

  assert.equal(message, 'The provider rejected the rendered input.');
});
