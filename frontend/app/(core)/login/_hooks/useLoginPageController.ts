'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AuthApiError } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { dispatchAnalyticsEvent, persistPendingAnalyticsEvent } from '@/lib/analytics-client';
import { LOGIN_NEXT_STORAGE_KEY } from '@/lib/auth-storage';
import { writeLastKnownUserId } from '@/lib/last-known';
import { supabase } from '@/lib/supabaseClient';
import { canonicalizeBrowserAuthOrigin } from '@/lib/siteOrigin';
import { AUTH_COPY, type AuthMode, type Locale } from '../_lib/login-copy';
import { buildLoginContinuation } from '../_lib/login-continuation';
import {
  buildAuthCallbackRedirect,
  clearPendingGoogleLogin,
  detectLocale,
  getBrowserAuthRedirectOrigin,
  markPendingGoogleLogin,
  sanitizeNextPath,
  shouldTrackGoogleSignupStart,
} from '../_lib/login-helpers';
import { useLoginAutofillSync } from './useLoginAutofillSync';
import { useLoginAuthenticatedRedirect } from './useLoginAuthenticatedRedirect';
import { useLoginAuthHashSession } from './useLoginAuthHashSession';
import { useLoginBrowserLocale } from './useLoginBrowserLocale';
import { useLoginModeFromQuery } from './useLoginModeFromQuery';
import { useLoginNextTarget } from './useLoginNextTarget';
import { useLoginOAuthCodeExchange } from './useLoginOAuthCodeExchange';

const MIN_AGE_ENV = Number.parseInt(process.env.NEXT_PUBLIC_LEGAL_MIN_AGE ?? '15', 10);
const LEGAL_MIN_AGE = Number.isNaN(MIN_AGE_ENV) ? 15 : MIN_AGE_ENV;

