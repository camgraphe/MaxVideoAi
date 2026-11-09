import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { uploadImageToStorage } from '@/server/storage';
import { createImageThumbnailBatch, prepareImageRenditions } from '@/server/image-thumbnails';
import type { GeneratedImage } from '@/types/image-generation';
import { persistCompletedImageGeneration } from './image-generation-completion';
import type { OpenAIImageResultRow } from './openai-image-result-store';

export type OpenAIImageRecoveryDependencies = {
  queryFn?: typeof query;
  uploadFn?: (params: Parameters<typeof uploadImageToStorage>[0]) => Promise<{ url: string; width?: number | null; height?: number | null; mime: string }>;
  thumbnailsFn?: typeof createImageThumbnailBatch;
  renditionsFn?: typeof prepareImageRenditions;
  completeFn?: (params: Parameters<typeof persistCompletedImageGeneration>[0]) => Promise<{ heroThumb: string | null }>;
};

/** Storage/completion only. No live model admission, quote, debit or provider client. */
export async function recoverOpenAIImageResult(jobId: string, userId: string, deps: OpenAIImageRecoveryDependencies = {}): Promise<{ images: GeneratedImage[]; heroThumb: string | null } | null> {
  const execute = deps.queryFn ?? query;
  const lease = randomUUID();
  const [receipt] = await execute<OpenAIImageResultRow>(`UPDATE app_openai_image_results r
    SET lease_token=$3, lease_expires_at=NOW()+INTERVAL '10 minutes', updated_at=NOW()
    WHERE r.job_id=$1 AND r.user_id=$2 AND r.state='received'
      AND (r.lease_expires_at IS NULL OR r.lease_expires_at<NOW())
      AND EXISTS(SELECT 1 FROM app_jobs j WHERE j.job_id=r.job_id AND j.user_id=r.user_id
        AND j.status NOT IN ('completed','failed') AND j.payment_status='paid_wallet')
    RETURNING r.job_id,r.user_id,r.provider_request_id,r.completion_context,r.images,r.response_complete,r.stored_images`, [jobId, userId, lease]);
  if (!receipt) return null;
  const stored = [...receipt.stored_images];
  const checkpoint = async () => {
    const rows = await execute(`UPDATE app_openai_image_results SET stored_images=$4::jsonb,
      lease_expires_at=NOW()+INTERVAL '10 minutes',updated_at=NOW()
      WHERE job_id=$1 AND user_id=$2 AND lease_token=$3 RETURNING job_id`, [jobId, userId, lease, JSON.stringify(stored)]);
    if (!rows.length) throw new Error('OpenAI output recovery lease was lost');
  };
  try {
    for (const original of receipt.images) {
      if (stored.some(entry => entry.index === original.index)) continue;
      const upload = await (deps.uploadFn ?? uploadImageToStorage)({ data: Buffer.from(original.base64, 'base64'), mime: original.mimeType,
        userId, prefix: 'renders/images', fileName: `${jobId}-${original.index + 1}.${original.mimeType === 'image/jpeg' ? 'jpg' : original.mimeType.split('/')[1]}` });
      stored.push({ index: original.index, image: { url: normalizeMediaUrl(upload.url) ?? upload.url, width: upload.width, height: upload.height, mimeType: upload.mime } });
      await checkpoint();
    }
    if (!receipt.response_complete || stored.length !== receipt.completion_context.numImages) {
      // One statement makes the private receipt and public job agree. Reuse the
      // established manual-review state; keep paid facts and partial originals.
      await execute(`WITH review AS (
        UPDATE app_openai_image_results SET state='needs_review',lease_token=NULL,lease_expires_at=NULL,updated_at=NOW()
        WHERE job_id=$1 AND user_id=$2 AND lease_token=$3 RETURNING job_id
      ) UPDATE app_jobs SET status='provider_polling_stalled',provider='openai_images_direct',
        provider_job_id=COALESCE($4,provider_job_id),message=$5,updated_at=NOW()
        WHERE job_id IN (SELECT job_id FROM review) AND user_id=$2
          AND payment_status='paid_wallet' AND status NOT IN ('completed','failed')`, [jobId, userId, lease, receipt.provider_request_id,
        `This image batch needs manual review (${stored.length} validated, ${receipt.completion_context.numImages} requested). The received originals are preserved. Contact MaxVideoAI support with this job ID; do not submit it again.`]);
      return null;
    }
    const ordered = stored.sort((a, b) => a.index - b.index).map(entry => entry.image);
    const prepare = deps.renditionsFn ?? (deps.thumbnailsFn ? undefined : prepareImageRenditions);
    if (prepare) {
      for (const entry of stored) {
        if (entry.image.imageDisplay) continue;
        const original = receipt.images.find(image => image.index === entry.index);
        if (!original) continue;
        const facts = await prepare({ data: Buffer.from(original.base64, 'base64'), imageUrl: entry.image.url,
          jobId, userId, index: entry.index, ...(entry.image.thumbUrl ? { thumbUrl: entry.image.thumbUrl } : {}) }).catch(() => ({}));
        Object.assign(entry.image, facts);
        await checkpoint();
      }
    }
    const thumbs = prepare ? ordered.map(image => image.thumbUrl ?? null)
      : await (deps.thumbnailsFn ?? createImageThumbnailBatch)({ jobId, userId, imageUrls: ordered.map(image => image.url) });
    await checkpoint();
    const images = ordered.map((image, index) => ({ ...image, thumbUrl: thumbs[index] ?? null }));
    const { heroThumb } = await (deps.completeFn ?? persistCompletedImageGeneration)({ ...receipt.completion_context, images, openAIRecoveryLease: lease });
    // Only the shared completion owner publishes render_ids. Clearing private
    // bytes is cleanup: a failed cleanup cannot regress an already completed job.
    await execute(`UPDATE app_openai_image_results SET state='completed',images='[]'::jsonb,
      lease_token=NULL,lease_expires_at=NULL,updated_at=NOW() WHERE job_id=$1 AND user_id=$2 AND lease_token=$3`, [jobId, userId, lease])
      .catch(() => console.warn('[images] OpenAI receipt cleanup deferred', { jobId }));
    return { images, heroThumb };
  } catch (error) {
    await execute(`UPDATE app_openai_image_results SET lease_token=NULL,lease_expires_at=NULL,updated_at=NOW()
      WHERE job_id=$1 AND user_id=$2 AND lease_token=$3`, [jobId, userId, lease]).catch(() => undefined);
    throw error;
  }
}

