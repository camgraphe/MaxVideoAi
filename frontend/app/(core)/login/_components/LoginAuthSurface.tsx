'use client';

import type { FormEvent, Ref } from 'react';
import clsx from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AuthCopy, AuthMode } from '../_lib/login-copy';
import { formatTemplate } from '../_lib/login-helpers';
import type { LoginContinuation } from '../_lib/login-continuation';

type SignupSuggestion = { email: string; password: string };

type LoginAuthSurfaceProps = {
  authCopy: AuthCopy;
  mode: AuthMode;
  effectiveMode: Exclude<AuthMode, 'reset'>;
  email: string;
  password: string;
  confirm: string;
  continuation: LoginContinuation | null;
  status: string | null;
  statusTone: 'info' | 'success';
  error: string | null;
  signupSuggestion: SignupSuggestion | null;
  isGoogleOAuthStarting: boolean;
  acceptTerms: boolean;
  termsError: boolean;
  ageConfirmed: boolean;
  marketingOptIn: boolean;
  legalMinAge: number;
  emailRef: Ref<HTMLInputElement>;
  passwordRef: Ref<HTMLInputElement>;
  onBack: () => void;
  onModeChange: (mode: AuthMode) => void;
  onGoogleSignIn: () => void | Promise<void>;
  onSignInSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSignUpSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onResetSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onSyncInputState: () => void;
  onAcceptTermsChange: (checked: boolean) => void;
  onAgeConfirmedChange: (checked: boolean) => void;
  onMarketingOptInChange: (checked: boolean) => void;
  onAcceptSignupSuggestion: () => void;
  onClearSignupSuggestion: () => void;
};

function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.6 10.2301C19.6 9.55008 19.54 8.90008 19.43 8.28008H10V12.0401H15.42C15.18 13.2901 14.5 14.3301 13.46 15.0301V17.5401H16.7C18.64 15.7401 19.6 13.2101 19.6 10.2301Z" fill="#4285F4" />
      <path d="M10 20.0001C12.7 20.0001 14.97 19.1001 16.7 17.5401L13.46 15.0301C12.53 15.6501 11.37 16.0301 10 16.0301C7.39502 16.0301 5.19502 14.2201 4.40502 11.8201H1.06006V14.4101C2.78006 17.6401 6.11006 20.0001 10 20.0001Z" fill="#34A853" />
      <path d="M4.405 11.8201C4.205 11.2001 4.09 10.5401 4.09 9.86008C4.09 9.18008 4.205 8.52008 4.405 7.90008V5.31006H1.06C0.38 6.68006 0 8.24008 0 9.86008C0 11.4801 0.38 13.0401 1.06 14.4101L4.405 11.8201Z" fill="#FBBC05" />
      <path d="M10 3.98005C11.57 3.98005 12.97 4.52005 14.07 5.56005L16.78 2.85005C14.97 1.16005 12.7 0.200043 10 0.200043C6.11006 0.200043 2.78006 2.56005 1.06006 5.79005L4.40506 8.38005C5.19506 5.98005 7.39506 3.98005 10 3.98005Z" fill="#EA4335" />
    </svg>
  );
}

