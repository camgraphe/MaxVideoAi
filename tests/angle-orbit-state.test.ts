import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANGLE_ORBIT_VIEW_IDS,
  advanceOrbitView,
  resolveAvailableOrbitView,
  selectOrbitViewFromDrag,
} from '../frontend/src/components/tools/angle/landing/angle-orbit-state';

test('Orbit exposes four genuine discrete views', () => {
  assert.deepEqual(ANGLE_ORBIT_VIEW_IDS, ['front', 'threeQuarter', 'profile', 'elevated']);
});

test('Orbit keyboard navigation wraps in both directions', () => {
  assert.equal(advanceOrbitView('elevated', 'next'), 'front');
  assert.equal(advanceOrbitView('front', 'previous'), 'elevated');
});

test('Orbit drag changes one stop per 64 pixels', () => {
  assert.equal(selectOrbitViewFromDrag('threeQuarter', 70), 'profile');
  assert.equal(selectOrbitViewFromDrag('threeQuarter', -70), 'front');
  assert.equal(selectOrbitViewFromDrag('threeQuarter', 20), 'threeQuarter');
});

test('Orbit falls back to the nearest successful view after an image error', () => {
  assert.equal(resolveAvailableOrbitView('profile', new Set(['profile'])), 'threeQuarter');
  assert.equal(resolveAvailableOrbitView('front', new Set(['front', 'threeQuarter'])), 'elevated');
});
