import {
  BYTEPLUS_MODELARK_PROVIDER,
  BytePlusModelArkError,
  requireBytePlusSeedanceProfile,
  resolveBytePlusPollTransport,
} from '@/server/video-providers/byteplus-modelark';
import { isRecord } from './byteplus-record-utils';
import type { BytePlusPendingJob } from './byteplus-poll-types';
import { BYTEPLUS_MODELARK_LIST_PRICE_SOURCE, getBytePlusVideoListRate } from './byteplus-list-tariff';
import { seedanceOutputDimensions } from '@/lib/seedance-output-dimensions';
import { quoteSeedance25LasListCost, BYTEPLUS_LAS_LIST_PRICE_SOURCE } from './byteplus-las-tariff';

/** Exact supported supplier dimensions; never the padded historical retail basis. */
export function estimateBytePlusOutputTokens(input: {
  engineId: string; durationSec: number; resolution: string; aspectRatio?: string | null;
}) {
  const profile = requireBytePlusSeedanceProfile(input.engineId);
  const aspectRatio = input.aspectRatio ?? profile.defaultAspectRatio;
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0
    || !profile.resolutions.includes(input.resolution as never)
    || !profile.aspectRatios.includes(aspectRatio as never)) return null;
  const dimensions = seedanceOutputDimensions(input.engineId, input.resolution, aspectRatio);
  if (!dimensions) return null;
  return { ...dimensions, aspectRatio, tokenCount: dimensions.width * dimensions.height
    * Math.max(1, Math.round(input.durationSec)) * profile.framesPerSecond / 1024 };
}

/** Formula inferred from all 531 rows of the published minimum tables (2026-10-01).
 * Matches their integer token floor across every published duration/raster/ratio;
 * do not extrapolate outside those domains. Provider usage overrides the estimate.
 */
export function estimateBytePlusBillableTokens(input: Parameters<typeof estimateBytePlusOutputTokens>[0] & {
  billingInputType: 'no_video_input' | 'video_input'; inputVideoDurationSec?: number;
}) {
  const output = estimateBytePlusOutputTokens(input);
  if (!output) return null;
  if (input.billingInputType === 'no_video_input') return { ...output, minimumTokens: 0, inputVideoDurationSec: 0 };
  const maximumOutput = input.engineId === 'seedance-2-5' ? 30 : 15;
  if (!isBytePlusInputVideoPricingModel(input.engineId) || !Number.isInteger(input.durationSec)
    || input.durationSec < 4 || input.durationSec > maximumOutput
    || !Number.isFinite(input.inputVideoDurationSec) || !input.inputVideoDurationSec
    || input.inputVideoDurationSec < 0 || input.inputVideoDurationSec > maximumOutput) return null;
  const tokensPerSecond = output.tokenCount / input.durationSec;
  const minimumTokens = Math.round((input.durationSec + Math.ceil(input.durationSec * 2 / 3)) * tokensPerSecond);
  return { ...output, inputVideoDurationSec: input.inputVideoDurationSec, minimumTokens,
    tokenCount: Math.max(minimumTokens, (input.durationSec + input.inputVideoDurationSec) * tokensPerSecond) };
}

export function isBytePlusInputVideoPricingModel(engineId: string) {
  return ['seedance-2-0', 'seedance-2-0-mini', 'seedance-2-0-fast', 'seedance-2-5'].includes(engineId);
}

/** Accept only server-resolved media records, never client-declared durations. */
export function bytePlusInputVideoDurationSec(engineId: string, references: readonly {
  kind: string; durationSec?: number | null;
}[]) {
  if (!isBytePlusInputVideoPricingModel(engineId)) throw new Error('Unsupported BytePlus input-video model');
  const videos = references.filter(reference => reference.kind === 'video');
  const maximum = engineId === 'seedance-2-5' ? 30 : 15;
  let seconds = 0;
  for (const reference of videos) {
    if (typeof reference.durationSec !== 'number' || !Number.isFinite(reference.durationSec) || reference.durationSec <= 0) {
      throw new Error('Verified input-video duration is required for BytePlus pricing.');
    }
    seconds += reference.durationSec;
  }
  if (seconds > maximum) throw new Error('BytePlus input-video duration exceeds the supported maximum.');
  return seconds;
}

export function expectedBytePlusTokens(
  job: Pick<BytePlusPendingJob, 'engine_id' | 'duration_sec' | 'settings_snapshot'>
): number {
  const profile = requireBytePlusSeedanceProfile(job.engine_id);
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const core = isRecord(settings.core) ? settings.core : {};
  const requestedResolution = typeof core.resolution === 'string' ? core.resolution : null;
  const requestedAspectRatio = typeof core.aspectRatio === 'string' ? core.aspectRatio : null;
  const resolution = profile.resolutions.includes(requestedResolution as never)
    ? requestedResolution!
    : profile.resolutions.includes('720p')
      ? '720p'
      : profile.resolutions[0];
  const aspectRatio = profile.aspectRatios.includes(requestedAspectRatio as never)
    ? requestedAspectRatio!
    : profile.aspectRatios.includes('16:9')
      ? '16:9'
      : profile.aspectRatios[0];
  const dimensions =
    resolution && aspectRatio
      ? seedanceOutputDimensions(job.engine_id, resolution, aspectRatio)
      : undefined;
  if (!dimensions) {
    throw new BytePlusModelArkError(
      'BytePlus accounting dimensions are not configured for this profile.',
      { status: 500, code: 'BYTEPLUS_ACCOUNTING_DIMENSIONS_MISSING' }
    );
  }
  return (
    dimensions.width *
    dimensions.height *
    Math.max(1, Math.round(job.duration_sec)) *
    profile.framesPerSecond
  ) / 1024;
}

