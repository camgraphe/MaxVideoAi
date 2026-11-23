import { assertKlingImageV4OutputCount, isKlingImageV4EngineId } from '@/lib/image/kling-image-v4';
import { buildStoredImageRenderEntries, type StoredImageRenderEntry } from '@/lib/image-renders';
import { normalizeMediaUrl } from '@/lib/media';
import { prepareImageRenditions } from '@/server/image-thumbnails';
import { copyGeneratedImagesToStorage } from '@/src/server/images/image-output-storage';
import { extractImages } from '@/server/images/image-provider-payload';
import { extractImageUrlsFromPayload, normalizeRenderIdList, type FalWebhookPayload } from './fal-webhook-mapping';
import type { AppJobRow } from './fal-webhook-types';

type FalWebhookImageOutput = {
  urls: string[];
  hero: string | null;
  thumb: string | null;
  renders?: StoredImageRenderEntry[];
  incomplete: boolean;
};

export async function persistFalWebhookImageOutputs(params: {
  job: Pick<AppJobRow, 'job_id' | 'user_id' | 'settings_snapshot' | 'render_ids' | 'hero_render_id'>;
  engineId: string;
  status: string;
  payload: FalWebhookPayload;
  finalPayload: unknown;
}, copy = copyGeneratedImagesToStorage): Promise<FalWebhookImageOutput> {
  const { job, engineId, status, payload, finalPayload } = params;
  const readStorageParams = () => {
    if (!job.user_id) throw new Error('A MaxVideoAI owner is required for Fal webhook image outputs');
    return { jobId: job.job_id, userId: job.user_id, requireOwnedOutput: true };
  };

  if (isKlingImageV4EngineId(engineId)) {
    const empty = { urls: [], hero: null, thumb: null, incomplete: false };
    if (status !== 'completed') return empty;
    const snapshot = job.settings_snapshot as { outputCount?: number; core?: { numImages?: number } } | null;
    const expected = snapshot?.outputCount ?? snapshot?.core?.numImages ?? NaN;
    assertKlingImageV4OutputCount(expected);
    const envelope = finalPayload as { images?: unknown; data?: { images?: unknown } } | null;
    if (!Array.isArray(envelope?.images) && !Array.isArray(envelope?.data?.images)) {
      throw new Error('Kling Image result is not available for recovery yet.');
    }
    const images = extractImages(finalPayload);
    if (images.length !== expected) return { ...empty, incomplete: true };
    const stored = await copy({ ...readStorageParams(), images, prepare: prepareImageRenditions });
    return {
      urls: stored.map(image => image.url), hero: stored[0]?.url ?? null,
      thumb: stored[0]?.thumbUrl ?? null, renders: buildStoredImageRenderEntries(stored), incomplete: false,
    };
  }

  const imageUrlSet = new Set(normalizeRenderIdList(job.render_ids).filter(Boolean));
  const heroUrl = job.hero_render_id ? normalizeMediaUrl(job.hero_render_id) ?? job.hero_render_id : null;
  if (heroUrl) imageUrlSet.add(heroUrl);
  for (const source of [payload, payload.result, payload.response, payload.data, finalPayload]) {
    extractImageUrlsFromPayload(source).forEach(url => { if (url) imageUrlSet.add(url); });
  }
  const urls = Array.from(imageUrlSet);
  const heroIndex = heroUrl ? urls.indexOf(heroUrl) : -1;
  const stored = urls.length
    ? await copy({ ...readStorageParams(), images: urls.map(url => ({ url })) })
    : [];
  return { urls: stored.map(image => image.url), hero: stored[Math.max(0, heroIndex)]?.url ?? null, thumb: null, incomplete: false };
}
