import { createHmac } from 'crypto';
import { query } from '@/lib/db';

const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CHECKOUT_GUARD_HASH_FALLBACK = 'maxvideoai-checkout-guard-local-fallback';
const FIRST_TOPUP_USER_WINDOW_LIMIT = 3;
const FIRST_TOPUP_USER_HARD_LIMIT = 6;
const IP_WINDOW_LIMIT = 8;
const IP_HARD_LIMIT = 16;
const RETURNING_USER_CAPTCHA_LIMIT = 8;
const RETURNING_USER_HARD_LIMIT = 12;
const FIFTEEN_MINUTES_SECONDS = 15 * 60;
const ONE_HOUR_SECONDS = 60 * 60;

export type CheckoutGuardMode = 'hosted' | 'express_checkout';
export type CheckoutGuardAction = 'allow' | 'captcha_required' | 'rate_limited';

export type CheckoutGuardDecision = {
  action: CheckoutGuardAction;
  reason: string;
  retryAfterSeconds: number | null;
};

type CheckoutGuardCounts = {
  userAttempts15m: number;
  userAttempts1h: number;
  ipAttempts15m: number;
};

type EvaluateWalletCheckoutGuardParams = {
  userId: string;
  clientIp: string | null;
  amountCents: number;
  mode: CheckoutGuardMode;
  hasCompletedTopUp: boolean;
  isPresetTopupTier: boolean;
  captchaToken?: string | null;
  metadata?: Record<string, unknown>;
};

export type WalletCheckoutGuardResult = CheckoutGuardDecision & {
  attemptId: number;
  captchaConfigured: boolean;
  captchaPassed: boolean;
};

type CheckoutAttemptRow = {
  id: number | string;
};

type CheckoutAttemptCountRow = {
  user_attempts_15m: number | string | null;
  user_attempts_1h: number | string | null;
  ip_attempts_15m: number | string | null;
};

type TurnstileSiteverifyResponse = {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
};

export function classifyCheckoutGuardDecision({
  hasCompletedTopUp,
  isPresetTopupTier,
  captchaConfigured,
  captchaPassed,
  userAttempts15m,
  userAttempts1h,
  ipAttempts15m,
}: {
  hasCompletedTopUp: boolean;
  isPresetTopupTier: boolean;
  captchaConfigured: boolean;
  captchaPassed: boolean;
  userAttempts15m: number;
  userAttempts1h: number;
  ipAttempts15m: number;
}): CheckoutGuardDecision {
  if (ipAttempts15m >= IP_HARD_LIMIT) {
    return { action: 'rate_limited', reason: 'ip_window_hard_limit', retryAfterSeconds: FIFTEEN_MINUTES_SECONDS };
  }

  if (!hasCompletedTopUp && userAttempts15m >= FIRST_TOPUP_USER_HARD_LIMIT) {
    return { action: 'rate_limited', reason: 'first_topup_user_hard_limit', retryAfterSeconds: FIFTEEN_MINUTES_SECONDS };
  }

  if (hasCompletedTopUp && userAttempts1h >= RETURNING_USER_HARD_LIMIT) {
    return { action: 'rate_limited', reason: 'returning_user_hard_limit', retryAfterSeconds: ONE_HOUR_SECONDS };
  }

  const softReason =
    !hasCompletedTopUp && !isPresetTopupTier
      ? 'first_topup_custom_amount'
      : !hasCompletedTopUp && userAttempts15m >= FIRST_TOPUP_USER_WINDOW_LIMIT
        ? 'first_topup_user_window'
        : ipAttempts15m >= IP_WINDOW_LIMIT
          ? 'ip_window'
          : hasCompletedTopUp && userAttempts1h >= RETURNING_USER_CAPTCHA_LIMIT
            ? 'returning_user_window'
            : null;

  if (!softReason) {
    return { action: 'allow', reason: 'under_limits', retryAfterSeconds: null };
  }

  if (captchaPassed) {
    return { action: 'allow', reason: 'captcha_passed', retryAfterSeconds: null };
  }

  if (!captchaConfigured) {
    return { action: 'allow', reason: 'captcha_unconfigured_bypass', retryAfterSeconds: null };
  }

  return { action: 'captcha_required', reason: softReason, retryAfterSeconds: null };
}

export function isCheckoutCaptchaConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = (env.CHECKOUT_CAPTCHA_MODE ?? 'progressive').trim().toLowerCase();
  if (mode === 'off' || mode === 'disabled' || mode === 'false') return false;
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim() && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

export function resolveCheckoutClientIp(headers: Headers): string | null {
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    headers.get('x-vercel-forwarded-for'),
    headers.get('x-forwarded-for')?.split(',')[0],
  ];
  const candidate = candidates.find((value) => value?.trim());
  return candidate?.trim() ?? null;
}

export function hashCheckoutIp(ip: string | null): string {
  const normalizedIp = ip?.trim() || 'unknown';
  const secret =
    process.env.CHECKOUT_GUARD_HASH_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    CHECKOUT_GUARD_HASH_FALLBACK;
  return createHmac('sha256', secret).update(normalizedIp).digest('hex');
}

