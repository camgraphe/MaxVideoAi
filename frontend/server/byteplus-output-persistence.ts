import type { LegacyJobMediaRow } from './media-library-records';
import type { BytePlusPendingJob } from './byteplus-poll-types';
import { isRecord } from './byteplus-record-utils';
import type { upsertLegacyJobOutputs } from './media-library';
import { readGeneratedVideoFacts } from '@/lib/generated-video-media-facts';
import { readReturnedVideoLastFrame, type ReturnedVideoLastFrame } from '@/lib/generated-video-output-artifacts';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
const ACTIVE = ['pending', 'queued', 'running', 'processing', 'in_progress', 'provider_polling_stalled'];

export function bytePlusCompletedOutputRow(job: BytePlusPendingJob, videoUrl: string, thumbUrl: string, videoMediaFacts?: unknown): LegacyJobMediaRow {
  const artifacts = getBytePlusLasDurableOutput(job);
  return { job_id: job.job_id, user_id: job.user_id, surface: 'video', video_url: videoUrl,
    ...(artifacts?.lastFrame ? { last_frame: artifacts.lastFrame } : {}),
    ...(artifacts?.playbackVideoUrl ? { playback_video_url: artifacts.playbackVideoUrl } : {}),
    video_media_facts: readGeneratedVideoFacts(videoMediaFacts ?? getBytePlusLasDurableOutput(job)?.videoMediaFacts, videoUrl),
    audio_url: null, thumb_url: thumbUrl, preview_frame: thumbUrl, preview_video_url: job.preview_video_url,
    render_ids: null, duration_sec: bytePlusOutputDurationSec(job, videoUrl, videoMediaFacts),
    inherited_output_duration_sec: bytePlusInheritedOutputDurationSec(job), status: 'completed' };
}

function bytePlusInheritedOutputDurationSec(job: BytePlusPendingJob) {
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const source = isRecord(settings.seedanceEditSource) ? settings.seedanceEditSource : {};
  return job.engine_id === 'seedance-2-5' && settings.byteplusTransport === 'modelark' && settings.inputMode === 'v2v'
    && typeof source.durationSec === 'number' && Number.isFinite(source.durationSec) && source.durationSec >= 4 && source.durationSec <= 30
    ? source.durationSec : undefined;
}

export function bytePlusOutputDurationSec(job: BytePlusPendingJob, videoUrl = job.video_url ?? '', videoMediaFacts?: unknown) {
  return readGeneratedVideoFacts(videoMediaFacts ?? getBytePlusLasDurableOutput(job)?.videoMediaFacts, videoUrl)?.durationSec
    ?? bytePlusInheritedOutputDurationSec(job) ?? job.duration_sec;
}

