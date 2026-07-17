import { query } from '@/lib/db';
import { deriveJobSurface } from '@/lib/job-surface';
import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders } from '@/lib/image-renders';
import { normalizeMediaUrl } from '@/lib/media';
import type { PricingSnapshot } from '@/types/engines';
import { readTrialJobStatus } from '@/server/agent-api/trial-outcomes';

import { mapGenerationStatusRecordToAgent } from './agent-generation-policy';

export { mapGenerationStatusRecordToAgent };

export type AgentGenerationResult =
  | {
      surface: 'video';
      videoUrl: string;
      previewUrl: string | null;
      thumbnailUrl: string | null;
      audioUrl: string | null;
    }
  | {
      surface: 'image';
      imageUrls: string[];
      thumbnailUrls: string[];
    };

export type AgentGenerationStatus = {
  jobId: string;
  surface: 'video' | 'image';
  status: 'accepted' | 'running' | 'completed' | 'failed';
  progress: number | null;
  message: string | null;
  priceCents: number | null;
  currency: string | null;
  paymentStatus: string | null;
  funding?: 'included_trial';
  entitlementState?: 'reserved' | 'consumed' | 'released';
  result: AgentGenerationResult | null;
  retryAfterSeconds: number | null;
};

export type GenerationStatusRecord = {
  id: number;
  job_id: string;
  user_id: string | null;
  status: string | null;
  progress: number | null;
  provider_job_id: string | null;
  provider: string | null;
  surface: string | null;
  billing_product_key: string | null;
  video_url: string | null;
  preview_video_url: string | null;
  audio_url: string | null;
  thumb_url: string | null;
  preview_frame: string | null;
  engine_id: string;
  engine_label: string;
  duration_sec: number;
  prompt: string;
  created_at: string;
  final_price_cents: number | null;
  pricing_snapshot: PricingSnapshot | null;
  settings_snapshot: unknown;
  currency: string | null;
  payment_status: string | null;
  vendor_account_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  batch_id: string | null;
  group_id: string | null;
  iteration_index: number | null;
  iteration_count: number | null;
  render_ids: unknown;
  hero_render_id: string | null;
  local_key: string | null;
  message: string | null;
  eta_seconds: number | null;
  eta_label: string | null;
  aspect_ratio: string | null;
};

export const GENERATION_STATUS_SELECT = `id, job_id, user_id, status, progress, provider_job_id, provider, surface, billing_product_key, video_url, preview_video_url, audio_url, thumb_url, preview_frame, engine_id, engine_label, duration_sec, prompt, created_at, final_price_cents, pricing_snapshot, settings_snapshot, currency, payment_status, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, aspect_ratio`;

type GenerationStatusQuery = (
  sql: string,
  params?: ReadonlyArray<unknown>
) => Promise<GenerationStatusRecord[]>;

export async function readOwnedGenerationRecord(params: {
  userId: string;
  jobId: string;
  queryFn?: GenerationStatusQuery;
}): Promise<GenerationStatusRecord | null> {
  const userId = params.userId.trim();
  const jobId = params.jobId.trim();
  if (!userId || !jobId) return null;
  const queryFn: GenerationStatusQuery = params.queryFn ?? query;
  const rows = await queryFn(
    `SELECT ${GENERATION_STATUS_SELECT}
       FROM app_jobs
      WHERE job_id = $1
        AND user_id = $2
      LIMIT 1`,
    [jobId, userId]
  );
  const record = rows[0];
  if (!record || record.job_id !== jobId || record.user_id !== userId) return null;
  return record;
}

export async function getGenerationStatus(params: {
  userId: string;
  jobId: string;
  queryFn?: GenerationStatusQuery;
}): Promise<AgentGenerationStatus | null> {
  const record = await readOwnedGenerationRecord(params);
  if (!record) return null;
  const status = mapGenerationStatusRecordToAgent(record);
  if (!status || status.paymentStatus !== 'included_mcp_trial') return status;
  const trial = await readTrialJobStatus({ userId: params.userId, jobId: params.jobId });
  if (!trial) throw new Error('Included trial lifecycle state is unavailable.');
  return { ...status, paymentStatus: 'included_trial', ...trial };
}