export function useLoginPageController() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('en');
  const { authRedirectOrigin, nextPath, nextPathReady, persistNextTarget, safeNextPath } = useLoginNextTarget();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'info' | 'success'>('info');
  const [error, setError] = useState<string | null>(null);
  const { emailRef, passwordRef, syncInputState } = useLoginAutofillSync({ mode, setEmail, setPassword });
  const oauthCodeExchangeStartedRef = useRef(false);
  const authNavigationStartedRef = useRef(false);
  const googleOAuthStartedRef = useRef(false);
  const [isGoogleOAuthStarting, setIsGoogleOAuthStarting] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const browserLocale = useLoginBrowserLocale();
  const [signupSuggestion, setSignupSuggestion] = useState<{ email: string; password: string } | null>(null);
  const authCopy = AUTH_COPY[locale] ?? AUTH_COPY.en;
  const continuation = nextPathReady
    ? buildLoginContinuation({
        copy: authCopy.continuation,
        locale,
        nextPath: safeNextPath,
      })
    : null;

  useLoginModeFromQuery({ setMode });

  const completeAuthenticatedRedirect = useCallback(
    (target: string, authenticatedUserId?: string | null) => {
      if (authNavigationStartedRef.current) return;
      authNavigationStartedRef.current = true;
      const safeTarget = sanitizeNextPath(target);
      const userId = authenticatedUserId ?? null;
      if (userId) {
        writeLastKnownUserId(userId);
      }
      if (typeof window !== 'undefined') {
        persistNextTarget(safeTarget);
        window.sessionStorage.removeItem(LOGIN_NEXT_STORAGE_KEY);
        window.dispatchEvent(new Event('wallet:invalidate'));
        window.location.replace(safeTarget);
        return;
      }
      router.replace(safeTarget);
    },
    [persistNextTarget, router]
  );

  const { redirectFromExistingBrowserSession } = useLoginAuthenticatedRedirect({
    completeAuthenticatedRedirect,
    nextPath,
    nextPathReady,
    oauthCodeExchangeStartedRef,
  });

  useLoginOAuthCodeExchange({
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
  });

  useEffect(() => {
    if (mode !== 'signup' && termsError) {
      setTermsError(false);
    }
  }, [mode, termsError]);

  useLoginAuthHashSession({
    setError,
    setStatus,
    setStatusTone,
  });

  useEffect(() => {
    if (mode !== 'signin' && signupSuggestion) {
      setSignupSuggestion(null);
    }
  }, [mode, signupSuggestion]);

  async function signInWithPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatusTone('info');
    setStatus('Signing in…');
    setError(null);
    setSignupSuggestion(null);
    clearPendingGoogleLogin();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error instanceof AuthApiError && error.status === 400) {
        setSignupSuggestion({ email, password });
        setStatusTone('info');
        setStatus(
          "We couldn't sign you in with those details. If you're new, create your account without retyping anything."
        );
        setError(null);
      } else {
        setError(error.message);
        setStatus(null);
      }
      return;
    }
    setStatusTone('info');
    setStatus('Signed in. Redirecting…');
    persistPendingAnalyticsEvent('login_completed', {
      route_family: 'auth',
      auth_surface: 'login',
      method: 'password',
    });

    const safeTarget = sanitizeNextPath(nextPath);
    completeAuthenticatedRedirect(safeTarget, data.session?.user?.id ?? data.user?.id ?? null);
  }

  const handleAcceptSignupSuggestion = useCallback(() => {
    if (!signupSuggestion) return;
    setMode('signup');
    if (signupSuggestion.password) {
      setConfirm((prev) => (prev ? prev : signupSuggestion.password));
    }
    setStatusTone('info');
    setStatus("Great, let's create your account.");
    setSignupSuggestion(null);
  }, [signupSuggestion, setMode, setConfirm, setStatusTone, setStatus]);

  const handleClearSignupSuggestion = useCallback(() => {
    setSignupSuggestion(null);
  }, []);

  const handleAcceptTermsChange = useCallback((checked: boolean) => {
    setAcceptTerms(checked);
    if (checked) {
      setTermsError(false);
      setError((prev) =>
        prev === 'You must accept the Terms of Service and Privacy Policy to continue.' ? null : prev
      );
    }
  }, []);

  async function submitSignupConsents(userId: string) {
    try {
      const res = await fetch('/api/legal/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          marketingOptIn,
          ageConfirmed: true,
          locale: browserLocale ?? locale,
          source: 'signup',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Failed to record legal consents');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to record legal consents');
    }
  }

  async function signUpWithPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatusTone('info');
    setStatus('Creating account…');
    setError(null);
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      setStatus(null);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      setStatus(null);
      return;
    }
    if (!acceptTerms) {
      setTermsError(true);
      setError('You must accept the Terms of Service and Privacy Policy to continue.');
      setStatus(null);
      return;
    }
    if (!ageConfirmed) {
      setError(`You must confirm you are at least ${LEGAL_MIN_AGE} years old to create an account.`);
      setStatus(null);
      return;
    }
    clearPendingGoogleLogin();
    dispatchAnalyticsEvent('sign_up_started', {
      route_family: 'auth',
      auth_surface: 'login',
      method: 'password',
      marketing_opt_in: marketingOptIn,
    });
    const emailRedirectTo = buildAuthCallbackRedirect(
      getBrowserAuthRedirectOrigin() || authRedirectOrigin,
      safeNextPath
    );
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }

    if (data.user?.id) {
      try {
        await submitSignupConsents(data.user.id);
      } catch (consentError) {
        setError(consentError instanceof Error ? consentError.message : 'Failed to record legal consents.');
        setStatus(null);
        if (data.session) {
          await supabase.auth.signOut().catch(() => undefined);
        }
        return;
      }
    }

    if (data.session) {
      setStatusTone('success');
      setStatus('Account created. Redirecting…');
      persistPendingAnalyticsEvent('sign_up_completed', {
        route_family: 'auth',
        auth_surface: 'login',
        method: 'password',
        email_confirmation_required: false,
      });
      completeAuthenticatedRedirect(safeNextPath, data.session.user?.id ?? data.user?.id ?? null);
    } else {
      setStatusTone('success');
      setStatus('Check your inbox to confirm your email.');
      dispatchAnalyticsEvent('sign_up_completed', {
        route_family: 'auth',
        auth_surface: 'login',
        method: 'password',
        email_confirmation_required: true,
      });
    }
  }

  async function sendReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatusTone('info');
    setStatus('Sending reset link…');
    setError(null);
    const passwordResetRedirectTo = buildAuthCallbackRedirect(
      getBrowserAuthRedirectOrigin() || authRedirectOrigin,
      safeNextPath
    );
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectTo,
    });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    setStatusTone('info');
    setStatus('Password reset email sent.');
  }

  async function signInWithGoogle() {
    if (googleOAuthStartedRef.current) return;
    if (canonicalizeBrowserAuthOrigin()) return;
    googleOAuthStartedRef.current = true;
    setIsGoogleOAuthStarting(true);
    setError(null);
    const safeNext = sanitizeNextPath(nextPath);
    const oauthRedirectTo = buildAuthCallbackRedirect(
      getBrowserAuthRedirectOrigin() || authRedirectOrigin,
      safeNext
    );
    if (!oauthRedirectTo) {
      googleOAuthStartedRef.current = false;
      setIsGoogleOAuthStarting(false);
      setStatusTone('info');
      setStatus('Google sign-in is unavailable because the auth redirect URL could not be resolved.');
      return;
    }
    setStatusTone('info');
    setStatus('Redirecting to Google…');
    if (shouldTrackGoogleSignupStart(mode)) {
      dispatchAnalyticsEvent('sign_up_started', {
        route_family: 'auth',
        auth_surface: 'login',
        method: 'google',
        marketing_opt_in: marketingOptIn,
      });
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      googleOAuthStartedRef.current = false;
      setIsGoogleOAuthStarting(false);
      setError(error.message);
      setStatus(null);
      return;
    }
    if (data?.url) {
      if (typeof window !== 'undefined') {
        persistNextTarget(safeNext);
        markPendingGoogleLogin(mode === 'signup' ? 'signup' : 'signin');
      }
      window.location.href = data.url;
      return;
    }
    googleOAuthStartedRef.current = false;
    setIsGoogleOAuthStarting(false);
  }

  const effectiveMode: Exclude<AuthMode, 'reset'> = mode === 'reset' ? 'signin' : mode;

  const handleBack = useCallback(() => {
    if (typeof window === 'undefined') {
      router.push('/');
      return;
    }
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    const detected = detectLocale();
    setLocale(detected);
  }, []);

  return {
    authCopy,
    mode,
    effectiveMode,
    email,
    password,
    confirm,
    continuation,
    status,
    statusTone,
    error,
    signupSuggestion,
    isGoogleOAuthStarting,
    acceptTerms,
    termsError,
    ageConfirmed,
    marketingOptIn,
    legalMinAge: LEGAL_MIN_AGE,
    emailRef,
    passwordRef,
    onBack: handleBack,
    onModeChange: setMode,
    onGoogleSignIn: signInWithGoogle,
    onSignInSubmit: signInWithPassword,
    onSignUpSubmit: signUpWithPassword,
    onResetSubmit: sendReset,
    onEmailChange: setEmail,
    onPasswordChange: setPassword,
    onConfirmChange: setConfirm,
    onSyncInputState: syncInputState,
    onAcceptTermsChange: handleAcceptTermsChange,
    onAgeConfirmedChange: setAgeConfirmed,
    onMarketingOptInChange: setMarketingOptIn,
    onAcceptSignupSuggestion: handleAcceptSignupSuggestion,
    onClearSignupSuggestion: handleClearSignupSuggestion,
  };
}
