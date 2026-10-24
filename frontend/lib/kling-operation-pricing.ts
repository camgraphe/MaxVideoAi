import { videoOperationTariffIdentity } from './video-operation';

/** Dated public endpoint rates, not an invoice or authenticated effective-charge formula. */
export function klingOperationPublishedRate(engineId: string, mode: string, operation?: unknown) {
  const identity = videoOperationTariffIdentity(engineId, mode, operation);
  if (!identity || identity.operation === 'luma-extend') return undefined;
  const centsPerSecond = engineId === 'kling-o3-standard' ? 12.6 : engineId === 'kling-o3-pro' ? 16.8 : 42;
  return { ...identity, centsPerSecond, checkedAt: '2026-10-24', kind: 'published_endpoint_rate' as const,
    sourceUrl: `https://fal.ai/models/${identity.endpoint}`,
    effectiveSupplierChargeVerified: false as const };
}