export function getBytePlusLasDurableOutput(job: BytePlusPendingJob) {
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const output = isRecord(settings.byteplusDurableOutput) ? settings.byteplusDurableOutput : {};
  if (!requiresBytePlusDurableEditOutput(job)
    || output.providerJobId !== job.provider_job_id || output.videoUrl !== job.video_url
    || typeof output.videoUrl !== 'string' || !output.videoUrl
    || typeof output.thumbUrl !== 'string' || !isRecord(output.costBreakdown)) return null;
  const videoMediaFacts = readGeneratedVideoFacts(output.videoMediaFacts, output.videoUrl);
  const lastFrame = readReturnedVideoLastFrame(output.lastFrame);
  return { videoUrl: output.videoUrl, thumbUrl: output.thumbUrl, costBreakdown: output.costBreakdown,
    ...(lastFrame ? { lastFrame } : {}),
    ...(typeof output.playbackVideoUrl === 'string' && /^https:\/\//i.test(output.playbackVideoUrl) ? { playbackVideoUrl: output.playbackVideoUrl } : {}),
    ...(videoMediaFacts ? { videoMediaFacts } : {}) };
}

export function bytePlusRequestedOutputOptions(job: BytePlusPendingJob) {
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const advanced = isRecord(settings.advanced) ? settings.advanced : {};
  const extra = isRecord(advanced.extraInputValues) ? advanced.extraInputValues : {};
  const core = isRecord(settings.core) ? settings.core : {};
  const requiresCompatiblePlayback = job.engine_id === 'seedance-2-5'
    && (extra.output_format === 'mov' || core.resolution === '1080p');
  return { outputFormat: job.engine_id === 'seedance-2-5' && extra.output_format === 'mov' ? 'mov' as const : 'mp4' as const,
    requiresCompatiblePlayback,
    returnLastFrame: /^seedance-/.test(job.engine_id) && extra.return_last_frame === true };
}

/** Recorded execution facts, rather than current flags, own recovery of accepted Edit jobs. */
export function requiresBytePlusDurableEditOutput(job: BytePlusPendingJob) {
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const options = bytePlusRequestedOutputOptions(job);
  if (options.requiresCompatiblePlayback || options.returnLastFrame) return true;
  return job.engine_id === 'seedance-2-5' && (settings.byteplusTransport === 'las'
    || (settings.byteplusTransport === 'modelark' && settings.inputMode === 'v2v'));
}

/** Durable bytes and projections must exist before an Edit job becomes terminal. */
export async function persistBytePlusLasOutputBeforeCompletion(input: {
  job: BytePlusPendingJob; videoUrl: string; thumbUrl: string; costBreakdown: Record<string, unknown>;
  videoMediaFacts?: unknown;
  playbackVideoUrl?: string | null;
  lastFrame?: ReturnedVideoLastFrame | null;
  persistOutputs?: boolean;
  queryFn: QueryFn; upsertOutputsFn: typeof upsertLegacyJobOutputs;
}) {
  const videoMediaFacts = readGeneratedVideoFacts(input.videoMediaFacts ?? getBytePlusLasDurableOutput(input.job)?.videoMediaFacts, input.videoUrl);
  const previous = getBytePlusLasDurableOutput(input.job);
  const checkpoint = { providerJobId: input.job.provider_job_id, videoUrl: input.videoUrl,
    thumbUrl: input.thumbUrl, costBreakdown: input.costBreakdown,
    ...(videoMediaFacts ? { videoMediaFacts } : {}),
    ...((input.playbackVideoUrl ?? previous?.playbackVideoUrl) ? { playbackVideoUrl: input.playbackVideoUrl ?? previous?.playbackVideoUrl } : {}),
    ...((input.lastFrame ?? previous?.lastFrame) ? { lastFrame: input.lastFrame ?? previous?.lastFrame } : {}) };
  const rows = await input.queryFn<{ job_id: string }>(`UPDATE app_jobs SET status = 'processing',
      progress = GREATEST(progress,90), video_url = $3, thumb_url = $4, preview_frame = $4,
      cost_breakdown_usd = $5::jsonb,
      settings_snapshot = jsonb_set(COALESCE(settings_snapshot,'{}'::jsonb), '{byteplusDurableOutput}', $6::jsonb, true),
      message = 'Generated video is ready. Saving it to your library.', updated_at = now()
    WHERE job_id = $1 AND user_id IS NOT DISTINCT FROM $2 AND provider = 'byteplus_modelark'
      AND provider_job_id = $7 AND status = ANY($8::text[])
      AND (video_url IS NOT DISTINCT FROM $9 OR video_url IS NOT DISTINCT FROM $3) RETURNING job_id`,
  [input.job.job_id, input.job.user_id, input.videoUrl, input.thumbUrl, JSON.stringify(input.costBreakdown),
    JSON.stringify(checkpoint), input.job.provider_job_id, ACTIVE, input.job.video_url ?? null]);
  if (rows.length !== 1) return false;
  input.job.video_url = input.videoUrl;
  input.job.settings_snapshot = { ...(isRecord(input.job.settings_snapshot) ? input.job.settings_snapshot : {}), byteplusDurableOutput: checkpoint };
  if (input.persistOutputs === false) return true;
  // The original confirmation may lose its quote-state acknowledgement after provider acceptance.
  // Bind repair to the same owned paid job and immutable quote, without another debit or POST.
  await input.queryFn(`UPDATE mcp_generation_quotes q SET state = 'accepted', updated_at = now()
    FROM app_jobs j WHERE j.job_id = $1 AND j.user_id IS NOT DISTINCT FROM $2
      AND j.provider = 'byteplus_modelark' AND j.provider_job_id = $3 AND j.status = 'processing'
      AND q.quote_id::text = j.job_id AND q.job_id = j.job_id AND q.user_id = j.user_id
      AND q.state = 'claimed' AND q.funding_mode = 'wallet'
      AND q.price_cents = j.final_price_cents AND UPPER(q.currency) = UPPER(j.currency)
      AND q.request_json->>'engineId' = j.engine_id AND q.request_json->>'mode' = j.settings_snapshot->>'inputMode'`,
  [input.job.job_id, input.job.user_id, input.job.provider_job_id]);
  await input.upsertOutputsFn(bytePlusCompletedOutputRow(input.job, input.videoUrl, input.thumbUrl, videoMediaFacts), { requireMcpPromotion: true });
  return true;
}
