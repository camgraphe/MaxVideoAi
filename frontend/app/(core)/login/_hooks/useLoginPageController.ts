'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { dispatchAnalyticsEvent, persistPendingAnalyticsEvent } from '@/lib/analytics-client';
import { resolveBrowserCommercialAnalyticsAuthContext } from '@/lib/analytics/commercial-client';
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
import { submitPasswordSignupConsents } from '../_lib/login-signup-consents';
import { requestPasswordReset } from '../_lib/login-password-reset';
import { usePasswordAuthSubmission } from './usePasswordAuthSubmission';
import { useLoginAutofillSync } from './useLoginAutofillSync';
import { useLoginAuthenticatedRedirect } from './useLoginAuthenticatedRedirect';
import { useLoginAuthHashSession } from './useLoginAuthHashSession';
import { useLoginNextTarget } from './useLoginNextTarget';
import { useLoginOAuthCodeExchange } from './useLoginOAuthCodeExchange';

const MIN_AGE_ENV = Number.parseInt(process.env.NEXT_PUBLIC_LEGAL_MIN_AGE ?? '15', 10);
const LEGAL_MIN_AGE = Number.isNaN(MIN_AGE_ENV) ? 15 : MIN_AGE_ENV;

type UseLoginPageControllerOptions = {
  initialMode: AuthMode;
  initialLocale: Locale;
  initialMcpConnection: boolean;
};

