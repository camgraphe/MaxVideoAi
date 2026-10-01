import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AUTH_COPY } from '../frontend/app/(core)/login/_lib/login-copy';
import { LoginAuthSurface } from '../frontend/app/(core)/login/_components/LoginAuthSurface';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const noop = () => {};

function renderLogin(locale: keyof typeof AUTH_COPY, staging = false, mode: 'signin' | 'signup' | 'reset' = 'signin') {
  const authCopy = AUTH_COPY[locale];
  return renderToStaticMarkup(React.createElement(LoginAuthSurface, {
    authCopy, mode, effectiveMode: mode === 'signup' ? 'signup' : 'signin',
    continuation: { kind: 'mcp', ...authCopy.continuation.mcp }, isMcpStaging: staging,
    email: '', password: '', confirm: '', status: null, statusTone: 'info', error: null,
    fieldErrors: {}, formAttention: false, signupSuggestion: null, isGoogleOAuthStarting: false,
    acceptTerms: false, ageConfirmed: false, marketingOptIn: false, legalMinAge: 15,
    emailRef: null, passwordRef: null, confirmRef: null, termsRef: null, ageRef: null,
    onBack: noop, onModeChange: noop, onGoogleSignIn: noop, onSignInSubmit: noop,
    onSignUpSubmit: noop, onResetSubmit: noop, onEmailChange: noop, onPasswordChange: noop,
    onConfirmChange: noop, onSyncInputState: noop, onAcceptTermsChange: noop,
    onAgeConfirmedChange: noop, onMarketingOptInChange: noop, onAcceptSignupSuggestion: noop,
    onClearSignupSuggestion: noop,
  }));
}

test('MCP sign-in shows account connection from the first render without a duplicate continuation card', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = AUTH_COPY[locale];
    const html = renderLogin(locale);
    assert.equal(html.split(copy.continuation.mcp.title).length - 1, 1);
    assert.ok(!html.includes(copy.modes.signin.title));
    assert.match(html, /autoComplete="current-password"/i);
    assert.ok(!html.includes(copy.mcpStaging.title));
  }
});

test('staging consent explains separate accounts and links to setup without replaying the authorization request', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const html = renderLogin(locale, true);
    assert.match(html, /role="alert"/);
    assert.ok(html.includes(AUTH_COPY[locale].mcpStaging.title));
    assert.match(html, /href="https:\/\/maxvideoai\.com\/mcp"/);
    assert.doesNotMatch(html, /href="https:\/\/maxvideoai\.com\/oauth\/consent/);
  }
});

test('explicit signup and password reset retain their own headings during MCP setup', () => {
  for (const mode of ['signup', 'reset'] as const) {
    assert.ok(renderLogin('en', false, mode).includes(AUTH_COPY.en.modes[mode].title));
  }
});
