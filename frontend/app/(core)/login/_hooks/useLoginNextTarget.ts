'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LOGIN_LAST_TARGET_KEY, LOGIN_NEXT_STORAGE_KEY, LOGIN_SKIP_ONBOARDING_KEY } from '@/lib/auth-storage';
import { canonicalizeBrowserAuthOrigin } from '@/lib/siteOrigin';
import {
  DEFAULT_NEXT_PATH,
  getBrowserAuthRedirectOrigin,
  sanitizeNextPath,
} from '../_lib/login-helpers';

type LoginNextTargetSource = 'query' | 'stored' | 'last' | 'referrer' | 'default';

function shouldSkipOnboarding(target: string) {
  return (
    target.startsWith('/generate') ||
    target.startsWith('/app') ||
    target.includes('from=') ||
    target.includes('engine=')
  );
}

export function useLoginNextTarget() {
  const [nextPath, setNextPath] = useState<string>(DEFAULT_NEXT_PATH);
  const [nextPathReady, setNextPathReady] = useState(false);
  const [authRedirectOrigin, setAuthRedirectOrigin] = useState('');

  const persistNextTarget = useCallback((value: string) => {
    if (typeof window === 'undefined') return;
    const safe = sanitizeNextPath(value);
    const prevSession = window.sessionStorage.getItem(LOGIN_LAST_TARGET_KEY);
    if (prevSession === safe) {
      window.localStorage.setItem(LOGIN_LAST_TARGET_KEY, safe);
      window.localStorage.setItem(LOGIN_NEXT_STORAGE_KEY, safe);
      if (shouldSkipOnboarding(safe)) {
        window.localStorage.setItem(LOGIN_SKIP_ONBOARDING_KEY, 'true');
      } else if (!safe.startsWith('/gallery')) {
        window.localStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);
      }
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[login] persistNextTarget', { safe });
    }
    window.sessionStorage.setItem(LOGIN_NEXT_STORAGE_KEY, safe);
    window.sessionStorage.setItem(LOGIN_LAST_TARGET_KEY, safe);
    window.localStorage.setItem(LOGIN_NEXT_STORAGE_KEY, safe);
    window.localStorage.setItem(LOGIN_LAST_TARGET_KEY, safe);
    if (shouldSkipOnboarding(safe)) {
      window.sessionStorage.setItem(LOGIN_SKIP_ONBOARDING_KEY, 'true');
      window.localStorage.setItem(LOGIN_SKIP_ONBOARDING_KEY, 'true');
    } else if (!safe.startsWith('/gallery')) {
      window.sessionStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);
      window.localStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);
    }
  }, []);

  useEffect(() => {
    if (canonicalizeBrowserAuthOrigin()) return;
    if (typeof window === 'undefined') return;
    setAuthRedirectOrigin(getBrowserAuthRedirectOrigin());
    const params = new URLSearchParams(window.location.search);
    const value = params.get('next');
    let resolved = DEFAULT_NEXT_PATH;
    let source: LoginNextTargetSource = 'default';
    if (value && value.startsWith('/')) {
      resolved = sanitizeNextPath(value);
      source = 'query';
    } else {
      let stored = window.sessionStorage.getItem(LOGIN_NEXT_STORAGE_KEY);
      if (!stored) {
        stored = window.localStorage.getItem(LOGIN_NEXT_STORAGE_KEY) ?? null;
        if (stored) {
          window.localStorage.removeItem(LOGIN_NEXT_STORAGE_KEY);
          window.sessionStorage.setItem(LOGIN_NEXT_STORAGE_KEY, stored);
        }
      }
      let lastTarget = window.sessionStorage.getItem(LOGIN_LAST_TARGET_KEY);
      if (!lastTarget) {
        lastTarget = window.localStorage.getItem(LOGIN_LAST_TARGET_KEY) ?? null;
        if (lastTarget) {
          window.localStorage.removeItem(LOGIN_LAST_TARGET_KEY);
          window.sessionStorage.setItem(LOGIN_LAST_TARGET_KEY, lastTarget);
        }
      }
      if (stored) {
        resolved = sanitizeNextPath(stored);
        source = 'stored';
      } else if (lastTarget) {
        resolved = sanitizeNextPath(lastTarget);
        source = 'last';
      }
    }

    if (resolved === DEFAULT_NEXT_PATH) {
      const referrer = document.referrer;
      const origin = window.location.origin;
      if (referrer && origin && referrer.startsWith(origin)) {
        const pathname = referrer.slice(origin.length) || '/';
        if (pathname.startsWith('/')) {
          const sanitised = sanitizeNextPath(pathname);
          if (sanitised && sanitised !== DEFAULT_NEXT_PATH) {
            resolved = sanitised;
            source = 'referrer';
          }
        }
      }
    }
    setNextPath(resolved);
    persistNextTarget(resolved);
    setNextPathReady(true);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[login] resolved next path', { value, resolved, source });
    }
  }, [persistNextTarget]);

  const safeNextPath = useMemo(() => sanitizeNextPath(nextPath), [nextPath]);

  return {
    authRedirectOrigin,
    nextPath,
    nextPathReady,
    persistNextTarget,
    safeNextPath,
  };
}
