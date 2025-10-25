import { query } from '@/lib/db';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { updateJobFromFalWebhook } from '@/server/fal-webhook-handler';
import { ensureJobThumbnail } from '@/server/thumbnails';

type LinkableJobRow = {
  job_id: string;
  engine_id: string | null;
  provider_job_id: string | null;
  user_id: string | null;
  aspect_ratio: string | null;
  thumb_url: string | null;
};

type LinkFalJobResult = {
  jobId: string;
  providerJobId: string;
  engineId: string | null;
  videoUrl: string | null;
  thumbUrl: string | null;
};

function cloneResult<T>(result: T): T {
  return result && typeof result === 'object' ? JSON.parse(JSON.stringify(result)) : (result as T);
}

export async function linkFalJob(options: {
  jobId: string;
  providerJobId?: string | null;
}): Promise<LinkFalJobResult> {
  const jobId = options.jobId?.trim();
  if (!jobId) {
    throw new Error('A jobId is required.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const rows = await query<LinkableJobRow>(
    `SELECT job_id, engine_id, provider_job_id, user_id, aspect_ratio, thumb_url
       FROM app_jobs
      WHERE job_id = $1
      LIMIT 1`,
    [jobId]
  );
  const job = rows[0];
  if (!job) {
    throw new Error(`Job ${jobId} not found.`);
  }

  const providerJobId = options.providerJobId?.trim() || job.provider_job_id?.trim();
  if (!providerJobId) {
    throw new Error(`Job ${jobId} has no provider_job_id.`);
  }

  const engineId = job.engine_id ?? 'fal-unknown';
  const falModelId = (await resolveFalModelId(engineId)) ?? engineId;
  const falClient = getFalClient();

  const result = await falClient.queue
    .result(falModelId, { requestId: providerJobId })
    .catch((error: unknown) => {
      throw new Error(`Fal result lookup failed: ${(error as Error)?.message ?? error}`);
    });

  if (!result) {
    throw new Error(`Fal returned no result for ${providerJobId}.`);
  }

  const normalized = cloneResult(result) as Record<string, any>;
  if (!normalized.data && normalized.video) {
    normalized.data = { video: normalized.video };
  }

  const videoUrl: string | undefined =
    normalized?.data?.video?.url ??
    normalized?.data?.video_url ??
    normalized?.video?.url ??
    normalized?.video_url ??
    undefined;

  const hasThumb =
    Boolean(normalized?.data?.thumbnail) ||
    Boolean(normalized?.data?.thumb_url) ||
    Boolean(normalized?.thumbnail) ||
    Boolean(normalized?.thumb_url);

  if (!hasThumb && videoUrl) {
    const generatedThumb = await ensureJobThumbnail({
      jobId: job.job_id,
      userId: job.user_id ?? undefined,
      videoUrl,
      aspectRatio: job.aspect_ratio ?? undefined,
      existingThumbUrl: job.thumb_url ?? undefined,
    });
    if (generatedThumb) {
      normalized.data = normalized.data ?? {};
      normalized.data.thumbnail = generatedThumb;
      normalized.data.thumb_url = generatedThumb;
      normalized.thumbnail = generatedThumb;
      normalized.thumb_url = generatedThumb;
    }
  }

  await updateJobFromFalWebhook({
    request_id: providerJobId,
    status: 'completed',
    job_id: job.job_id,
    result: normalized as unknown,
  });

  return {
    jobId: job.job_id,
    providerJobId,
    engineId: job.engine_id,
    videoUrl: videoUrl ?? null,
    thumbUrl:
      (normalized?.data?.thumbnail as string | undefined) ??
      (normalized?.data?.thumb_url as string | undefined) ??
      (normalized?.thumbnail as string | undefined) ??
      (normalized?.thumb_url as string | undefined) ??
      null,
  };
}
