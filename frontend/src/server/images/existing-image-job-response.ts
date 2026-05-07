import type {
  GeneratedImage,
  ImageGenerationMode,
  ImageGenerationResponse,
} from '@/types/image-generation';
import type { PricingSnapshot } from '@/types/engines';
import { normalizeMediaUrl } from '@/lib/media';
import { parseStoredImageRenders } from '@/lib/image-renders';

export type ExistingImageJobRow = {
  job_id: string;
  user_id: string | null;
  status: string;
  progress: number;
  provider_job_id: string | null;
  thumb_url: string | null;
  aspect_ratio: string | null;
  pricing_snapshot: PricingSnapshot | null;
  currency: string | null;
  payment_status: string | null;
  engine_id: string;
  engine_label: string;
  render_ids: unknown;
  hero_render_id: string | null;
  message: string | null;
  settings_snapshot: unknown;
};

export function parseResolutionFromSettingsSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const core = (snapshot as Record<string, unknown>).core;
  if (!core || typeof core !== 'object' || Array.isArray(core)) return null;
  const resolution = (core as Record<string, unknown>).resolution;
  return typeof resolution === 'string' && resolution.trim().length ? resolution : null;
}

function buildImagesFromExistingJob(job: ExistingImageJobRow): GeneratedImage[] {
  const parsed = parseStoredImageRenders(job.render_ids);
  if (parsed.entries.length) {
    return parsed.entries.map((entry) => ({
      url: entry.url,
      thumbUrl: entry.thumbUrl ?? entry.url,
      width: entry.width ?? null,
      height: entry.height ?? null,
      mimeType: entry.mimeType ?? null,
    }));
  }

  const heroUrl = job.hero_render_id ? normalizeMediaUrl(job.hero_render_id) ?? job.hero_render_id : null;
  const thumbUrl = job.thumb_url ? normalizeMediaUrl(job.thumb_url) ?? job.thumb_url : null;
  if (!heroUrl) return [];

  return [
    {
      url: heroUrl,
      thumbUrl: thumbUrl ?? heroUrl,
    },
  ];
}

export function buildResponseFromExistingJob(args: {
  job: ExistingImageJobRow;
  mode: ImageGenerationMode;
  engineId: string;
  engineLabel: string;
  pricing: PricingSnapshot;
  resolvedAspectRatio: string | null;
  resolution: string;
}): ImageGenerationResponse {
  const images = buildImagesFromExistingJob(args.job);
  const thumbUrl = args.job.thumb_url ? normalizeMediaUrl(args.job.thumb_url) ?? args.job.thumb_url : null;
  const pricing = args.job.pricing_snapshot ?? args.pricing;

  return {
    ok: true,
    mode: args.mode,
    images,
    description: args.job.message ?? null,
    jobId: args.job.job_id,
    requestId: args.job.provider_job_id ?? undefined,
    providerJobId: args.job.provider_job_id ?? undefined,
    engineId: args.job.engine_id || args.engineId,
    engineLabel: args.job.engine_label || args.engineLabel,
    pricing,
    paymentStatus: args.job.payment_status ?? 'paid_wallet',
    thumbUrl,
    aspectRatio: args.job.aspect_ratio ?? args.resolvedAspectRatio,
    resolution: parseResolutionFromSettingsSnapshot(args.job.settings_snapshot) ?? args.resolution,
  };
}
