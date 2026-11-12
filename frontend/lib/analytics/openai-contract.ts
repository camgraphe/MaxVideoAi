export const OPENAI_ATTRIBUTION_COOKIE = 'mvai-openai-click';
export const OPENAI_CLICK_TTL_MS = 30 * 86400_000;
export const OPENAI_EVENT_MAX_AGE_MS = 167 * 3600_000;
const OPENAI_METADATA_KEYS = [
  'openai_conversion_version',
  'openai_oppref',
  'openai_click_at',
  'openai_consent_at',
  'openai_policy_version',
  'openai_consent_observed_at',
] as const;
export function projectOpenAIMetadata(metadata: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    OPENAI_METADATA_KEYS.flatMap((key) => (typeof metadata[key] === 'string' ? [[key, metadata[key] as string]] : []))
  );
}

export type OpenAIAttribution = { oppref: string; capturedAt: number; consentAt: number; policyVersion: string };
export type OpenAIConsent = { analytics: boolean; ads: boolean; version: string; timestamp?: number };
export type OpenAIConversionEvent = {
  id: string;
  type: 'registration_completed' | 'order_created';
  timestamp_ms: number;
  source_url: 'https://maxvideoai.com';
  action_source: 'web';
  oppref: string;
  opt_out: true;
  data: { type: 'customer_action' } | { type: 'contents'; amount: number; currency: string };
};

/** Stripe metadata values are limited to 500 characters. Never trim/hash an oppref. */
export function validOpenAIClickId(value: unknown): value is string {
  return (
    typeof value === 'string' && /^[\x21-\x7e]{1,500}$/.test(value) && !value.includes('@') && !value.includes('://')
  );
}

export function parseOpenAIAttribution(
  raw: unknown,
  consent: OpenAIConsent,
  now = Date.now()
): OpenAIAttribution | null {
  if (!consent.analytics || !consent.ads || typeof raw !== 'string' || raw.length > 1500) return null;
  try {
    const value = JSON.parse(raw) as OpenAIAttribution;
    if (
      !validOpenAIClickId(value.oppref) ||
      value.policyVersion !== consent.version ||
      !Number.isSafeInteger(value.capturedAt) ||
      value.capturedAt > now ||
      value.capturedAt <= now - OPENAI_CLICK_TTL_MS ||
      !Number.isSafeInteger(value.consentAt) ||
      value.consentAt <= 0 ||
      value.consentAt > value.capturedAt ||
      (consent.timestamp !== undefined && value.consentAt !== consent.timestamp)
    )
      return null;
    return {
      oppref: value.oppref,
      capturedAt: value.capturedAt,
      consentAt: value.consentAt,
      policyVersion: value.policyVersion,
    };
  } catch {
    return null;
  }
}

function baseEvent(
  id: string,
  type: OpenAIConversionEvent['type'],
  occurredAt: number,
  attribution: OpenAIAttribution
) {
  return {
    id,
    type,
    timestamp_ms: occurredAt,
    source_url: 'https://maxvideoai.com' as const,
    action_source: 'web' as const,
    oppref: attribution.oppref,
    opt_out: true as const,
  };
}

export function buildOpenAIOrderEvent(input: {
  id: string;
  occurredAt: number;
  liveMode: unknown;
  amountMinor: number;
  currency: string;
  attribution: OpenAIAttribution | null;
}): OpenAIConversionEvent | null {
  if (
    input.liveMode !== true ||
    !input.attribution ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    !/^[a-z]{3}$/i.test(input.currency) ||
    !Number.isSafeInteger(input.occurredAt)
  )
    return null;
  return {
    ...baseEvent(input.id, 'order_created', input.occurredAt, input.attribution),
    data: { type: 'contents', amount: input.amountMinor, currency: input.currency.toUpperCase() },
  };
}

export function buildOpenAIRegistrationEvent(input: {
  id: string;
  createdAt: number;
  now: number;
  attribution: OpenAIAttribution | null;
}): OpenAIConversionEvent | null {
  if (
    !input.attribution ||
    !Number.isSafeInteger(input.createdAt) ||
    input.createdAt < input.attribution.capturedAt ||
    input.createdAt > input.now ||
    input.createdAt <= input.now - OPENAI_EVENT_MAX_AGE_MS
  )
    return null;
  return {
    ...baseEvent(input.id, 'registration_completed', input.createdAt, input.attribution),
    data: { type: 'customer_action' },
  };
}
