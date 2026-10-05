import assert from 'node:assert/strict';
import test from 'node:test';
import { persistGoogleAuthCompleted } from '../frontend/app/(core)/login/_lib/login-auth-analytics';
import { readPendingAnalyticsEvent } from '../frontend/lib/analytics-client';
import {
  PENDING_GOOGLE_LOGIN_STORAGE_KEY,
  consumePendingGoogleLogin,
  consumePendingGoogleAuthCompletionEvent,
  markPendingGoogleLogin,
  resolveGoogleAuthCompletionEvent,
  shouldTrackGoogleSignupStart,
} from '../frontend/app/(core)/login/_lib/login-helpers';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function withSessionStorage(run: (storage: Storage) => void) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const sessionStorage = createStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage },
  });
  try {
    run(sessionStorage);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
}

test('Google auth marker preserves signup mode and consumes once', () => {
  withSessionStorage(() => {
    markPendingGoogleLogin('signup', 1_000);
    assert.equal(consumePendingGoogleLogin(2_000), 'signup');
    assert.equal(consumePendingGoogleLogin(2_000), null);
  });
});

test('Google auth marker treats a valid legacy marker as signin', () => {
  withSessionStorage((storage) => {
    storage.setItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY, JSON.stringify({ createdAt: 1_000 }));
    assert.equal(consumePendingGoogleLogin(2_000), 'signin');
  });
});

test('Google auth marker rejects expired or invalid state', () => {
  withSessionStorage((storage) => {
    markPendingGoogleLogin('signup', 1_000);
    assert.equal(consumePendingGoogleLogin(1_000 + 10 * 60 * 1000 + 1), null);
    storage.setItem(
      PENDING_GOOGLE_LOGIN_STORAGE_KEY,
      JSON.stringify({ createdAt: 2_000, mode: 'reset' })
    );
    assert.equal(consumePendingGoogleLogin(3_000), null);
  });
});

test('Google signup intent without account creation evidence is a login completion', () => {
  assert.equal(resolveGoogleAuthCompletionEvent('signup'), 'login_completed');
  assert.equal(resolveGoogleAuthCompletionEvent('signin'), 'login_completed');
});

test('Google account creation is measured from the account timestamp during the current auth intent', () => {
  const resolveCompletion = resolveGoogleAuthCompletionEvent as (...args: unknown[]) => string;
  const current = { intentStartedAt: 1_000, userCreatedAt: new Date(1_500).toISOString(), now: 2_000 };
  assert.equal(resolveCompletion('signup', current), 'sign_up_completed');
  assert.equal(resolveCompletion('signin', current), 'sign_up_completed');
  assert.equal(resolveCompletion('signup', { ...current, userCreatedAt: new Date(500).toISOString() }), 'login_completed');
  assert.equal(resolveCompletion('signup', { ...current, userCreatedAt: 'invalid' }), 'login_completed');
  assert.equal(resolveCompletion('signup', { ...current, userCreatedAt: new Date(3_000).toISOString() }), 'login_completed');
});

test('Google auth completion consumes the stored start time once to prove account creation', () => {
  withSessionStorage(() => {
    markPendingGoogleLogin('signin', 1_000);
    assert.equal(consumePendingGoogleAuthCompletionEvent(new Date(1_500).toISOString(), 2_000), 'sign_up_completed');
    assert.equal(consumePendingGoogleAuthCompletionEvent(new Date(1_500).toISOString(), 2_000), null);
    markPendingGoogleLogin('signup', 1_000);
    assert.equal(consumePendingGoogleAuthCompletionEvent(new Date(500).toISOString(), 2_000), 'login_completed');
  });
});

test('Google signup start follows visible auth mode', () => {
  assert.equal(shouldTrackGoogleSignupStart('signup'), true);
  assert.equal(shouldTrackGoogleSignupStart('signin'), false);
  assert.equal(shouldTrackGoogleSignupStart('reset'), false);
});

test('cookie-only fallback preserves intent for verified destination completion and records it once', () => {
  withSessionStorage((storage) => {
    Object.assign(window, { localStorage: createStorage(), __mvaiCommercialAnalyticsPending: false });
    window.localStorage.setItem('mv-consent-analytics', 'granted');
    const now = Date.now();
    markPendingGoogleLogin('signup', now - 2000);
    persistGoogleAuthCompleted();
    assert.ok(storage.getItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY));
    assert.equal(readPendingAnalyticsEvent(), null);
    persistGoogleAuthCompleted(new Date(now - 1000).toISOString());
    const event = readPendingAnalyticsEvent();
    assert.equal(event?.event, 'sign_up_completed');
    persistGoogleAuthCompleted(new Date(now - 1000).toISOString());
    assert.equal(readPendingAnalyticsEvent()?.createdAt, event?.createdAt);
    assert.equal(storage.getItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY), null);
  });
});
