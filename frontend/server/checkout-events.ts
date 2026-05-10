import { query } from '@/lib/db';

export type CheckoutInteractionMode = 'hosted' | 'express_checkout';

export type CheckoutInteractionEventName =
  | 'hosted_checkout_requested'
  | 'hosted_checkout_redirecting'
  | 'hosted_checkout_cancelled_return'
  | 'hosted_checkout_success_return'
  | 'express_checkout_revealed'
  | 'express_checkout_session_ready'
  | 'express_checkout_ready'
  | 'express_checkout_unavailable'
  | 'express_checkout_loaderror'
  | 'express_checkout_cancelled'
  | 'express_checkout_confirm_started'
  | 'express_checkout_confirm_failed'
  | 'express_checkout_confirm_succeeded';

const CHECKOUT_EVENT_NAMES = new Set<string>([
  'hosted_checkout_requested',
  'hosted_checkout_redirecting',
  'hosted_checkout_cancelled_return',
  'hosted_checkout_success_return',
  'express_checkout_revealed',
  'express_checkout_session_ready',
  'express_checkout_ready',
  'express_checkout_unavailable',
  'express_checkout_loaderror',
  'express_checkout_cancelled',
  'express_checkout_confirm_started',
  'express_checkout_confirm_failed',
  'express_checkout_confirm_succeeded',
]);

export type CheckoutInteractionEventInput = {
  userId: string;
  eventName: CheckoutInteractionEventName;
  checkoutAttemptId?: number | null;
  stripeCheckoutSessionId?: string | null;
  mode?: CheckoutInteractionMode | null;
  amountCents?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type CheckoutInteractionEventPayload = Omit<CheckoutInteractionEventInput, 'userId' | 'eventName'> & {
  eventName: CheckoutInteractionEventName;
};

export function normalizeCheckoutInteractionEventPayload(body: unknown): CheckoutInteractionEventPayload | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const eventName = typeof record.eventName === 'string' ? record.eventName.trim() : '';
  if (!CHECKOUT_EVENT_NAMES.has(eventName)) return null;

  const mode = record.mode === 'hosted' || record.mode === 'express_checkout' ? record.mode : null;
  const checkoutAttemptId = Number(record.checkoutAttemptId);
  const amountCents = Number(record.amountCents);
  const stripeCheckoutSessionId =
    typeof record.stripeCheckoutSessionId === 'string' && record.stripeCheckoutSessionId.trim()
      ? record.stripeCheckoutSessionId.trim()
      : null;
  const metadata =
    record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
      ? sanitizeCheckoutEventMetadata(record.metadata as Record<string, unknown>)
      : null;

  return {
    eventName: eventName as CheckoutInteractionEventName,
    checkoutAttemptId: Number.isFinite(checkoutAttemptId) && checkoutAttemptId > 0 ? Math.round(checkoutAttemptId) : null,
    stripeCheckoutSessionId,
    mode,
    amountCents: Number.isFinite(amountCents) && amountCents >= 0 ? Math.round(amountCents) : null,
    metadata,
  };
}

function sanitizeCheckoutEventMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(metadata).slice(0, 24);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (!/^[a-zA-Z0-9_.:-]{1,64}$/.test(key)) continue;
    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, 500);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitized[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      sanitized[key] = value
        .filter((entry) => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean')
        .slice(0, 12);
    }
  }
  return sanitized;
}

export async function recordCheckoutInteractionEvent({
  amountCents = null,
  checkoutAttemptId = null,
  eventName,
  metadata = null,
  mode = null,
  stripeCheckoutSessionId = null,
  userId,
}: CheckoutInteractionEventInput): Promise<void> {
  await query(
    `INSERT INTO checkout_interaction_events (
       checkout_attempt_id,
       user_id,
       stripe_checkout_session_id,
       event_name,
       mode,
       amount_cents,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      checkoutAttemptId,
      userId,
      stripeCheckoutSessionId,
      eventName,
      mode,
      amountCents,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}
