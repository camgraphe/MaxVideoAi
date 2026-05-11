import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('frontend/components/groups/GroupViewerModal.tsx', 'utf8');

test('group viewer modal does not expose internal provider labels', () => {
  assert.doesNotMatch(source, /label:\s*'Provider'/);
  assert.doesNotMatch(source, /Live \(fal\)/);
});
