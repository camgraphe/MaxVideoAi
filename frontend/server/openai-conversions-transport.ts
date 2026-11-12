import { OPENAI_EVENT_MAX_AGE_MS, type OpenAIConversionEvent } from '@/lib/analytics/openai-contract';

export type OpenAIDeliveryResult = {
  status: 'accepted' | 'validated' | 'retry' | 'dead' | 'suppressed';
  code: string;
  httpStatus?: number;
};
type SendOptions = {
  pixelId?: string;
  apiKey?: string;
  production?: boolean;
  validateOnly?: boolean;
  fetcher?: typeof fetch;
};

/** No customer identity fields, raw URLs, response bodies or credentials enter logs. */
export async function sendOpenAIConversion(
  event: OpenAIConversionEvent,
  options: SendOptions = {}
): Promise<OpenAIDeliveryResult> {
  const production = options.production ?? process.env.VERCEL_ENV === 'production';
  if (!production) return { status: 'suppressed', code: 'not_production' };
  const pixelId = options.pixelId ?? process.env.OPENAI_ADS_PIXEL_ID;
  const apiKey = options.apiKey ?? process.env.OPENAI_ADS_CONVERSIONS_KEY;
  if (!pixelId || !apiKey) return { status: 'retry', code: 'configuration_missing' };
  if (event.timestamp_ms <= Date.now() - OPENAI_EVENT_MAX_AGE_MS || event.timestamp_ms > Date.now() + 600_000)
    return { status: 'dead', code: 'age_limit' };
  try {
    const response = await (options.fetcher ?? fetch)(
      `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ validate_only: options.validateOnly === true, events: [event] }),
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      }
    );
    if (response.ok)
      return { status: options.validateOnly ? 'validated' : 'accepted', code: 'http_2xx', httpStatus: response.status };
    return {
      status: response.status === 429 || response.status >= 500 ? 'retry' : 'dead',
      code: 'http_error',
      httpStatus: response.status,
    };
  } catch {
    return { status: 'retry', code: 'network' };
  }
}
