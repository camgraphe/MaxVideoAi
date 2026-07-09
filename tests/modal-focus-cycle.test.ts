import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveModalTabTarget } from '../frontend/components/ui/useAccessibleModal';

test('modal tab cycle wraps forward and backward at the edges', () => {
  assert.equal(
    resolveModalTabTarget({ activeIndex: 2, focusableCount: 3, shiftKey: false, activeInside: true }),
    0
  );
  assert.equal(
    resolveModalTabTarget({ activeIndex: 0, focusableCount: 3, shiftKey: true, activeInside: true }),
    2
  );
});

test('modal tab cycle enters from outside in the requested direction', () => {
  assert.equal(
    resolveModalTabTarget({ activeIndex: -1, focusableCount: 3, shiftKey: false, activeInside: false }),
    0
  );
  assert.equal(
    resolveModalTabTarget({ activeIndex: -1, focusableCount: 3, shiftKey: true, activeInside: false }),
    2
  );
});

test('modal tab cycle stays contained when the active control becomes disabled', () => {
  assert.equal(
    resolveModalTabTarget({ activeIndex: -1, focusableCount: 3, shiftKey: false, activeInside: true }),
    0
  );
  assert.equal(
    resolveModalTabTarget({ activeIndex: -1, focusableCount: 3, shiftKey: true, activeInside: true }),
    2
  );
});

test('modal tab cycle stays native in the middle and targets the dialog when empty', () => {
  assert.equal(
    resolveModalTabTarget({ activeIndex: 1, focusableCount: 3, shiftKey: false, activeInside: true }),
    null
  );
  assert.equal(
    resolveModalTabTarget({ activeIndex: -1, focusableCount: 0, shiftKey: false, activeInside: false }),
    -1
  );
});
