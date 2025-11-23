'use client';

let pendingLogoutIntent = false;
const LOGOUT_INTENT_STORAGE_KEY = 'mv_last_logout_intent';

function persistLogoutIntent(value: boolean) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (value) {
      window.sessionStorage.setItem(LOGOUT_INTENT_STORAGE_KEY, '1');
    } else {
      window.sessionStorage.removeItem(LOGOUT_INTENT_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function readPersistedLogoutIntent(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const value = window.sessionStorage.getItem(LOGOUT_INTENT_STORAGE_KEY);
    if (value === '1') {
      window.sessionStorage.removeItem(LOGOUT_INTENT_STORAGE_KEY);
      return true;
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

export function setLogoutIntent(): void {
  pendingLogoutIntent = true;
  persistLogoutIntent(true);
}

export function consumeLogoutIntent(): boolean {
  if (pendingLogoutIntent) {
    pendingLogoutIntent = false;
    persistLogoutIntent(false);
    return true;
  }
  if (readPersistedLogoutIntent()) {
    return true;
  }
  return false;
}
