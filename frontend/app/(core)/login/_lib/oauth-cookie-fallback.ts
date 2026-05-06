'use client';

import { hasSupabaseAuthCookie } from '@/lib/supabase-session-hint';

type OAuthCookieRedirectFallbackOptions = {
  isCancelled: () => boolean;
  onAuthenticatedCookie: () => void;
  initialDelayMs?: number;
  intervalMs?: number;
  maxAttempts?: number;
};

export function startOAuthCookieRedirectFallback({
  isCancelled,
  onAuthenticatedCookie,
  initialDelayMs = 500,
  intervalMs = 150,
  maxAttempts = 40,
}: OAuthCookieRedirectFallbackOptions): () => void {
  const hadAuthCookieBeforeExchange = hasSupabaseAuthCookie();
  let timer: number | null = null;
  let stopped = false;

  const cancel = () => {
    stopped = true;
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (attempt = 0) => {
    timer = window.setTimeout(
      () => {
        timer = null;
        if (stopped || isCancelled()) return;
        if (!hadAuthCookieBeforeExchange && hasSupabaseAuthCookie()) {
          onAuthenticatedCookie();
          return;
        }
        if (attempt < maxAttempts) {
          schedule(attempt + 1);
        }
      },
      attempt === 0 ? initialDelayMs : intervalMs
    );
  };

  schedule();
  return cancel;
}
