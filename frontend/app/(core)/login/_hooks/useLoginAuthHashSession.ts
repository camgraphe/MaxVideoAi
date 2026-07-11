import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { persistPendingAnalyticsEvent } from '@/lib/analytics-client';
import { writeLastKnownUserId } from '@/lib/last-known';
import { supabase } from '@/lib/supabaseClient';
import {
  clearPendingGoogleLogin,
  consumePendingGoogleLogin,
  resolveGoogleAuthCompletionEvent,
} from '../_lib/login-helpers';
import type { AuthCopy } from '../_lib/login-copy';

type UseLoginAuthHashSessionOptions = {
  authCopy: AuthCopy;
  setError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string | null>>;
  setStatusTone: Dispatch<SetStateAction<'info' | 'success'>>;
};

export function useLoginAuthHashSession({
  authCopy,
  setError,
  setStatus,
  setStatusTone,
}: UseLoginAuthHashSessionOptions) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) {
      return;
    }
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken =
      params.get('refresh_token') ?? params.get('refreshToken') ?? params.get('refresh-token');
    if (!accessToken || !refreshToken) {
      clearPendingGoogleLogin();
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      return;
    }
    let cancelled = false;
    setStatusTone('info');
    setStatus(authCopy.feedback.completingSignIn);
    setError(null);
    void supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ data, error }) => {
        if (error) {
          clearPendingGoogleLogin();
          if (cancelled) return;
          setError(error.message ?? authCopy.feedback.completeSignInError);
          setStatus(null);
          return;
        }
        if (!data.session) {
          clearPendingGoogleLogin();
          return;
        }
        if (cancelled) return;
        const userId = data.session.user?.id ?? null;
        if (userId) {
          writeLastKnownUserId(userId);
        }
        const pendingMode = consumePendingGoogleLogin();
        if (pendingMode) {
          const eventName = resolveGoogleAuthCompletionEvent(pendingMode);
          persistPendingAnalyticsEvent(eventName, {
            route_family: 'auth',
            auth_surface: 'login',
            method: 'google',
            ...(eventName === 'sign_up_completed'
              ? { email_confirmation_required: false }
              : {}),
          });
        }
      })
      .catch((err) => {
        clearPendingGoogleLogin();
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : authCopy.feedback.completeSignInError
        );
        setStatus(null);
      })
      .finally(() => {
        if (cancelled) return;
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      });
    return () => {
      cancelled = true;
    };
  }, [authCopy, setError, setStatus, setStatusTone]);
}
