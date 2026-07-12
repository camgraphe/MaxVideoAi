import assert from 'node:assert/strict';
import test from 'node:test';
import { assertGeneratedJsonCurrent, assertGeneratedTextCurrent } from '../scripts/lib/generated-projection-check.mjs';

test('generated JSON checks detect stale family and publication content, not only missing ids', () => {
  const expected = [{
    engineId: 'model-a',
    family: 'family-a',
    surfaces: { modelPage: { indexable: true, includeInSitemap: true } },
  }];

  for (const stale of [
    [{ ...expected[0], family: 'family-b' }],
    [{ ...expected[0], surfaces: { modelPage: { indexable: false, includeInSitemap: false } } }],
  ]) {
    assert.throws(
      () => assertGeneratedJsonCurrent('engine catalog', expected, `${JSON.stringify(stale, null, 2)}\n`),
      /engine catalog drift/i
    );
  }
});

test('generated text checks compare exact docs projections', () => {
  assert.doesNotThrow(() => assertGeneratedTextCurrent('docs roster csv', 'a,b\n1,2\n', 'a,b\n1,2\n'));
  assert.throws(
    () => assertGeneratedTextCurrent('docs roster csv', 'a,b\n1,2\n', 'a,b\n1,3\n'),
    /docs roster csv drift/i
  );
});
