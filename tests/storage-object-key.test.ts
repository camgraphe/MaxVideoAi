import assert from 'node:assert/strict';
import test from 'node:test';

import { buildObjectKey } from '../frontend/server/storage.ts';

test('storage object keys preserve slash-separated prefixes', () => {
  assert.equal(
    buildObjectKey({
      prefix: 'renders/images',
      userId: 'user_test',
      leafName: 'output.jpeg',
    }),
    'renders/images/user_test/output.jpeg'
  );
});
