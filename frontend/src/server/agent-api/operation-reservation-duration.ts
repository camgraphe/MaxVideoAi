import { usesOperationReferenceSettlement, videoOperationTariffIdentity } from '@/lib/video-operation';
import type { CanonicalGenerationRequest } from './generation-types';

/** Reservation receives the locked, freshly repriced snapshot. Only strict source
 * operation identities may use measured duration; request duration is forbidden.
 * The integer job column is a display projection, never the billed quantity. */
export function operationReservationDuration(request: CanonicalGenerationRequest, snapshot: Record<string, unknown>,
  canonicalPricing: Record<string, unknown>): number | undefined {
  if (!usesOperationReferenceSettlement(request.engineId, request.mode, request.operation)) return undefined;
  if (request.settings.durationSec !== undefined || request.settings.durationOption !== undefined) throw new Error('Source operation cannot supply a requested duration.');
  const identity = videoOperationTariffIdentity(request.engineId, request.mode, request.operation)!;
  const binding = snapshot.videoOperation as Record<string,unknown> | undefined;
  const canonicalBinding = (canonicalPricing.meta as Record<string,unknown> | undefined)?.videoOperation as Record<string,unknown> | undefined;
  const seconds = binding?.sourceDurationSec;
  if (!binding || !canonicalBinding || Object.entries(identity).some(([key,value]) => binding[key] !== value || canonicalBinding[key] !== value)
    || typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0
    || (canonicalPricing.base as Record<string,unknown> | undefined)?.seconds !== seconds
    || typeof binding.sourceFingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(binding.sourceFingerprint)) {
    throw new Error('Trusted operation source duration changed before reservation.');
  }
  return Math.max(1, Math.round(seconds));
}
