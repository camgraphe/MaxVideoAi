import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeJobMessage } from '../frontend/lib/job-status';

test('normalizeJobMessage rewrites prompt refusals for users', () => {
  assert.equal(
    normalizeJobMessage(
      "The prompt could not be submitted. This prompt contains sensitive words that violate Google's Responsible AI practices. Try rephrasing your prompt, or contact your Google representative to request allowlisting. Support codes: 58061214"
    ),
    'This request was blocked by safety checks. Try rephrasing it with safer, more neutral wording.'
  );
});
