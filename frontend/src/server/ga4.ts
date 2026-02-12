import { createHash } from 'crypto';
import { ENV } from '@/lib/env';

type Ga4ParamValue = string | number | boolean;

type SendGa4EventArgs = {
  name: string;
  params?: Record<string, unknown>;
  clientId?: string | null;
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

export async function sendGa4Event({ name, params, clientId, userId }: SendGa4EventArgs): Promise<boolean> {
  const measurementId = ENV.GA4_MEASUREMENT_ID;
  const apiSecret = ENV.GA4_API_SECRET;

  if (!measurementId || !apiSecret) {
    return false;
  }

  const resolvedClientId = extractGaClientId(clientId) ?? deriveClientIdFromUserId(userId);
  if (!resolvedClientId) {
    return false;
  }

  const eventName = (name || '').trim().slice(0, 40);
  if (!eventName) {
    return false;
  }

  const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
    measurementId
  )}&api_secret=${encodeURIComponent(apiSecret)}`;
  const eventParams = sanitizeParams(params);
  eventParams.engagement_time_msec = 1;

  const payload: Record<string, unknown> = {
    client_id: resolvedClientId,
    non_personalized_ads: true,
    events: [
      {
        name: eventName,
        params: eventParams,
      },
    ],
  };

  if (userId) {
    payload.user_id = userId;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn('[ga4] Measurement Protocol request failed', {
        status: response.status,
        body: body.slice(0, 200),
        eventName,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[ga4] Measurement Protocol request error', {
      eventName,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
