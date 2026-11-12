import type { NextRequest } from 'next/server';
import { CONSENT_COOKIE_NAME, parseConsent } from '@/lib/consent';
import {
  OPENAI_ATTRIBUTION_COOKIE,
  parseOpenAIAttribution,
  type OpenAIAttribution,
} from '@/lib/analytics/openai-contract';

function decoded(value: string | undefined): string | null {
  try {
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}
export async function readOpenAIRequestAttribution(req: NextRequest): Promise<OpenAIAttribution | null> {
  if (
    process.env.VERCEL_ENV !== 'production' ||
    !process.env.OPENAI_ADS_CONVERSIONS_KEY ||
    process.env.OPENAI_ADS_CONVERSIONS_DISABLED === '1'
  )
    return null;
  const consent = parseConsent(decoded(req.cookies.get(CONSENT_COOKIE_NAME)?.value));
  if (!consent?.categories.analytics || !consent.categories.ads) return null;
  const { getLegalDocumentUncached } = await import('@/lib/legal');
  const policy = await getLegalDocumentUncached('cookies');
  if (!policy || consent.version !== policy.version) return null;
  return parseOpenAIAttribution(decoded(req.cookies.get(OPENAI_ATTRIBUTION_COOKIE)?.value), {
    ...consent.categories,
    version: policy.version,
    timestamp: consent.timestamp,
  });
}
export function openAICheckoutMetadata(attribution: OpenAIAttribution | null): Record<string, string> {
  if (!attribution) return {};
  return {
    openai_conversion_version: '1',
    openai_oppref: attribution.oppref,
    openai_click_at: String(attribution.capturedAt),
    openai_consent_at: String(attribution.consentAt),
    openai_policy_version: attribution.policyVersion,
    openai_consent_observed_at: new Date().toISOString(),
  };
}