export function getBytePlusAccounting(job: Pick<BytePlusPendingJob, 'settings_snapshot' | 'has_audio'>) {
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const refs = isRecord(settings.refs) ? settings.refs : {};
  const mode =
    settings.inputMode === 'extend'
      ? 'extend'
      : settings.inputMode === 'v2v'
        ? 'v2v'
        : settings.inputMode === 'ref2v'
          ? 'ref2v'
          : settings.inputMode === 'i2v'
            ? 'i2v'
            : 't2v';
  const hasStartImage = mode === 'i2v' && typeof refs.imageUrl === 'string' && refs.imageUrl.trim().length > 0;
  const hasEndImage = mode === 'i2v' && typeof refs.endImageUrl === 'string' && refs.endImageUrl.trim().length > 0;
  const hasReferenceImages = Array.isArray(refs.referenceImages) && refs.referenceImages.length > 0;
  const hasReferenceVideos = Array.isArray(refs.videoUrls) && refs.videoUrls.length > 0;
  const hasReferenceAudio = typeof refs.audioUrl === 'string' || (Array.isArray(refs.audioUrls) && refs.audioUrls.length > 0);
  const inputType =
    mode === 'extend'
      ? 'video_extension'
      : mode === 'v2v'
        ? 'video_edit'
        : mode === 'ref2v'
          ? 'reference_generation'
          : hasEndImage
            ? 'first_last_frame'
            : hasStartImage
              ? 'image_input'
              : 'text_input';

  return {
    mode,
    inputType,
    hasStartImage,
    hasEndImage,
    hasReferenceImages,
    hasReferenceVideos,
    hasReferenceAudio,
    generateAudio: job.has_audio === true,
    byteplusBillingInputType: hasReferenceVideos || mode === 'v2v' || mode === 'extend' ? 'video_input' : 'no_video_input',
  };
}

export function getBytePlusUnitPriceUsdPer1kTokens(
  engineId: string | null | undefined,
  billingInputType?: string | null,
  resolution?: string | null,
  generateAudio = true,
): number {
  const profile = requireBytePlusSeedanceProfile(engineId);
  const selectedResolution = resolution ?? (profile.resolutions.includes('720p') ? '720p' : profile.resolutions[0]);
  if (!selectedResolution) throw new Error(`BytePlus resolution missing for ${engineId}`);
  return getBytePlusVideoListRate({
    profile: profile.pricingProfileKey,
    resolution: selectedResolution,
    billingInputType: billingInputType === 'video_input' ? 'video_input' : 'no_video_input',
    generateAudio,
  }).unitPriceUsdPer1kTokens;
}

export function estimateBytePlusProviderCostCents(input: {
  engineId: string;
  durationSec: number;
  resolution: string;
  aspectRatio: string;
  billingInputType: 'video_input' | 'no_video_input';
  generateAudio?: boolean;
  inputVideoDurationSec?: number;
}): number {
  if (!Number.isSafeInteger(input.durationSec) || input.durationSec < 1) {
    throw new Error('Invalid BytePlus provider-cost duration.');
  }
  const estimate = estimateBytePlusBillableTokens(input);
  if (!estimate) throw new Error('Invalid BytePlus provider-cost dimensions.');
  const totalTokens = estimate.tokenCount;
  const unitPriceUsdPer1kTokens = getBytePlusUnitPriceUsdPer1kTokens(
    input.engineId,
    input.billingInputType,
    input.resolution,
    input.generateAudio,
  );
  const costCents = Math.ceil(
    ((totalTokens * unitPriceUsdPer1kTokens) / 1000) * 100 - Number.EPSILON,
  );
  if (!Number.isSafeInteger(costCents) || costCents < 1) {
    throw new Error('Invalid BytePlus provider-cost estimate.');
  }
  return costCents;
}