function buildFallbackSettingsSnapshot(record: GenerationStatusRecord): unknown {
  const surface = deriveJobSurface({
    surface: record.surface,
    settingsSnapshot: record.settings_snapshot,
    jobId: record.job_id,
    engineId: record.engine_id,
    videoUrl: record.video_url,
    renderIds: record.render_ids,
  });
  if (surface !== 'video') {
    const renderIds = extractRenderIds(parseStoredImageRenders(record.render_ids).entries) ?? [];
    return {
      schemaVersion: 1,
      surface,
      engineId: record.engine_id,
      engineLabel: record.engine_label,
      inputMode: 't2i',
      prompt: record.prompt ?? '',
      core: { numImages: renderIds.length || 1, aspectRatio: record.aspect_ratio ?? null, resolution: null },
      refs: { imageUrls: [] },
      meta: { derived: true },
    };
  }
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: record.engine_id,
    engineLabel: record.engine_label,
    inputMode: 't2v',
    prompt: record.prompt ?? '',
    negativePrompt: null,
    core: {
      durationSec: record.duration_sec ?? null,
      durationOption: null,
      numFrames: null,
      aspectRatio: record.aspect_ratio ?? null,
      resolution: null,
      fps: null,
      iterationCount: null,
    },
    advanced: { cfgScale: null, loop: null },
    refs: {
      imageUrl: null,
      referenceImages: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      inputs: null,
    },
    meta: { derived: true },
  };
}

export type GenerationStatusWebOverrides = {
  status?: string;
  progress?: number;
  videoUrl?: string | null;
  previewVideoUrl?: string | null;
  audioUrl?: string | null;
  thumbUrl?: string | null;
  renderIds?: string[] | null;
  renderThumbUrls?: string[] | null;
  message?: string | null;
  useFallbackSettingsSnapshot?: boolean;
};

export function mapGenerationStatusRecordToWeb(
  record: GenerationStatusRecord,
  overrides: GenerationStatusWebOverrides = {}
) {
  const parsedRenders = parseStoredImageRenders(record.render_ids);
  const surface = deriveJobSurface({
    surface: record.surface,
    settingsSnapshot: record.settings_snapshot,
    jobId: record.job_id,
    engineId: record.engine_id,
    videoUrl: record.video_url,
    renderIds: record.render_ids,
  });
  const useFallbackSettingsSnapshot = overrides.useFallbackSettingsSnapshot !== false;
  const override = <K extends keyof GenerationStatusWebOverrides>(
    key: K,
    fallback: GenerationStatusWebOverrides[K]
  ): GenerationStatusWebOverrides[K] =>
    Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback;
  return {
    ok: true,
    jobId: record.job_id,
    surface,
    billingProductKey: record.billing_product_key ?? undefined,
    createdAt: record.created_at,
    status: override('status', record.status ?? undefined),
    progress: override('progress', record.progress ?? undefined),
    videoUrl: normalizeMediaUrl(override('videoUrl', record.video_url)) ?? undefined,
    previewVideoUrl: normalizeMediaUrl(override('previewVideoUrl', record.preview_video_url)) ?? undefined,
    audioUrl: normalizeMediaUrl(override('audioUrl', record.audio_url)) ?? undefined,
    thumbUrl: normalizeMediaUrl(override('thumbUrl', record.thumb_url)) ?? undefined,
    aspectRatio: record.aspect_ratio ?? undefined,
    pricing: record.pricing_snapshot ?? undefined,
    settingsSnapshot:
      record.settings_snapshot && typeof record.settings_snapshot === 'object'
        ? record.settings_snapshot
        : useFallbackSettingsSnapshot
          ? buildFallbackSettingsSnapshot(record)
          : undefined,
    finalPriceCents: record.final_price_cents ?? undefined,
    currency: record.currency ?? 'USD',
    paymentStatus: record.payment_status ?? undefined,
    vendorAccountId: record.vendor_account_id ?? undefined,
    stripePaymentIntentId: record.stripe_payment_intent_id ?? undefined,
    stripeChargeId: record.stripe_charge_id ?? undefined,
    batchId: record.batch_id ?? undefined,
    groupId: record.group_id ?? undefined,
    iterationIndex: record.iteration_index ?? undefined,
    iterationCount: record.iteration_count ?? undefined,
    renderIds: override('renderIds', extractRenderIds(parsedRenders.entries) ?? undefined),
    renderThumbUrls: override('renderThumbUrls', extractRenderThumbUrls(parsedRenders) ?? undefined),
    heroRenderId: record.hero_render_id ?? undefined,
    localKey: record.local_key ?? undefined,
    message: override('message', record.message ?? undefined) ?? undefined,
    etaSeconds: record.eta_seconds ?? undefined,
    etaLabel: record.eta_label ?? undefined,
  };
}
