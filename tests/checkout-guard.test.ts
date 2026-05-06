import assert from 'node:assert/strict';

import { classifyCheckoutGuardDecision } from '../frontend/server/checkout-guard';

assert.deepEqual(
  classifyCheckoutGuardDecision({
    hasCompletedTopUp: false,
    isPresetTopupTier: true,
    captchaConfigured: true,
    captchaPassed: false,
    userAttempts15m: 3,
    userAttempts1h: 3,
    ipAttempts15m: 1,
  }),
  {
    action: 'captcha_required',
    reason: 'first_topup_user_window',
    retryAfterSeconds: null,
  },
  'first wallet top-up must require CAPTCHA after 3 recent checkout sessions'
);

assert.deepEqual(
  classifyCheckoutGuardDecision({
    hasCompletedTopUp: false,
    isPresetTopupTier: true,
    captchaConfigured: true,
    captchaPassed: true,
    userAttempts15m: 3,
    userAttempts1h: 3,
    ipAttempts15m: 1,
  }),
  {
    action: 'allow',
    reason: 'captcha_passed',
    retryAfterSeconds: null,
  },
  'a valid CAPTCHA token must allow a soft-limited first top-up'
);

assert.deepEqual(
  classifyCheckoutGuardDecision({
    hasCompletedTopUp: true,
    isPresetTopupTier: true,
    captchaConfigured: true,
    captchaPassed: true,
    userAttempts15m: 4,
    userAttempts1h: 4,
    ipAttempts15m: 16,
  }),
  {
    action: 'rate_limited',
    reason: 'ip_window_hard_limit',
    retryAfterSeconds: 900,
  },
  'IP hard limits must block even when CAPTCHA has passed'
);

assert.deepEqual(
  classifyCheckoutGuardDecision({
    hasCompletedTopUp: false,
    isPresetTopupTier: false,
    captchaConfigured: false,
    captchaPassed: false,
    userAttempts15m: 0,
    userAttempts1h: 0,
    ipAttempts15m: 0,
  }),
  {
    action: 'allow',
    reason: 'captcha_unconfigured_bypass',
    retryAfterSeconds: null,
  },
  'custom first top-ups must not be blocked when Turnstile is not configured'
);