export function useLoginPageController({
  initialMode,
  initialLocale,
  initialMcpConnection,
}: UseLoginPageControllerOptions) {
  const router = useRouter();
  const [locale] = useState<Locale>(initialLocale);
  const { authRedirectOrigin, nextPath, nextPathReady, persistNextTarget, safeNextPath } = useLoginNextTarget();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const passwordSubmission = usePasswordAuthSubmission(mode);
  const invalidatePasswordSubmission = passwordSubmission.invalidate;
  const passwordSubmissionPending = passwordSubmission.pending;
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
  const passwordResetPendingRef = useRef(false);
  const [isResetSending, setIsResetSending] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [signupSuggestion, setSignupSuggestion] = useState<{ email: string; password: string } | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const confirmationResendPendingRef = useRef(false);
  const [isConfirmationResending, setIsConfirmationResending] = useState(false);
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
    : initialMcpConnection ? { kind: 'mcp' as const, ...authCopy.continuation.mcp } : null;

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
    if (passwordSubmissionPending.current || confirmationResendPendingRef.current || nextMode === mode) return;
    invalidatePasswordSubmission();
    setStatus(null);
    setMode(nextMode);
    setFieldErrors({});
    setFormAttention(false);
    setError(null);
    setUnconfirmedEmail(null);
  }, [invalidatePasswordSubmission, mode, passwordSubmissionPending]);

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
    if (passwordSubmission.pending.current || confirmationResendPendingRef.current || !validateCurrentForm('signin')) return;
    await passwordSubmission.run(async (isCurrent) => {
      setStatusTone('info');
      setStatus(authCopy.feedback.signingIn);
      setError(null);
      setSignupSuggestion(null);
      setUnconfirmedEmail(null);
      clearPendingGoogleLogin();
      const supabase = await loadSupabaseClient();
      if (!isCurrent()) return;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!isCurrent()) return;
      if (error) {
        if (error.code === 'email_not_confirmed') {
          setUnconfirmedEmail(email);
          setError(authCopy.feedback.emailNotConfirmed);
          setStatus(null);
        } else if (continuation?.kind === 'mcp') {
          setError(error.code === 'invalid_credentials' ? authCopy.feedback.mcpSigninFailed : error.message);
          setStatus(null);
        } else if (error.code === 'invalid_credentials') {
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
      if (data.user) void resolveBrowserCommercialAnalyticsAuthContext(data.user.id, data.session?.access_token, data.user.app_metadata);
      persistPendingAnalyticsEvent('login_completed', {
        route_family: 'auth',
        auth_surface: 'login',
        method: 'password',
      });

      const safeTarget = sanitizeNextPath(nextPath);
      completeAuthenticatedRedirect(safeTarget, data.session?.user?.id ?? data.user?.id ?? null);
    }, () => {
      setError(authCopy.feedback.passwordUnavailable);
      setStatus(null);
    });
  }

  async function resendConfirmation() {
    if (!unconfirmedEmail || confirmationResendPendingRef.current || passwordSubmission.pending.current) return;
    confirmationResendPendingRef.current = true;
    setIsConfirmationResending(true);
    setError(null);
    setStatusTone('info');
    setStatus(authCopy.feedback.sendingConfirmation);
    try {
      const emailRedirectTo = buildAuthCallbackRedirect(
        getBrowserAuthRedirectOrigin() || authRedirectOrigin,
        safeNextPath,
        locale,
        'signup'
      );
      if (!emailRedirectTo) throw new Error('Missing confirmation redirect origin');
      const supabase = await loadSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: unconfirmedEmail,
        options: { emailRedirectTo },
      });
      if (error) {
        setStatus(null);
        setError(error.status === 429 || error.code === 'over_email_send_rate_limit'
          ? authCopy.feedback.confirmationRateLimited
          : authCopy.feedback.confirmationUnavailable);
      } else {
        setStatus(authCopy.feedback.confirmationResent);
        setUnconfirmedEmail(null);
      }
    } catch {
      setStatus(null);
      setError(authCopy.feedback.confirmationUnavailable);
    } finally {
      confirmationResendPendingRef.current = false;
      setIsConfirmationResending(false);
    }
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
          locale,
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
    if (passwordSubmission.pending.current || !validateCurrentForm('signup')) return;
    await passwordSubmission.run(async (isCurrent) => {
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
      if (!isCurrent()) return;
      const emailRedirectTo = buildAuthCallbackRedirect(
        getBrowserAuthRedirectOrigin() || authRedirectOrigin,
        safeNextPath,
        locale,
        'signup'
      );
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo, data: { locale } },
      });
      if (error) {
        if (!isCurrent()) return;
        setError(error.message);
        setStatus(null);
        return;
      }

      // The SDK may already have created the account after navigation. Persist
      // the consent captured by this submission before ignoring its stale UI.
      try {
        const consentsSaved = await submitPasswordSignupConsents(data, submitSignupConsents);
        if (!isCurrent()) return;
        if (!consentsSaved) {
          setStatusTone('info');
          setStatus(authCopy.feedback.confirmEmail);
          return;
        }
      } catch (consentError) {
        if (!isCurrent()) return;
        setError(
          consentError instanceof Error
            ? consentError.message
            : authCopy.feedback.consentSaveError
        );
        setStatus(null);
        if (data.session) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        }
        return;
      }

      if (data.user) void resolveBrowserCommercialAnalyticsAuthContext(data.user.id, data.session?.access_token, data.user.app_metadata);
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
        setStatus(authCopy.feedback.confirmEmailAfterSignup);
        dispatchAnalyticsEvent('sign_up_completed', {
          route_family: 'auth',
          auth_surface: 'login',
          method: 'password',
          email_confirmation_required: true,
        });
      }
    }, () => {
      setError(authCopy.feedback.passwordUnavailable);
      setStatus(null);
    });
  }

  async function sendReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (passwordSubmission.pending.current || passwordResetPendingRef.current || !validateCurrentForm('reset')) return;
    passwordResetPendingRef.current = true;
    setIsResetSending(true);
    setStatusTone('info');
    setStatus(authCopy.feedback.sendingReset);
    setError(null);
    const passwordResetRedirectTo = buildAuthCallbackRedirect(
      getBrowserAuthRedirectOrigin() || authRedirectOrigin,
      safeNextPath,
      locale,
      'recovery'
    );
    const result = await requestPasswordReset(async () => {
      if (!passwordResetRedirectTo) throw new Error('Missing recovery redirect origin');
      const supabase = await loadSupabaseClient();
      return supabase.auth.resetPasswordForEmail(email, { redirectTo: passwordResetRedirectTo });
    });
    passwordResetPendingRef.current = false;
    setIsResetSending(false);
    if (result !== 'sent') {
      setError(result === 'rateLimited' ? authCopy.feedback.resetRateLimited : authCopy.feedback.resetUnavailable);
      setStatus(null);
      return;
    }
    setStatusTone('info');
    setStatus(authCopy.feedback.resetSent);
  }

  async function signInWithGoogle() {
    if (passwordSubmission.pending.current || confirmationResendPendingRef.current || googleOAuthStartedRef.current) return;
    if (canonicalizeBrowserAuthOrigin()) return;
    googleOAuthStartedRef.current = true;
    setIsGoogleOAuthStarting(true);
    setError(null);
    const safeNext = sanitizeNextPath(nextPath);
    const oauthRedirectTo = buildAuthCallbackRedirect(
      getBrowserAuthRedirectOrigin() || authRedirectOrigin,
      safeNext,
      locale
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
    setUnconfirmedEmail(null);
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
    unconfirmedEmail,
    isConfirmationResending,
    isGoogleOAuthStarting,
    isResetSending,
    isPasswordSubmitting: passwordSubmission.busy,
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
    onResendConfirmation: resendConfirmation,
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
