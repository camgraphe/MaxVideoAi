import assert from 'node:assert/strict';
import test from 'node:test';

import { installSupabaseAuthClientGate } from '../frontend/src/lib/supabase-session-hint.ts';

function createGateHarness() {
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  let hasSessionHint = false;
  let documentVisible = true;
  let starts = 0;

  const cleanup = installSupabaseAuthClientGate({
    hasSessionHint: () => hasSessionHint,
    startAuthClient: () => {
      starts += 1;
    },
    windowTarget,
    documentTarget,
    isDocumentVisible: () => documentVisible,
  });

  return {
    cleanup,
    documentTarget,
    getStarts: () => starts,
    setDocumentVisible: (value: boolean) => {
      documentVisible = value;
    },
    setSessionHint: (value: boolean) => {
      hasSessionHint = value;
    },
    windowTarget,
  };
}

test('anonymous public visits do not start the Supabase auth client', () => {
  const harness = createGateHarness();

  harness.windowTarget.dispatchEvent(new Event('focus'));
  harness.windowTarget.dispatchEvent(new Event('pageshow'));
  harness.documentTarget.dispatchEvent(new Event('visibilitychange'));

  assert.equal(harness.getStarts(), 0);
  harness.cleanup();
});

test('a session created in another tab starts the auth client once on focus', () => {
  const harness = createGateHarness();

  harness.setSessionHint(true);
  harness.windowTarget.dispatchEvent(new Event('focus'));
  harness.windowTarget.dispatchEvent(new Event('focus'));
  harness.windowTarget.dispatchEvent(new Event('pageshow'));

  assert.equal(harness.getStarts(), 1);
  harness.cleanup();
});

test('a hidden tab waits until it becomes visible before starting auth', () => {
  const harness = createGateHarness();

  harness.setDocumentVisible(false);
  harness.setSessionHint(true);
  harness.documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(harness.getStarts(), 0);

  harness.setDocumentVisible(true);
  harness.documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(harness.getStarts(), 1);
  harness.cleanup();
});

test('cleanup prevents a later session hint from starting auth', () => {
  const harness = createGateHarness();

  harness.cleanup();
  harness.setSessionHint(true);
  harness.windowTarget.dispatchEvent(new Event('focus'));

  assert.equal(harness.getStarts(), 0);
});
