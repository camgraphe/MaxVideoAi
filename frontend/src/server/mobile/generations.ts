import {
  readOwnedGenerationRecord,
  readGenerationSeedanceWorkflow,
  mapGenerationStatusRecordToAgent,
  type GenerationStatusRecord,
} from '@/server/generations/generation-status';
import {
  completedGenerationCandidatePages,
  readRecentAgentGenerationRecords,
  formatRecentGenerationCursor,
} from '@/server/generations/recent-generations';
import { buildOwnedGenerationMediaAccess, GenerationMediaOwnershipError } from '@/server/generations/generation-media-access';
import { buildAgentGenerationRecovery } from '@/server/agent-api/generation-status';
import { applyOutputsToJobPayload, listJobOutputsByJobIds } from '@/server/media-library/job-outputs';
import { COMPLETED_GENERATION_STATUSES } from '@/server/generations/agent-generation-policy';
import { isStablePublicMediaUrl } from '@/lib/media';
import { parseStoredImageRenders } from '@/lib/image-renders';
import { MobileHttpError } from './errors';
import type { GenerationJob, Surface } from '@/lib/mobile-generation-contract';

async function mobileJob(record: GenerationStatusRecord, expectedSurface?: Surface, history = false): Promise<GenerationJob | null> {
  if (!record.user_id) return null;
  const status = mapGenerationStatusRecordToAgent(record);
  if (!status || (expectedSurface && status.surface !== expectedSurface)) return null;
  // An unavailable file can hide its own preview, but must not take down the owner's history.
  const accessible = await buildOwnedGenerationMediaAccess(record.user_id, status).catch(error => {
    if (history && error instanceof GenerationMediaOwnershipError) return { ...status, result: null };
    throw error;
  });
  const job = buildAgentGenerationRecovery(accessible!);
  const media = job.result;
  const url =
    media?.surface === 'video'
      ? media.videoUrl
      : media?.surface === 'image'
        ? media.imageUrls[0]
        : media?.videoUrl ?? media?.audioUrl;
  const shareSource = accessible?.result && status.result && status.result.surface !== 'image' ? status.result.videoUrl : null;
  return {
    jobId: job.jobId,
    ...(shareSource && isStablePublicMediaUrl(shareSource) ? { shareSourceUrl: shareSource } : {}),
    ...(status.seedanceWorkflow ? { seedanceWorkflow: status.seedanceWorkflow } : {}),
    surface: job.surface,
    ...(media?.surface === 'audio' && media.videoUrl ? { mediaKind: 'video' as const, audioUrl: media.audioUrl } : {}),
    status: job.status,
    progress: job.progress,
    message: job.message,
    engineLabel: record.engine_label,
    engineId: record.engine_id,
    prompt: record.prompt,
    createdAt: new Date(record.created_at).toISOString(),
    url: url ?? null,
    playbackUrl: (media?.surface === 'video' ? media.playbackVideoUrl : null) ?? url ?? null,
    thumbnailUrl:
      (media?.surface === 'image' ? (media.thumbnailUrls[0] ?? url) : media?.thumbnailUrl) ?? null,
    retryAfterSeconds: job.retry?.afterSeconds ?? null,
  };
}

export async function readMobileJob(userId: string, jobId: string, options: { includeOutputs?: boolean } = {}) {
  let record = await readOwnedGenerationRecord({ userId, jobId });
  const status = record?.status?.trim().toLowerCase();
  if (options.includeOutputs && record && COMPLETED_GENERATION_STATUSES.some(value => value === status)) {
    [record] = await projectMobileJobOutputs(userId, [record]);
  }
  const job = record && (await mobileJob(record));
  if (!job) throw new MobileHttpError('JOB_NOT_FOUND', 404, 'Generation not found.');
  if (job.seedanceWorkflow && options.includeOutputs)
    job.seedanceWorkflow = await readGenerationSeedanceWorkflow(userId, job.seedanceWorkflow);
  return job;
}

async function projectMobileJobOutputs(userId: string, records: GenerationStatusRecord[]) {
  const outputs = await listJobOutputsByJobIds(records.map(record => record.job_id), { userId, ensureSchema: false });
  return records.map(record => {
    const stored = outputs.get(record.job_id);
    if (!stored?.length) return record;
    const media = applyOutputsToJobPayload({
      jobId: record.job_id,
      videoUrl: record.video_url,
      audioUrl: record.audio_url,
      previewVideoUrl: record.preview_video_url,
      thumbUrl: record.thumb_url,
      previewFrame: record.preview_frame,
      imageRenders: parseStoredImageRenders(record.render_ids).entries,
    }, stored);
    return {
      ...record,
      video_url: media.videoUrl, preview_video_url: media.previewVideoUrl, audio_url: media.audioUrl,
      thumb_url: media.thumbUrl, preview_frame: media.previewFrame, render_ids: media.imageRenders,
    };
  });
}

export async function readLatestMobileResult(userId: string, surface: string | null): Promise<GenerationJob | null> {
  if (surface !== 'image' && surface !== 'video') {
    throw new MobileHttpError('INVALID_SURFACE', 400, 'Choose image or video.');
  }
  for await (const page of completedGenerationCandidatePages(userId, surface)) {
    for (const record of await projectMobileJobOutputs(userId, page)) {
      try {
        const job = await mobileJob(record, surface);
        if (job?.status === 'completed' && job.url) return job;
      } catch (error) {
        if (!(error instanceof GenerationMediaOwnershipError)) throw error;
      }
    }
  }
  return null;
}

export async function listMobileJobs(userId: string, cursor: string | null, surface: string | null = null) {
  if (surface !== null && surface !== 'image' && surface !== 'audio' && surface !== 'video')
    throw new MobileHttpError('INVALID_SURFACE', 400, 'Invalid media filter.');
  const limit = 20;
  const rows = await readRecentAgentGenerationRecords({
    userId,
    cursor,
    status: null,
    preciseCursor: true,
    surface,
    limit,
  });
  const page = rows.slice(0, limit);
  const records = await projectMobileJobOutputs(userId, page);
  const jobs = await Promise.all(records.map((record) => mobileJob(record, undefined, true)));
  return {
    items: jobs.filter((job): job is GenerationJob => job !== null),
    nextCursor: rows.length > limit ? formatRecentGenerationCursor(page[page.length - 1]) : null,
  };
}
