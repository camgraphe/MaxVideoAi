'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { dispatchAnalyticsEvent, persistPendingAnalyticsEvent } from '@/lib/analytics-client';
import { LOGIN_NEXT_STORAGE_KEY } from '@/lib/auth-storage';
import { writeLastKnownUserId } from '@/lib/last-known';
import { loadSupabaseClient } from '@/lib/supabaseClientLoader';
import { canonicalizeBrowserAuthOrigin } from '@/lib/siteOrigin';
import { AUTH_COPY, type AuthMode, type Locale } from '../_lib/login-copy';
import { buildLoginContinuation } from '../_lib/login-continuation';
import {
  buildAuthCallbackRedirect,
  clearPendingGoogleLogin,
  getBrowserAuthRedirectOrigin,
  markPendingGoogleLogin,
  sanitizeNextPath,
  shouldTrackGoogleSignupStart,
} from '../_lib/login-helpers';
import {
  validateAuthForm,
  type AuthFieldErrors,
  type AuthFieldName,
} from '../_lib/login-validation';
import { useLoginAutofillSync } from './useLoginAutofillSync';
import { useLoginAuthenticatedRedirect } from './useLoginAuthenticatedRedirect';
import { useLoginAuthHashSession } from './useLoginAuthHashSession';
import { useLoginBrowserLocale } from './useLoginBrowserLocale';
import { useLoginNextTarget } from './useLoginNextTarget';
import { useLoginOAuthCodeExchange } from './useLoginOAuthCodeExchange';

const MIN_AGE_ENV = Number.parseInt(process.env.NEXT_PUBLIC_LEGAL_MIN_AGE ?? '15', 10);
const LEGAL_MIN_AGE = Number.isNaN(MIN_AGE_ENV) ? 15 : MIN_AGE_ENV;

type UseLoginPageControllerOptions = {
  initialMode: AuthMode;
  initialLocale: Locale;
};

