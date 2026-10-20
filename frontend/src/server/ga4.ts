import { createHash } from 'crypto';
import { ENV } from '@/lib/env';
import { normalizeGa4SessionId } from '@/lib/analytics/ga-session-id';
import { boundGa4EventParams } from '@/lib/analytics/ga4-params';

type Ga4ParamValue = string | number | boolean;

export type SendGa4EventArgs = {
  timestampMicros?: number;
  name: string;
  params?: Record<string, unknown>;
  clientId?: string | null;
  sessionId?: string | number | null;
  userId?: string | null;
};

const GA4_PARAM_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;

function toSafeParamName(key: string): string | null {
  if (!key) return null;
  if (GA4_PARAM_NAME_REGEX.test(key)) return key;
  const sanitized = key
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+/, '');
  if (!sanitized || !/^[a-zA-Z]/.test(sanitized)) return null;
  const truncated = sanitized.slice(0, 40);
  return GA4_PARAM_NAME_REGEX.test(truncated) ? truncated : null;
}

function toSafeParamValue(value: unknown): Ga4ParamValue | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 100) : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function sanitizeParams(params: Record<string, unknown> | undefined): Record<string, Ga4ParamValue> {
  const result: Record<string, Ga4ParamValue> = {};
  if (!params) return result;
  for (const [rawKey, rawValue] of Object.entries(params)) {
    const key = toSafeParamName(rawKey);
    const value = toSafeParamValue(rawValue);
    if (!key || value === null) continue;
    result[key] = value;
  }
  return result;
}

function deriveClientIdFromUserId(userId: string | null | undefined): string | null {
  if (!userId) return null;
  const digest = createHash('sha256').update(userId).digest('hex');
  const left = Number.parseInt(digest.slice(0, 10), 16);
  const right = Number.parseInt(digest.slice(10, 20), 16);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return `${left}.${right}`;
}

export function extractGaClientId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (/^\d+\.\d+$/.test(value)) return value;
  const gaCookieMatch = /^GA\d+\.\d+\.(\d+\.\d+)$/.exec(value);
  if (gaCookieMatch?.[1]) return gaCookieMatch[1];
  return null;
}

export type Ga4DeliveryResult = {
  status: 'accepted' | 'retry' | 'dead';
  code: string;
  httpStatus?: number;
};

export async function sendGa4EventWithResult(
  { name, params, clientId, sessionId, userId, timestampMicros }: SendGa4EventArgs,
  options: { timeoutMs?: number } = {},
): Promise<Ga4DeliveryResult> {
  const measurementId = ENV.GA4_MEASUREMENT_ID;
  const apiSecret = ENV.GA4_API_SECRET;

  if (!measurementId || !apiSecret) {
    return { status: 'retry', code: 'configuration_missing' };
  }

  const resolvedClientId = extractGaClientId(clientId) ?? deriveClientIdFromUserId(userId);
  if (!resolvedClientId) {
    return { status: 'dead', code: 'client_id_missing' };
  }

  const eventName = (name || '').trim().slice(0, 40);
  if (!eventName) {
    return { status: 'dead', code: 'event_name_missing' };
  }

  const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
    measurementId
  )}&api_secret=${encodeURIComponent(apiSecret)}`;
  const eventParams = sanitizeParams(params);
  const resolvedSessionId = normalizeGa4SessionId(sessionId);
  if (resolvedSessionId) {
    eventParams.session_id = resolvedSessionId;
  }
  eventParams.engagement_time_msec = 1;
  const boundedParams = boundGa4EventParams(eventParams);

  const payload: Record<string, unknown> = {
    client_id: resolvedClientId,
    non_personalized_ads: true,
    events: [
      {
        name: eventName,
        params: boundedParams,
      },
    ],
  };

  if (userId) {
    payload.user_id = userId;
  }

  if (timestampMicros !== undefined) {
    if (!Number.isSafeInteger(timestampMicros) || timestampMicros <= 0) {
      return { status: 'dead', code: 'invalid_timestamp' };
    }
    payload.timestamp_micros = timestampMicros;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Math.min(5000, options.timeoutMs ?? 5000)));
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'error',
    });
    // Google advises correcting non-2xx requests, not replaying them unchanged.
    // Neither response bodies nor fetch error strings are safe diagnostic data.
    void response.body?.cancel().catch(() => undefined);
    return response.ok
      ? { status: 'accepted', code: 'http_2xx', httpStatus: response.status }
      : { status: 'dead', code: 'http_error', httpStatus: response.status };
  } catch {
    return { status: 'retry', code: controller.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendGa4Event(args: SendGa4EventArgs): Promise<boolean> {
  return (await sendGa4EventWithResult(args)).status === 'accepted';
}
