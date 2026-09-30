import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { AudioGenerateRequestBody } from '@/lib/audio-generation';
import { readyWorkspacePricingEstimate, unavailableWorkspacePricingEstimate } from './workspace-pricing';

type ExpectedAudioQuote = NonNullable<AudioGenerateRequestBody['expectedQuote']>;

export function expectedWorkspaceAudioQuote(pricing?: PricingSnapshot | null): ExpectedAudioQuote | undefined {
  const value = pricing?.meta?.studioAudioQuote as Partial<ExpectedAudioQuote> | undefined;
  if (!value || typeof value.inputKey !== 'string' || !value.inputKey ||
    typeof value.totalCents !== 'number' || !Number.isSafeInteger(value.totalCents) || value.totalCents < 0 ||
    typeof value.currency !== 'string' || !value.currency ||
    typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt)) return undefined;
  return { inputKey: value.inputKey, totalCents: value.totalCents, currency: value.currency, expiresAt: value.expiresAt };
}

export function formatWorkspaceAudioQuote(payload: {
  ok?: boolean;
  pricing?: PricingSnapshot;
  inputKey?: string;
  expiresAt?: number;
  message?: string;
} | null) {
  const pricing = payload?.pricing;
  const snapshot = pricing && { ...pricing, meta: { ...pricing.meta, studioAudioQuote: {
    inputKey: payload?.inputKey, totalCents: pricing.totalCents, currency: pricing.currency, expiresAt: payload?.expiresAt,
  } } };
  if (!payload?.ok || !snapshot || !expectedWorkspaceAudioQuote(snapshot)) {
    return unavailableWorkspacePricingEstimate(payload?.message ?? 'Current audio price is unavailable.');
  }
  return readyWorkspacePricingEstimate(snapshot.totalCents, snapshot.currency, snapshot);
}