export function useLoginPageController({
  initialMode,
  initialLocale,
}: UseLoginPageControllerOptions) {
  const router = useRouter();
  const [locale] = useState<Locale>(initialLocale);
  const { authRedirectOrigin, nextPath, nextPathReady, persistNextTarget, safeNextPath } = useLoginNextTarget();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'info' | 'success'>('info');
  const [error, setError] = useState<string | null>(null);
  const { emailRef, passwordRef, syncInputState } = useLoginAutofillSync({ mode, setEmail, setPassword });
  const confirmRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formAttention, setFormAttention] = useState(false);
  const oauthCodeExchangeStartedRef = useRef(false);
  const authNavigationStartedRef = useRef(false);
  const googleOAuthStartedRef = useRef(false);
  const [isGoogleOAuthStarting, setIsGoogleOAuthStarting] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const browserLocale = useLoginBrowserLocale();
  const [signupSuggestion, setSignupSuggestion] = useState<{ email: string; password: string } | null>(null);
  const authCopy = AUTH_COPY[locale] ?? AUTH_COPY.en;
  const fieldRefs = useMemo(
    () => ({
      email: emailRef,
      password: passwordRef,
      confirm: confirmRef,
      acceptTerms: termsRef,
      ageConfirmed: ageRef,
    }),
    [emailRef, passwordRef]
  );
  const continuation = nextPathReady
    ? buildLoginContinuation({
        copy: authCopy.continuation,
        locale,
        nextPath: safeNextPath,
      })
    : null;

  const clearFieldError = useCallback((field: AuthFieldName) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormAttention(false);
  }, []);

  const handleModeChange = useCallback((nextMode: AuthMode) => {
    setMode(nextMode);
    setFieldErrors({});
    setFormAttention(false);
    setError(null);
  }, []);

  const validateCurrentForm = useCallback(
    (targetMode: AuthMode) => {
      const result = validateAuthForm({
        mode: targetMode,
        email,
        password,
        confirm,
        acceptTerms,
        ageConfirmed,
      });
      setFieldErrors(result.errors);
      setFormAttention(Boolean(result.firstInvalidField));
      if (result.firstInvalidField) {
        fieldRefs[result.firstInvalidField].current?.focus();
        return false;
      }
      return true;
    },
    [acceptTerms, ageConfirmed, confirm, email, fieldRefs, password]
  );

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

  useLoginAuthHashSession({
    authCopy,
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
    if (!validateCurrentForm('signin')) return;
    setStatusTone('info');
    setStatus(authCopy.feedback.signingIn);
    setError(null);
    setSignupSuggestion(null);
    clearPendingGoogleLogin();
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 400) {
        setSignupSuggestion({ email, password });
        setStatusTone('info');
        setStatus(authCopy.feedback.signinSuggestion);
        setError(null);
      } else {
        setError(error.message);
        setStatus(null);
      }
      return;
    }
    setStatusTone('info');
    setStatus(authCopy.feedback.signinRedirecting);
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
    handleModeChange('signup');
    if (signupSuggestion.password) {
      setConfirm((prev) => (prev ? prev : signupSuggestion.password));
    }
    setStatusTone('info');
    setStatus(authCopy.feedback.signupSuggestionReady);
    setSignupSuggestion(null);
  }, [authCopy.feedback.signupSuggestionReady, handleModeChange, signupSuggestion]);

  const handleClearSignupSuggestion = useCallback(() => {
    setSignupSuggestion(null);
  }, []);

  const handleAcceptTermsChange = useCallback((checked: boolean) => {
    setAcceptTerms(checked);
    clearFieldError('acceptTerms');
  }, [clearFieldError]);

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
        throw new Error(authCopy.feedback.consentSaveError);
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error(authCopy.feedback.consentSaveError);
    }
  }

  async function signUpWithPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateCurrentForm('signup')) return;
    setStatusTone('info');
    setStatus(authCopy.feedback.creatingAccount);
    setError(null);
    clearPendingGoogleLogin();
    dispatchAnalyticsEvent('sign_up_started', {
      route_family: 'auth',
      auth_surface: 'login',
      method: 'password',
      marketing_opt_in: marketingOptIn,
    });
    const supabase = await loadSupabaseClient();
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
        setError(
          consentError instanceof Error
            ? consentError.message
            : authCopy.feedback.consentSaveError
        );
        setStatus(null);
        if (data.session) {
          await supabase.auth.signOut().catch(() => undefined);
        }
        return;
      }
    }

    if (data.session) {
      setStatusTone('success');
      setStatus(authCopy.feedback.accountRedirecting);
      persistPendingAnalyticsEvent('sign_up_completed', {
        route_family: 'auth',
        auth_surface: 'login',
        method: 'password',
        email_confirmation_required: false,
      });
      completeAuthenticatedRedirect(safeNextPath, data.session.user?.id ?? data.user?.id ?? null);
    } else {
      setStatusTone('success');
      setStatus(authCopy.feedback.confirmEmail);
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
    if (!validateCurrentForm('reset')) return;
    setStatusTone('info');
    setStatus(authCopy.feedback.sendingReset);
    setError(null);
    const passwordResetRedirectTo = buildAuthCallbackRedirect(
      getBrowserAuthRedirectOrigin() || authRedirectOrigin,
      safeNextPath
    );
    const supabase = await loadSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectTo,
    });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    setStatusTone('info');
    setStatus(authCopy.feedback.resetSent);
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
      setStatus(authCopy.feedback.googleUnavailable);
      return;
    }
    setStatusTone('info');
    setStatus(authCopy.feedback.googleRedirecting);
    if (shouldTrackGoogleSignupStart(mode)) {
      dispatchAnalyticsEvent('sign_up_started', {
        route_family: 'auth',
        auth_surface: 'login',
        method: 'google',
        marketing_opt_in: marketingOptIn,
      });
    }
    const supabase = await loadSupabaseClient();
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

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    clearFieldError('email');
  }, [clearFieldError]);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    clearFieldError('password');
  }, [clearFieldError]);

  const handleConfirmChange = useCallback((value: string) => {
    setConfirm(value);
    clearFieldError('confirm');
  }, [clearFieldError]);

  const handleAgeConfirmedChange = useCallback((checked: boolean) => {
    setAgeConfirmed(checked);
    clearFieldError('ageConfirmed');
  }, [clearFieldError]);

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
    fieldErrors,
    formAttention,
    signupSuggestion,
    isGoogleOAuthStarting,
    acceptTerms,
    ageConfirmed,
    marketingOptIn,
    legalMinAge: LEGAL_MIN_AGE,
    emailRef,
    passwordRef,
    confirmRef,
    termsRef,
    ageRef,
    onBack: handleBack,
    onModeChange: handleModeChange,
    onGoogleSignIn: signInWithGoogle,
    onSignInSubmit: signInWithPassword,
    onSignUpSubmit: signUpWithPassword,
    onResetSubmit: sendReset,
    onEmailChange: handleEmailChange,
    onPasswordChange: handlePasswordChange,
    onConfirmChange: handleConfirmChange,
    onSyncInputState: syncInputState,
    onAcceptTermsChange: handleAcceptTermsChange,
    onAgeConfirmedChange: handleAgeConfirmedChange,
    onMarketingOptInChange: setMarketingOptIn,
    onAcceptSignupSuggestion: handleAcceptSignupSuggestion,
    onClearSignupSuggestion: handleClearSignupSuggestion,
  };
}