export function buildBytePlusListCostBreakdown(input: {
  job: BytePlusPendingJob;
  model: string;
  resolution: string;
  aspectRatio: string;
  usage: { totalTokens: number | null; completionTokens: number | null } | null;
  providerTask?: unknown;
}) {
  const { job, usage } = input;
  const accounting = getBytePlusAccounting(job);
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  if (resolveBytePlusPollTransport({ providerJobId: job.provider_job_id, settingsSnapshot: settings }) === 'las') {
    const task = isRecord(input.providerTask) ? input.providerTask : {};
    const reported = isRecord(task.data) ? task.data : isRecord(task.task) ? task.task : task;
    const hasReportedDuration = Object.hasOwn(reported, 'duration');
    const outputDurationSec = hasReportedDuration
      ? typeof reported.duration === 'number' ? reported.duration : NaN : job.duration_sec;
    const resolution = Object.hasOwn(reported, 'resolution')
      ? typeof reported.resolution === 'string' ? reported.resolution : '' : input.resolution;
    const list = job.engine_id === 'seedance-2-5' ? quoteSeedance25LasListCost({ resolution, outputDurationSec,
      inputVideoDurationSec: typeof settings.byteplusInputVideoDurationSec === 'number'
        ? settings.byteplusInputVideoDurationSec : undefined }) : null;
    return {
      provider: BYTEPLUS_MODELARK_PROVIDER, byteplus_transport: 'las',
      provider_cost_source: 'byteplus_las_published_list_rate',
      provider_cost_status: !list ? 'list_estimate_unavailable' : hasReportedDuration
        ? 'list_estimate_from_provider_duration' : 'list_estimate_from_requested_duration',
      provider_cost_unavailable_reason: list ? null : 'las_billing_duration_or_resolution_unavailable',
      provider_list_rate_source: BYTEPLUS_LAS_LIST_PRICE_SOURCE.url,
      model: input.model, mode: accounting.mode, input_type: accounting.inputType,
      byteplus_billing_input_type: 'video_input', generate_audio: accounting.generateAudio,
      has_start_image: accounting.hasStartImage, has_end_image: accounting.hasEndImage,
      has_reference_images: accounting.hasReferenceImages, has_reference_videos: accounting.hasReferenceVideos,
      has_reference_audio: accounting.hasReferenceAudio, resolution, aspect_ratio: input.aspectRatio,
      duration_sec: outputDurationSec, input_video_duration_sec: list?.inputVideoDurationSec ?? null,
      billable_duration_sec: list?.billableDurationSec ?? null,
      provider_tokens: usage?.totalTokens ?? usage?.completionTokens ?? null,
      total_tokens: usage?.totalTokens ?? usage?.completionTokens ?? null, completion_tokens: usage?.completionTokens ?? null,
      unit_price_usd_per_1k_tokens: null, unit_price_usd_per_second: list?.unitPriceUsdPerSecond ?? null,
      enhanced_unit_price_usd_per_second: list?.enhancedUnitPriceUsdPerSecond ?? null, billing_coefficient: list?.coefficient ?? null,
      provider_cost_usd_list: list?.amountUsd ?? null, provider_cost_usd_effective: null, provider_cost_usd_observed: null,
    };
  }
  const estimate = estimateBytePlusBillableTokens({ engineId: job.engine_id, durationSec: job.duration_sec,
    resolution: input.resolution, aspectRatio: input.aspectRatio,
    billingInputType: accounting.byteplusBillingInputType as 'video_input' | 'no_video_input',
    inputVideoDurationSec: typeof settings.byteplusInputVideoDurationSec === 'number'
      ? settings.byteplusInputVideoDurationSec : undefined });
  const reportedTokens = usage?.totalTokens ?? usage?.completionTokens;
  const totalTokens = reportedTokens ?? estimate?.tokenCount ?? null;
  const unitPriceUsdPer1kTokens = getBytePlusUnitPriceUsdPer1kTokens(
    job.engine_id, accounting.byteplusBillingInputType, input.resolution, accounting.generateAudio,
  );
  const providerCostUsd = totalTokens == null ? null : Number(((totalTokens * unitPriceUsdPer1kTokens) / 1000).toFixed(6));
  return {
    provider: BYTEPLUS_MODELARK_PROVIDER,
    provider_cost_source: 'byteplus_published_list_rate',
    provider_cost_status: reportedTokens != null ? 'list_estimate_from_provider_usage'
      : totalTokens == null ? 'list_estimate_unavailable' : 'list_estimate_from_dimensions',
    provider_cost_unavailable_reason: totalTokens == null ? 'input_video_duration_unavailable' : null,
    provider_list_rate_source: BYTEPLUS_MODELARK_LIST_PRICE_SOURCE.url,
    model: input.model,
    mode: accounting.mode,
    input_type: accounting.inputType,
    byteplus_billing_input_type: accounting.byteplusBillingInputType,
    generate_audio: accounting.generateAudio,
    has_start_image: accounting.hasStartImage,
    has_end_image: accounting.hasEndImage,
    has_reference_images: accounting.hasReferenceImages,
    has_reference_videos: accounting.hasReferenceVideos,
    has_reference_audio: accounting.hasReferenceAudio,
    resolution: input.resolution,
    aspect_ratio: input.aspectRatio,
    duration_sec: job.duration_sec,
    provider_tokens: totalTokens,
    total_tokens: totalTokens,
    completion_tokens: usage?.completionTokens ?? null,
    unit_price_usd_per_1k_tokens: unitPriceUsdPer1kTokens,
    provider_cost_usd_list: providerCostUsd,
    provider_cost_usd_effective: null,
    provider_cost_usd_observed: null,
  };
}