export async function runOpenAIImageOutputRecovery(deps: OpenAIImageRecoveryDependencies = {}): Promise<{ recovered: number; deferred: number }> {
  const execute = deps.queryFn ?? query;
  // Complete a cleanup interrupted after the job became durable and terminal.
  await execute(`UPDATE app_openai_image_results r SET state='completed',images='[]'::jsonb,lease_token=NULL,lease_expires_at=NULL,updated_at=NOW()
    FROM app_jobs j WHERE r.job_id=j.job_id AND r.user_id=j.user_id AND j.status='completed' AND r.state='received'`);
  const candidates = await execute<{ job_id: string; user_id: string }>(`SELECT r.job_id,r.user_id
    FROM app_openai_image_results r JOIN app_jobs j ON j.job_id=r.job_id AND j.user_id=r.user_id
    WHERE r.state='received' AND (r.lease_expires_at IS NULL OR r.lease_expires_at<NOW())
      AND j.status NOT IN ('completed','failed') AND j.payment_status='paid_wallet'
    ORDER BY r.updated_at LIMIT 5`);
  let recovered = 0, deferred = 0;
  for (const row of candidates) {
    try { if (await recoverOpenAIImageResult(row.job_id, row.user_id, deps)) recovered++; else deferred++; }
    catch { deferred++; console.warn('[images] OpenAI output recovery deferred', { jobId: row.job_id }); }
  }
  return { recovered, deferred };
}
