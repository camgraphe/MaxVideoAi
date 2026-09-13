import { randomUUID } from 'node:crypto';
import { type InitialAudioJobParams, PLACEHOLDER_THUMB } from './audio-generate-jobs';
import { buildPromptSummary, buildInitialAudioSettingsSnapshot } from './audio-generate-snapshots';
import type { prepareAudioRun } from './prepare-audio';
export type PreparedAudioRun = Awaited<ReturnType<typeof prepareAudioRun>>;

export function buildAudioRunReservation(prepared: PreparedAudioRun, userId: string) {
  const { normalized, packConfig, sourceJob, sourceVideoUrl, durationSec, aspectRatio, pricingSnapshot } = prepared;
  const pricingSnapshotJson = JSON.stringify(pricingSnapshot);
  const promptSummary = buildPromptSummary({
    pack: normalized.pack,
    prompt: normalized.prompt,
    mood: normalized.mood,
    script: normalized.script,
  });
  const initialSettingsSnapshot = buildInitialAudioSettingsSnapshot({
    durationSec,
    normalized,
    sourceJobId: sourceJob?.job_id ?? null,
    sourceVideoUrl,
  });

  const jobId = `aud_${randomUUID()}`;
  const amountCents = pricingSnapshot.totalCents;
  const initialThumb = sourceJob?.thumb_url ?? PLACEHOLDER_THUMB;

  const initialJob: InitialAudioJobParams = {
    userId,
    jobId,
    amountCents,
    currency: pricingSnapshot.currency,
    description: packConfig.label,
    billingProductKey: packConfig.billingProductKey,
    pricingSnapshotJson,
    applicationFeeCents: pricingSnapshot.platformFeeCents ?? pricingSnapshot.margin.amountCents,
    vendorAccountId: pricingSnapshot.vendorAccountId ?? null,
    engineId: packConfig.engineId,
    engineLabel: packConfig.label,
    durationSec: normalized.pack === 'song' ? null : durationSec,
    promptSummary,
    initialThumb,
    aspectRatio,
    settingsSnapshotJson: JSON.stringify(initialSettingsSnapshot),
  };
  return { initialJob, execution: { userId, jobId, prepared, initialSettingsSnapshot, initialThumb, pricingSnapshotJson } };
}

/** In-process trusted reservation; never accepted from a request body. */
export type ReservedAudioRun = ReturnType<typeof buildAudioRunReservation>['execution'];
