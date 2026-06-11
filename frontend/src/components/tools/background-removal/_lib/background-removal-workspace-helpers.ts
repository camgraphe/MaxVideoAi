import { authFetch } from '@/lib/authFetch';
import {
  BACKGROUND_REMOVAL_OUTPUT_CODECS,
  BACKGROUND_REMOVAL_STUDIO_COLORS,
} from '@/lib/tools-background-removal';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalStudioBackgroundColor,
} from '@/types/tools-background-removal';
import type {
  BackgroundRemovalResult,
  BackgroundRemovalSourceAsset,
  BackgroundRemovalVideoMetadata,
  MediaLibraryAssetResponse,
  RecentBackgroundRemovalResult,
} from './background-removal-workspace-types';
import type { Job } from '@/types/jobs';

export async function uploadSourceVideo(file: File): Promise<BackgroundRemovalSourceAsset> {
  const form = new FormData();
  form.append('file', file);
  const response = await authFetch('/api/uploads/video', {
    method: 'POST',
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    asset?: BackgroundRemovalSourceAsset;
  } | null;
  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    throw new Error(payload?.error ?? `Upload failed (${response.status})`);
  }
  return payload.asset;
}

export function readBackgroundRemovalVideoMetadata(url: string): Promise<BackgroundRemovalVideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth || null;
      const height = video.videoHeight || null;
      cleanup();
      if (durationSec > 0) {
        resolve({ width, height, durationSec });
        return;
      }
      reject(new Error('Video metadata unavailable'));
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Video metadata unavailable'));
    };
    video.src = url;
  });
}

export function formatCurrency(amountCents?: number | null, currency = 'USD', locale?: string): string {
  if (typeof amountCents !== 'number') return '-';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

export function inferVideoMimeType(url: string): string {
  const clean = url.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.webm')) return 'video/webm';
  if (clean.endsWith('.mov')) return 'video/quicktime';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.mkv')) return 'video/x-matroska';
  if (clean.endsWith('.avi')) return 'video/x-msvideo';
  return 'video/mp4';
}

export function isTransparentOutput(codec?: string | null, backgroundColor?: string | null): boolean {
  return backgroundColor === 'Transparent' && (codec === 'webm_vp9' || codec === 'mov_proresks');
}

export function canPreviewTransparentOutput(codec?: string | null, backgroundColor?: string | null): boolean {
  return backgroundColor === 'Transparent' && codec === 'webm_vp9';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function readBackgroundRemovalControlsFromJob(job: Job): {
  outputCodec?: BackgroundRemovalOutputCodec;
  backgroundColor?: BackgroundRemovalStudioBackgroundColor;
  preserveAudio?: boolean;
} {
  const settings = asRecord(job.settingsSnapshot);
  const controls = asRecord(settings?.controls);
  const outputCodec = controls?.outputCodec;
  const backgroundColor = controls?.backgroundColor;

  return {
    outputCodec: BACKGROUND_REMOVAL_OUTPUT_CODECS.includes(outputCodec as BackgroundRemovalOutputCodec)
      ? (outputCodec as BackgroundRemovalOutputCodec)
      : undefined,
    backgroundColor: BACKGROUND_REMOVAL_STUDIO_COLORS.includes(backgroundColor as BackgroundRemovalStudioBackgroundColor)
      ? (backgroundColor as BackgroundRemovalStudioBackgroundColor)
      : undefined,
    preserveAudio: typeof controls?.preserveAudio === 'boolean' ? controls.preserveAudio : undefined,
  };
}

export function backgroundRemovalRecentToResult(item: RecentBackgroundRemovalResult): BackgroundRemovalResult {
  return {
    ok: true,
    jobId: item.job.jobId,
    engineId: 'bria-video-background-removal-v3',
    engineLabel: item.engineLabel,
    latencyMs: 0,
    pricing: {
      estimatedCostUsd: typeof item.totalCents === 'number' ? item.totalCents / 100 : 0,
      currency: item.currency ?? 'USD',
      estimatedCredits: typeof item.totalCents === 'number' ? item.totalCents : 0,
      totalCents: item.totalCents ?? null,
      billingProductKey: item.job.billingProductKey ?? 'background-removal-video-v3',
    },
    output: {
      url: item.url,
      thumbUrl: item.thumbUrl ?? null,
      mimeType: item.mimeType ?? inferVideoMimeType(item.url),
      source: 'background-removal',
    },
  };
}

export function assetToSourceAsset(asset: NonNullable<MediaLibraryAssetResponse['assets']>[number]): BackgroundRemovalSourceAsset {
  const label = typeof asset.metadata?.label === 'string' ? asset.metadata.label : null;
  return {
    id: asset.id,
    jobId: asset.sourceJobId ?? null,
    url: asset.url,
    name: label ?? asset.id,
    mime: asset.mimeType ?? inferVideoMimeType(asset.url),
    width: asset.width ?? null,
    height: asset.height ?? null,
    thumbUrl: asset.thumbUrl ?? asset.previewUrl ?? null,
  };
}

export function resolveRecentBackgroundRemovalResult(job: Job): RecentBackgroundRemovalResult | null {
  const url = job.videoUrl ?? job.readyVideoUrl ?? null;
  if (!url) return null;
  return {
    job,
    url,
    thumbUrl: job.thumbUrl ?? job.previewFrame ?? null,
    mimeType: inferVideoMimeType(url),
    createdAt: job.createdAt,
    engineLabel: job.engineLabel,
    totalCents: job.finalPriceCents ?? job.pricingSnapshot?.totalCents ?? null,
    currency: job.currency ?? job.pricingSnapshot?.currency ?? 'USD',
  };
}

export async function fetchBackgroundRemovalLibraryAssets(source: string): Promise<BackgroundRemovalSourceAsset[]> {
  const params = new URLSearchParams({ kind: 'video', limit: '48' });
  if (source !== 'all') params.set('source', source);
  const response = await authFetch(`/api/media-library/assets?${params.toString()}`);
  const payload = (await response.json().catch(() => null)) as MediaLibraryAssetResponse | null;
  if (!response.ok || !payload?.ok || !Array.isArray(payload.assets)) {
    throw new Error(payload?.error ?? `Library request failed (${response.status})`);
  }
  return payload.assets.filter((asset) => asset.kind === 'video').map(assetToSourceAsset);
}
