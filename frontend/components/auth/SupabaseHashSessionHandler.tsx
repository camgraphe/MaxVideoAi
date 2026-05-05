'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LOGIN_NEXT_STORAGE_KEY } from '@/lib/auth-storage';
import { writeLastKnownUserId } from '@/lib/last-known';

function readSupabaseHashSession() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token=')) return null;

  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken =
    params.get('refresh_token') ?? params.get('refreshToken') ?? params.get('refresh-token');

  if (!accessToken || !refreshToken) {
    return { accessToken: null, refreshToken: null };
  }

  return { accessToken, refreshToken };
}

function stripAuthHash() {
  if (typeof window === 'undefined') return;
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
}

function readStoredNextPath() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(LOGIN_NEXT_STORAGE_KEY) ?? window.localStorage.getItem(LOGIN_NEXT_STORAGE_KEY);
    return stored && stored.startsWith('/') && !stored.startsWith('/login') ? stored : null;
  } catch {
    return null;
  }
}

export function SupabaseHashSessionHandler() {
  const router = useRouter();

  useEffect(() => {
    const hashSession = readSupabaseHashSession();
    if (!hashSession) return;

    if (!hashSession.accessToken || !hashSession.refreshToken) {
      stripAuthHash();
      return;
    }

    let cancelled = false;
    const nextPath = readStoredNextPath();

    void import('@/lib/supabaseClient')
      .then(({ supabase }) =>
        supabase.auth.setSession({
          access_token: hashSession.accessToken!,
          refresh_token: hashSession.refreshToken!,
        })
      )
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const userId = data.session?.user?.id ?? null;
        if (userId) {
          writeLastKnownUserId(userId);
          window.dispatchEvent(new Event('wallet:invalidate'));
        }
        router.refresh();
        if (nextPath && window.location.pathname === '/') {
          router.replace(nextPath);
        }
      })
      .finally(() => {
        if (!cancelled) {
          stripAuthHash();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
