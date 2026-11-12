import type { NextRequest } from 'next/server';
import { CONSENT_COOKIE_NAME, parseConsent } from '@/lib/consent';
import {
  OPENAI_ATTRIBUTION_COOKIE,
  parseOpenAIAttribution,
  type OpenAIAttribution,
} from '@/lib/analytics/openai-contract';

export async function readOpenAIRequestAttribution(req: NextRequest): Promise<OpenAIAttribution | null> {
  if (
    process.env.VERCEL_ENV !== 'production' ||
    !process.env.OPENAI_ADS_CONVERSIONS_KEY ||
    process.env.OPENAI_ADS_CONVERSIONS_DISABLED === '1'
  )
    return null;
  const consent = parseConsent(req.cookies.get(CONSENT_COOKIE_NAME)?.value ?? null);
  if (!consent?.categories.analytics || !consent.categories.ads) return null;
  const { getLegalDocumentUncached } = await import('@/lib/legal');
  const policy = await getLegalDocumentUncached('cookies');
  return policy ? parseOpenAIRequestAttribution(req, policy.version) : null;
}

export function parseOpenAIRequestAttribution(req: NextRequest, policyVersion: string): OpenAIAttribution | null {
  // NextRequest already URI-decodes cookie values. A second decode corrupts opaque IDs.
  const consent = parseConsent(req.cookies.get(CONSENT_COOKIE_NAME)?.value ?? null);
  if (!consent || consent.version !== policyVersion) return null;
  return parseOpenAIAttribution(req.cookies.get(OPENAI_ATTRIBUTION_COOKIE)?.value, {
    ...consent.categories,
    version: policyVersion,
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