export function LoginAuthSurface({
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
  legalMinAge,
  emailRef,
  passwordRef,
  onBack,
  onModeChange,
  onGoogleSignIn,
  onSignInSubmit,
  onSignUpSubmit,
  onResetSubmit,
  onEmailChange,
  onPasswordChange,
  onConfirmChange,
  onSyncInputState,
  onAcceptTermsChange,
  onAgeConfirmedChange,
  onMarketingOptInChange,
  onAcceptSignupSuggestion,
  onClearSignupSuggestion,
}: LoginAuthSurfaceProps) {
  const renderTermsStatement = () => (
    <span className={clsx(termsError && 'text-state-warning')}>
      {authCopy.terms.prefix}
      <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-brand underline">
        {authCopy.terms.termsLabel}
      </a>
      {authCopy.terms.infix}
      <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-brand underline">
        {authCopy.terms.privacyLabel}
      </a>
      {authCopy.terms.suffix}
    </span>
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-6">
      <div className="mb-6 w-full max-w-md">
        <Button type="button" onClick={onBack} variant="ghost" size="sm" className="gap-2">
          <span aria-hidden>←</span>
          <span>{authCopy.back}</span>
        </Button>
      </div>
      <div className="w-full max-w-md stack-gap-lg rounded-card border border-border bg-surface p-6 shadow-card">
        <header className="stack-gap">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              {mode === 'signup'
                ? authCopy.modes.signup.title
                : mode === 'reset'
                  ? authCopy.modes.reset.title
                  : authCopy.modes.signin.title}
            </h1>
            <p className="text-sm text-text-secondary">
              {mode === 'signup'
                ? authCopy.modes.signup.description
                : mode === 'reset'
                  ? authCopy.modes.reset.description
                  : authCopy.modes.signin.description}
            </p>
          </div>

          {mode !== 'reset' && continuation ? (
            <div className="flex items-start gap-2.5 rounded-input border border-border bg-bg px-3 py-2.5">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-medium text-text-primary">{continuation.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-text-secondary">{continuation.body}</p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2 rounded-pill bg-bg p-1 text-sm font-medium">
            <Button
              type="button"
              variant={effectiveMode === 'signin' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onModeChange('signin')}
              className={clsx(
                'flex-1 rounded-pill px-3 py-2',
                effectiveMode === 'signin' ? 'shadow-card' : 'hover:bg-surface'
              )}
            >
              {authCopy.tabs.signin}
            </Button>
            <Button
              type="button"
              variant={effectiveMode === 'signup' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onModeChange('signup')}
              className={clsx(
                'flex-1 rounded-pill px-3 py-2',
                effectiveMode === 'signup' ? 'shadow-card' : 'hover:bg-surface'
              )}
            >
              {authCopy.tabs.signup}
            </Button>
          </div>
        </header>

        {mode !== 'reset' ? (
          <>
            <Button
              type="button"
              onClick={onGoogleSignIn}
              variant="outline"
              disabled={isGoogleOAuthStarting}
              aria-busy={isGoogleOAuthStarting}
              className="w-full justify-center gap-2 font-medium"
            >
              <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center">
                <GoogleIcon />
              </span>
              Continue with Google
            </Button>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-text-muted">
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span>{authCopy.divider}</span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <form onSubmit={mode === 'signin' ? onSignInSubmit : onSignUpSubmit} className="stack-gap-sm">
              <label className="block text-sm">
                <span className="mb-1 block text-text-secondary">{authCopy.fields.email}</span>
                <Input
                  type="email"
                  required
                  ref={emailRef}
                  name="email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  onFocus={onSyncInputState}
                  className="mt-2"
                  placeholder={authCopy.placeholders.email}
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-text-secondary">{authCopy.fields.password}</span>
                <Input
                  type="password"
                  required
                  ref={passwordRef}
                  name="password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  onFocus={onSyncInputState}
                  className="mt-2"
                  placeholder={mode === 'signup' ? authCopy.placeholders.passwordNew : authCopy.placeholders.password}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </label>
              {mode === 'signup' && (
                <label className="block text-sm">
                  <span className="mb-1 block text-text-secondary">{authCopy.fields.confirmPassword}</span>
                  <Input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => onConfirmChange(e.target.value)}
                    className="mt-2"
                    placeholder={authCopy.placeholders.passwordNew}
                    autoComplete="new-password"
                  />
                </label>
              )}
              {mode === 'signup' && (
                <div className="stack-gap-sm rounded-card bg-bg p-3 text-sm text-text-secondary">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(event) => onAcceptTermsChange(event.target.checked)}
                      className={clsx(
                        'mt-1 h-4 w-4 rounded border-border text-brand focus:ring-ring',
                        termsError && 'border-state-warning text-state-warning focus:ring-state-warning'
                      )}
                      required
                    />
                    <span className={clsx(termsError && 'text-state-warning')}>
                      {renderTermsStatement()}
                    </span>
                  </label>
                  {termsError ? (
                    <p className="pl-6 text-xs text-state-warning">{authCopy.terms.error}</p>
                  ) : null}
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(event) => onAgeConfirmedChange(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-ring"
                      required
                    />
                    <span>{formatTemplate(authCopy.terms.age, { age: String(legalMinAge) })}</span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(event) => onMarketingOptInChange(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-ring"
                    />
                    <span>{authCopy.terms.marketing}</span>
                  </label>
                </div>
              )}

              <Button
                type="submit"
                variant={mode === 'signup' ? 'primary' : 'outline'}
                className="w-full"
              >
                {mode === 'signin' ? authCopy.actions.signin : authCopy.actions.signup}
              </Button>
            </form>

            {mode === 'signin' ? (
              <div className="flex flex-col gap-2 text-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onModeChange('reset')}
                  className="self-start text-brand hover:text-brandHover"
                >
                  {authCopy.forgotPassword}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onModeChange('signup')}
                  className="self-start text-brand hover:text-brandHover"
                >
                  {authCopy.links.newAccount}
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => onModeChange('signin')}>
                {authCopy.links.haveAccount}
              </Button>
            )}
          </>
        ) : (
          <form onSubmit={onResetSubmit} className="stack-gap-sm">
            <label className="block text-sm">
              <span className="mb-1 block text-text-secondary">{authCopy.fields.email}</span>
              <Input
                type="email"
                required
                ref={emailRef}
                name="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                onFocus={onSyncInputState}
                className="mt-2"
                placeholder="you@domain.com"
                autoComplete="email"
              />
            </label>
            <div className="flex justify-between text-xs">
              <Button type="button" variant="ghost" size="sm" onClick={() => onModeChange('signin')}>
                {authCopy.links.backToSignIn}
              </Button>
            </div>
            <Button type="submit" variant="outline" className="w-full">
              {authCopy.actions.reset}
            </Button>
          </form>
        )}

        {status && (
          <div
            className={clsx(
              'rounded-card border px-3 py-3 text-sm font-medium',
              statusTone === 'success'
                ? 'border-brand bg-surface-2 text-brand'
                : 'border-border bg-bg text-text-secondary'
            )}
          >
            {status}
          </div>
        )}
        {mode === 'signin' && signupSuggestion && (
          <div className="rounded-card border border-dashed border-border bg-surface-glass-75 px-3 py-3 text-xs text-text-secondary">
            <p className="text-sm font-semibold text-text-primary">New here?</p>
            <p className="mt-1">
              {formatTemplate(authCopy.signupSuggestion.body, { email: signupSuggestion.email })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={onAcceptSignupSuggestion}>
                {authCopy.signupSuggestion.accept}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearSignupSuggestion}
              >
                {authCopy.signupSuggestion.decline}
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-state-warning">{error}</p>}
      </div>
    </main>
  );
}
