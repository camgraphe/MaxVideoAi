export type HostedWalletCheckoutFailureReason =
  | 'authentication'
  | 'validation'
  | 'network'
  | 'stripe'
  | 'unknown';

export type HostedWalletCheckoutInput = {
  amountCents: number;
  currency: string;
  locale: string;
  accessToken: string | null;
  captchaToken?: string;
};

export type HostedWalletCheckoutResult =
  | {
      kind: 'ready';
      url: string | null;
      sessionId: string | null;
      checkoutAttemptId: number | null;
    }
  | { kind: 'captcha_required' }
  | { kind: 'rate_limited'; retryAfterSeconds: number | null }
  | {
      kind: 'failed';
      reason: HostedWalletCheckoutFailureReason;
      checkoutAttemptId: number | null;
    };

const MIN_TOPUP_CENTS = 1000;

export function createHostedCheckoutSubmissionGuard() {
  let active = false;
  return {
    tryStart(): boolean {
      if (active) return false;
      active = true;
      return true;
    },
    finish(): void {
      active = false;
    },
  };
}

function normalizeAttemptId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeRetryAfter(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : null;
}

function failureReasonForStatus(status: number): HostedWalletCheckoutFailureReason {
  if (status === 401) return 'authentication';
  if (status === 400 || status === 422) return 'validation';
  return 'unknown';
}

export async function requestHostedWalletCheckout(
  input: HostedWalletCheckoutInput,
  fetchImpl: typeof fetch = fetch
): Promise<HostedWalletCheckoutResult> {
  const currency = input.currency.trim().toUpperCase();
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < MIN_TOPUP_CENTS) {
    return { kind: 'failed', reason: 'validation', checkoutAttemptId: null };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { kind: 'failed', reason: 'validation', checkoutAttemptId: null };
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (input.accessToken) {
    headers.set('Authorization', `Bearer ${input.accessToken}`);
  }

  try {
    const response = await fetchImpl('/api/wallet', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        amountCents: input.amountCents,
        currency: currency.toLowerCase(),
        locale: input.locale,
        ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
      }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      if (payload?.captchaRequired === true) {
        return { kind: 'captcha_required' };
      }
      if (response.status === 429) {
        return {
          kind: 'rate_limited',
          retryAfterSeconds: normalizeRetryAfter(payload?.retryAfterSeconds),
        };
      }
      return {
        kind: 'failed',
        reason: failureReasonForStatus(response.status),
        checkoutAttemptId: normalizeAttemptId(payload?.checkoutAttemptId),
      };
    }

    const url = typeof payload?.url === 'string' && payload.url.trim() ? payload.url.trim() : null;
    const sessionId = typeof payload?.id === 'string' && payload.id.trim() ? payload.id.trim() : null;
    const checkoutAttemptId = normalizeAttemptId(payload?.checkoutAttemptId);
    if (!url && !sessionId) {
      return { kind: 'failed', reason: 'unknown', checkoutAttemptId };
    }
    return { kind: 'ready', url, sessionId, checkoutAttemptId };
  } catch {
    return { kind: 'failed', reason: 'network', checkoutAttemptId: null };
  }
}
