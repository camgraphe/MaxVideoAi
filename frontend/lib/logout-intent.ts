'use client';

import { LOGOUT_INTENT_COOKIE, LOGOUT_INTENT_COOKIE_MAX_AGE } from '@/lib/logout-intent-cookie';

let pendingLogoutIntent = false;
const LOGOUT_INTENT_STORAGE_KEY = 'mv_last_logout_intent';

function writeLogoutCookie(value: string, maxAge?: number) {
  if (typeof document === 'undefined') {
    return;
  }
  const parts = [`${LOGOUT_INTENT_COOKIE}=${value}`];
  parts.push('path=/');
  parts.push('SameSite=Lax');
  if (typeof maxAge === 'number') {
    parts.push(`max-age=${maxAge}`);
    if (maxAge === 0) {
      parts.push('expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }
  }
  document.cookie = parts.join('; ');
}

function hasLogoutCookie(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.cookie.split(';').some((entry) => {
    const trimmed = entry.trim();
    if (!trimmed.startsWith(`${LOGOUT_INTENT_COOKIE}=`)) return false;
    const [, value] = trimmed.split('=');
    return value === '1';
  });
}

function clearLogoutCookie() {
  writeLogoutCookie('', 0);
}

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
  writeLogoutCookie('1', LOGOUT_INTENT_COOKIE_MAX_AGE);
}

export function consumeLogoutIntent(): boolean {
  let detected = false;
  if (pendingLogoutIntent) {
    detected = true;
  }
  pendingLogoutIntent = false;

  if (!detected && readPersistedLogoutIntent()) {
    detected = true;
  }

  if (!detected && hasLogoutCookie()) {
    detected = true;
  }

  if (detected) {
    persistLogoutIntent(false);
    clearLogoutCookie();
  }

  return detected;
}
