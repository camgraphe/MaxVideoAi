import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveImageEnumSetting } from '../frontend/src/server/images/image-generation-normalization.ts';

test('image enum settings canonicalize supported strings and flag only non-empty invalid selections', () => {
  assert.deepEqual(resolveImageEnumSetting(['auto', 'transparent'], ' TRANSPARENT '), {
    allowed: ['auto', 'transparent'],
    invalid: false,
    value: 'transparent',
  });
  assert.deepEqual(resolveImageEnumSetting(['auto', 'transparent'], 'unsupported'), {
    allowed: ['auto', 'transparent'],
    invalid: true,
    value: null,
  });
  assert.deepEqual(resolveImageEnumSetting(['auto', 'transparent'], ''), {
    allowed: ['auto', 'transparent'],
    invalid: false,
    value: null,
  });
  assert.deepEqual(resolveImageEnumSetting(['auto', 'transparent'], null), {
    allowed: ['auto', 'transparent'],
    invalid: false,
    value: null,
  });
});
