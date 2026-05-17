import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeJobMessage } from '../frontend/lib/job-status';

test('normalizeJobMessage rewrites provider prompt refusals for users', () => {
  assert.equal(
    normalizeJobMessage(
      "The prompt could not be submitted. This prompt contains sensitive words that violate Google's Responsible AI practices. Try rephrasing your prompt, or contact your Google representative to request allowlisting. Support codes: 58061214"
    ),
    'The provider refused this prompt for safety reasons. Try rephrasing it with safer, more neutral wording.'
  );
});