async function fetchCheckoutGuardCounts(userId: string, ipHash: string): Promise<CheckoutGuardCounts> {
  const rows = await query<CheckoutAttemptCountRow>(
    `SELECT
       COUNT(*) FILTER (
         WHERE user_id = $1
           AND outcome = 'session_created'
           AND created_at >= NOW() - INTERVAL '15 minutes'
       ) AS user_attempts_15m,
       COUNT(*) FILTER (
         WHERE user_id = $1
           AND outcome = 'session_created'
           AND created_at >= NOW() - INTERVAL '1 hour'
       ) AS user_attempts_1h,
       COUNT(*) FILTER (
         WHERE ip_hash = $2
           AND outcome = 'session_created'
           AND created_at >= NOW() - INTERVAL '15 minutes'
       ) AS ip_attempts_15m
       FROM checkout_attempts`,
    [userId, ipHash]
  );

  const row = rows[0];
  return {
    userAttempts15m: Number(row?.user_attempts_15m ?? 0),
    userAttempts1h: Number(row?.user_attempts_1h ?? 0),
    ipAttempts15m: Number(row?.ip_attempts_15m ?? 0),
  };
}

async function verifyTurnstileToken(token: string, clientIp: string | null): Promise<{ success: boolean; errorCodes: string[] }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { success: false, errorCodes: ['missing-secret'] };
  }

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (clientIp) {
    formData.append('remoteip', clientIp);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as TurnstileSiteverifyResponse | null;
    if (!response.ok || !payload?.success) {
      return { success: false, errorCodes: payload?.['error-codes'] ?? ['siteverify-failed'] };
    }
    return { success: true, errorCodes: [] };
  } catch (error) {
    return { success: false, errorCodes: [error instanceof Error ? error.name : 'siteverify-error'] };
  } finally {
    clearTimeout(timeout);
  }
}

async function recordCheckoutAttempt({
  userId,
  ipHash,
  amountCents,
  mode,
  outcome,
  captchaRequired,
  captchaPassed,
  reason,
  metadata,
}: {
  userId: string;
  ipHash: string;
  amountCents: number;
  mode: CheckoutGuardMode;
  outcome: string;
  captchaRequired: boolean;
  captchaPassed: boolean;
  reason: string;
  metadata: Record<string, unknown>;
}): Promise<number> {
  const rows = await query<CheckoutAttemptRow>(
    `INSERT INTO checkout_attempts (
       user_id,
       ip_hash,
       amount_cents,
       mode,
       outcome,
       captcha_required,
       captcha_passed,
       reason,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id`,
    [
      userId,
      ipHash,
      amountCents,
      mode,
      outcome,
      captchaRequired,
      captchaPassed,
      reason,
      JSON.stringify(metadata),
    ]
  );
  return Number(rows[0]?.id ?? 0);
}

export async function evaluateWalletCheckoutGuard(
  params: EvaluateWalletCheckoutGuardParams
): Promise<WalletCheckoutGuardResult> {
  const ipHash = hashCheckoutIp(params.clientIp);
  const counts = await fetchCheckoutGuardCounts(params.userId, ipHash);
  const captchaConfigured = isCheckoutCaptchaConfigured();
  const captchaToken = params.captchaToken?.trim() ?? '';
  const verification = captchaToken && captchaConfigured
    ? await verifyTurnstileToken(captchaToken, params.clientIp)
    : { success: false, errorCodes: [] };

  const decision = classifyCheckoutGuardDecision({
    hasCompletedTopUp: params.hasCompletedTopUp,
    isPresetTopupTier: params.isPresetTopupTier,
    captchaConfigured,
    captchaPassed: verification.success,
    ...counts,
  });
  const outcome =
    decision.action === 'allow'
      ? 'pending'
      : decision.action === 'rate_limited'
        ? 'rate_limited'
        : captchaToken && captchaConfigured && !verification.success
          ? 'captcha_failed'
          : 'captcha_required';

  const attemptId = await recordCheckoutAttempt({
    userId: params.userId,
    ipHash,
    amountCents: params.amountCents,
    mode: params.mode,
    outcome,
    captchaRequired: decision.action === 'captcha_required',
    captchaPassed: verification.success,
    reason: decision.reason,
    metadata: {
      ...params.metadata,
      captchaConfigured,
      turnstileErrors: verification.errorCodes,
      counts,
    },
  });

  return {
    ...decision,
    attemptId,
    captchaConfigured,
    captchaPassed: verification.success,
  };
}

export async function markCheckoutAttemptSessionCreated(attemptId: number, sessionId: string): Promise<void> {
  if (!Number.isFinite(attemptId) || attemptId <= 0) return;
  await query(
    `UPDATE checkout_attempts
        SET outcome = 'session_created',
            stripe_checkout_session_id = $2
      WHERE id = $1`,
    [attemptId, sessionId]
  );
}

export async function markCheckoutAttemptSessionFailed(attemptId: number, reason: string): Promise<void> {
  if (!Number.isFinite(attemptId) || attemptId <= 0) return;
  await query(
    `UPDATE checkout_attempts
        SET outcome = 'session_failed',
            reason = $2
      WHERE id = $1
        AND outcome = 'pending'`,
    [attemptId, reason.slice(0, 240)]
  );
}
