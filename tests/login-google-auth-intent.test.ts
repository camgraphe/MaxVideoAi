import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PENDING_GOOGLE_LOGIN_STORAGE_KEY,
  consumePendingGoogleLogin,
  markPendingGoogleLogin,
  resolveGoogleAuthCompletionEvent,
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

test('Google auth completion event follows the pending mode', () => {
  assert.equal(resolveGoogleAuthCompletionEvent('signup'), 'sign_up_completed');
  assert.equal(resolveGoogleAuthCompletionEvent('signin'), 'login_completed');
});
