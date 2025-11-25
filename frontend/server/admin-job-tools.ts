import { query } from '@/lib/db';
import { updateJobFromFalWebhook } from '@/server/fal-webhook-handler';
import { fetchFalJobMedia } from '@/server/fal-job-sync';

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
  userId: string | null;
  videoUrl: string | null;
  thumbUrl: string | null;
};

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

  const { normalizedResult, videoUrl, thumbUrl } = await fetchFalJobMedia({
    jobId: job.job_id,
    engineId: job.engine_id,
    providerJobId,
    userId: job.user_id,
    aspectRatio: job.aspect_ratio,
    existingThumbUrl: job.thumb_url,
  });

  if (!normalizedResult || !videoUrl) {
    throw new Error('Fal result did not include a playable video.');
  }

  await updateJobFromFalWebhook({
    request_id: providerJobId,
    status: 'completed',
    job_id: job.job_id,
    result: normalizedResult as unknown,
  });

  return {
    jobId: job.job_id,
    providerJobId,
    engineId: job.engine_id,
    userId: job.user_id,
    videoUrl,
    thumbUrl,
  };
}
