import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { persistPendingAnalyticsEvent } from '@/lib/analytics-client';
import {
  clearStaleBrowserAuthState,
  isInvalidRefreshTokenError,
  isPkceCodeVerifierError,
} from '@/lib/supabase-auth-cleanup';
import { loadSupabaseClient } from '@/lib/supabaseClientLoader';
import { startOAuthCookieRedirectFallback } from '../_lib/oauth-cookie-fallback';
import { AUTH_COPY, type AuthCopy, type AuthMode } from '../_lib/login-copy';
import {
  clearPendingGoogleLogin,
  consumePendingGoogleLogin,
  detectLocale,
  resolveGoogleAuthCompletionEvent,
  sanitizeNextPath,
} from '../_lib/login-helpers';

type UseLoginOAuthCodeExchangeOptions = {
  authCopy: AuthCopy;
  authNavigationStartedRef: MutableRefObject<boolean>;
  completeAuthenticatedRedirect: (target: string, authenticatedUserId?: string | null) => void;
  nextPath: string;
  nextPathReady: boolean;
  oauthCodeExchangeStartedRef: MutableRefObject<boolean>;
  redirectFromExistingBrowserSession: (target: string) => Promise<boolean>;
  setError: Dispatch<SetStateAction<string | null>>;
  setMode: Dispatch<SetStateAction<AuthMode>>;
  setStatus: Dispatch<SetStateAction<string | null>>;
  setStatusTone: Dispatch<SetStateAction<'info' | 'success'>>;
};

function persistGoogleAuthCompleted() {
  const pendingMode = consumePendingGoogleLogin();
  if (!pendingMode) return;
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

export function useLoginOAuthCodeExchange({
  authCopy,
  authNavigationStartedRef,
  completeAuthenticatedRedirect,
  nextPath,
  nextPathReady,
  oauthCodeExchangeStartedRef,
  redirectFromExistingBrowserSession,
  setError,
  setMode,
  setStatus,
  setStatusTone,
}: UseLoginOAuthCodeExchangeOptions) {
  useEffect(() => {
    if (!nextPathReady) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const oauthCode = params.get('code');
    const authError = params.get('authError');
    if (!oauthCode && authError !== 'oauth_callback_failed') return;

    const cleanAuthQuery = () => {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('code');
      cleanUrl.searchParams.delete('state');
      cleanUrl.searchParams.delete('authError');
      cleanUrl.searchParams.delete('error');
      cleanUrl.searchParams.delete('error_description');
      cleanUrl.searchParams.delete('redirect_to');
      window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    };

    const localizedCopy = AUTH_COPY[detectLocale()] ?? authCopy;
    setMode('signin');

    if (authError === 'oauth_callback_failed') {
      cleanAuthQuery();
      clearPendingGoogleLogin();
      setStatus(null);
      setError(localizedCopy.oauthCallbackError);
      return;
    }

    if (!oauthCode || oauthCodeExchangeStartedRef.current) return;
    oauthCodeExchangeStartedRef.current = true;
    cleanAuthQuery();
    setStatusTone('info');
    setStatus('Completing sign-in…');
    setError(null);

    let cancelled = false;
    const target = sanitizeNextPath(params.get('next') ?? nextPath);
    const cancelAuthCookieFallback = startOAuthCookieRedirectFallback({
      isCancelled: () => cancelled || authNavigationStartedRef.current,
      onAuthenticatedCookie: () => {
        persistGoogleAuthCompleted();
        completeAuthenticatedRedirect(target);
      },
    });
    void loadSupabaseClient()
      .then((supabase) => supabase.auth.exchangeCodeForSession(oauthCode))
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error || !data.session) {
          if (isInvalidRefreshTokenError(error) || isPkceCodeVerifierError(error)) {
            void clearStaleBrowserAuthState();
          }
          const fallbackRedirected = await redirectFromExistingBrowserSession(target);
          if (cancelled || fallbackRedirected) return;
          oauthCodeExchangeStartedRef.current = false;
          clearPendingGoogleLogin();
          setStatus(null);
          setError(localizedCopy.oauthCallbackError);
          return;
        }
        persistGoogleAuthCompleted();
        completeAuthenticatedRedirect(target, data.session.user?.id ?? null);
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (isInvalidRefreshTokenError(err) || isPkceCodeVerifierError(err)) {
          void clearStaleBrowserAuthState();
        }
        const fallbackRedirected = await redirectFromExistingBrowserSession(target);
        if (cancelled || fallbackRedirected) return;
        oauthCodeExchangeStartedRef.current = false;
        clearPendingGoogleLogin();
        setStatus(null);
        setError(localizedCopy.oauthCallbackError);
      });

    return () => {
      cancelled = true;
      cancelAuthCookieFallback();
    };
  }, [
    authCopy,
    authNavigationStartedRef,
    completeAuthenticatedRedirect,
    nextPath,
    nextPathReady,
    oauthCodeExchangeStartedRef,
    redirectFromExistingBrowserSession,
    setError,
    setMode,
    setStatus,
    setStatusTone,
  ]);
}
