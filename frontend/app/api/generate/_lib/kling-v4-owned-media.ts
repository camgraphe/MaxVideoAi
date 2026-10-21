import { query } from '@/lib/db';
import type { MinimaxH3MaxPricingReference } from '@/lib/minimax-h3-max-pricing';
import type { ReferenceBudgetMediaItem } from '@/lib/reference-budget';
import type { MaxVideoProviderElement } from '@/lib/video-provider-elements';
import { validReferenceMediaUrl } from '@/server/asset-url-policy';
import type { ResolvedReference } from '@/server/agent-api/reference-types';
import { detectVideoMetadata } from '@/server/media/detect-has-audio';
import type { Mode } from '@/types/engines';
import type { NormalizedAttachment } from './generation-attachment-types';
import type { GenerationMediaConstraintValidationResult, StoredMediaMetadataRow } from './generation-media-constraints';

export type KlingV4TrustedMediaReference = MinimaxH3MaxPricingReference & { assetId: string; fps?: number };
export type KlingV4OwnedMediaResult = Exclude<GenerationMediaConstraintValidationResult, { ok: true }> | {
  ok: true;
  trustedDurationSecByField: Record<string, number[]>;
  trustedMediaReferences: KlingV4TrustedMediaReference[];
};
export type KlingV4OwnedMediaDependencies = {
  queryFn?: <T = unknown>(sql: string, params?: readonly unknown[]) => Promise<T[]>;
  detectVideoMetadataFn?: typeof detectVideoMetadata;
};

function rejected(field: string, message: string): KlingV4OwnedMediaResult {
  return { ok: false, status: 422, body: { ok: false, error: 'MEDIA_METADATA_UNVERIFIED', field, message },
    metric: { errorCode: 'MEDIA_METADATA_UNVERIFIED', meta: { field } } };
}
function positive(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

/** Resolve every occurrence to its owned original before price/quote or provider use.
 * Never accept browser metadata, origin URLs, or a different asset sharing a URL.
 * Keep repeated occurrences: each submitted video consumes the shared time budget.
 */
export async function validateKlingV4OwnedMedia(params: {
  mode: Mode;
  userId: string;
  attachments: readonly NormalizedAttachment[];
  referenceMediaItems: readonly ReferenceBudgetMediaItem[];
  elements?: readonly MaxVideoProviderElement[];
  trustedResolvedReferences?: readonly ResolvedReference[];
  deps?: KlingV4OwnedMediaDependencies;
}): Promise<KlingV4OwnedMediaResult> {
  const fields: Record<string, Record<string, string>> = {
    t2v: {}, i2v: { image_url: 'image', end_image_url: 'image' },
    ref2v: { image_url: 'image', image_urls: 'image', video_urls: 'video' },
    v2v: { video_url: 'video', image_urls: 'image' },
  };
  if (!fields[params.mode] || params.referenceMediaItems.some(item =>
    !(params.trustedResolvedReferences !== undefined && /^canonical_reference\.\d+$/u.test(item.fieldId))
      && fields[params.mode][item.fieldId] !== item.kind)) {
    return rejected('references', 'This media role is not supported in the selected Kling 4 mode.');
  }
  const occurrences = new Map<string, number>();
  const candidates = params.referenceMediaItems.map(item => {
    const key = `${item.fieldId}:${item.kind}:${item.url.trim()}`;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    const attachment = params.attachments.filter(a => a.url?.trim() === item.url.trim()
      && a.slotId === item.fieldId && a.kind === item.kind)[occurrence];
    return { ...item, url: item.url.trim(), assetId: attachment?.assetId?.trim() };
  });
  const elements = params.elements ?? [];
  if (elements.length > 7 || (elements.length && !['ref2v', 'v2v'].includes(params.mode))) {
    return rejected('elements', 'Kling 4 subjects require reference generation or video editing, with at most seven subjects.');
  }
  if (elements.filter(e => e.videoUrl).length > 3) return rejected('elements', 'Use at most three video subjects.');
  for (const [index, element] of elements.entries()) {
    const fieldId = `elements.${index}`;
    if (element.voiceId || element.providerElementId) return rejected(fieldId, 'This subject requires a verified voice or provider binding before it can be used.');
    if (element.videoUrl) {
      if (params.mode !== 'ref2v' || element.frontalImageUrl || element.referenceImageUrls?.length) {
        return rejected(fieldId, 'Video subjects are only supported in reference generation, without image views.');
      }
      candidates.push({ fieldId, kind: 'video', url: element.videoUrl.trim(), assetId: element.videoAssetId?.trim() });
    } else {
      if (!element.frontalImageUrl || !element.referenceImageUrls?.length || element.referenceImageUrls.length > 3
        || element.referenceAssetIds?.length !== element.referenceImageUrls.length) {
        return rejected(fieldId, 'An image subject needs an owned frontal image and one to three owned additional views.');
      }
      candidates.push({ fieldId, kind: 'image', url: element.frontalImageUrl.trim(), assetId: element.frontalAssetId?.trim() });
      element.referenceImageUrls.forEach((url, view) => candidates.push({ fieldId, kind: 'image', url: url.trim(), assetId: element.referenceAssetIds![view]?.trim() }));
    }
  }
  // Fal's mixed-limit wording is not fully qualified. Count every visual source,
  // including subject views, conservatively; never silently truncate a request.
  if (params.mode === 'ref2v' && candidates.length > 15) return rejected('references', 'This Kling 4 request exceeds the current 15-visual-source limit, including subject views.');
  if (!candidates.length) return { ok: true, trustedDurationSecByField: {}, trustedMediaReferences: [] };
  if (candidates.some(c => !c.assetId || !validReferenceMediaUrl(c.url) || !['image', 'video'].includes(c.kind))) {
    return rejected('references', 'Use owned original images or videos from your media library.');
  }
  let rows: StoredMediaMetadataRow[];
  if (params.trustedResolvedReferences !== undefined) {
    rows = params.trustedResolvedReferences.map(r => ({ asset_id: r.assetId, url: r.storageUrl,
      origin_url: null, original_name: r.originalName ?? null, mime_type: r.mimeType, size_bytes: r.sizeBytes ?? null,
      width: r.width, height: r.height, duration_sec: r.durationSec }));
  } else {
    try {
      rows = await (params.deps?.queryFn ?? query)<StoredMediaMetadataRow>(
        `SELECT asset_id::text AS asset_id, url, NULL::text AS origin_url,
                metadata->>'originalName' AS original_name, mime_type, size_bytes, width, height
           FROM user_assets WHERE user_id = $1 AND asset_id = ANY($2::text[])
          UNION ALL
         SELECT CASE WHEN public_id = ANY($2::text[]) THEN public_id ELSE id::text END AS asset_id,
                url, NULL::text AS origin_url, metadata->>'originalName' AS original_name, mime_type, size_bytes, width, height
           FROM media_assets WHERE user_id = $1 AND deleted_at IS NULL AND status = 'ready'
             AND (id::text = ANY($2::text[]) OR public_id = ANY($2::text[]))`,
        [params.userId, [...new Set(candidates.map(c => c.assetId!))]]);
    } catch {
      return rejected('references', 'The original media could not be verified. Try again before generating.');
    }
  }
  const trustedMediaReferences: KlingV4TrustedMediaReference[] = [];
  const trustedDurationSecByField: Record<string, number[]> = {};
  const probes = new Map<string, Awaited<ReturnType<typeof detectVideoMetadata>>>();
  let videoTotal = 0;
  for (const candidate of candidates) {
    const stored = rows.find(r => r.asset_id === candidate.assetId && r.url === candidate.url);
    const bytes = positive(stored?.size_bytes);
    if (!stored || !bytes || !stored.mime_type?.startsWith(`${candidate.kind}/`)) {
      return rejected(candidate.fieldId, 'This exact original could not be verified in your media library.');
    }
    if (bytes > (candidate.kind === 'video' ? 300 : 30) * 1024 * 1024) {
      return rejected(candidate.fieldId, `Kling 4 ${candidate.kind} references exceed the allowed file size.`);
    }
    let width = positive(stored.width), height = positive(stored.height), durationSec: number | null = null;
    let fps: number | undefined;
    if (candidate.kind === 'video') {
      const resolved = params.trustedResolvedReferences?.find(r => r.assetId === candidate.assetId && r.storageUrl === candidate.url && r.mediaKind === 'video');
      let facts = resolved?.fps ? { width: resolved.width!, height: resolved.height!, durationSec: resolved.durationSec!, fps: resolved.fps } : undefined;
      if (!facts) {
        if (!probes.has(candidate.url)) {
          try { probes.set(candidate.url, await (params.deps?.detectVideoMetadataFn ?? detectVideoMetadata)(candidate.url, { requireExactFrameRate: true })); }
          catch { probes.set(candidate.url, null); }
        }
        facts = probes.get(candidate.url) ?? undefined;
      }
      if (!facts || !Number.isFinite(facts.fps) || facts.fps < 23.9 || facts.fps > 60.05
        || !Number.isFinite(facts.durationSec) || facts.durationSec < 3 || facts.durationSec > 30.05) {
        return rejected(candidate.fieldId, 'Kling 4 requires a verified 3–30-second video at 23.9–60.05 FPS.');
      }
      ({ width, height, durationSec, fps } = facts);
      videoTotal += durationSec;
      (trustedDurationSecByField[candidate.fieldId] ??= []).push(durationSec);
    }
    const min = candidate.kind === 'video' ? 700 : 300;
    if (!width || !height || !Number.isInteger(width) || !Number.isInteger(height) || width < min || height < min
      || (candidate.kind === 'video' && (width > 4553 || height > 4553)) || width / height < 0.4 || width / height > 2.5) {
      return rejected(candidate.fieldId, `Kling 4 ${candidate.kind} dimensions or aspect ratio are unsupported.`);
    }
    trustedMediaReferences.push({ ...candidate, assetId: candidate.assetId!, width, height, durationSec, ...(fps === undefined ? {} : { fps }) });
  }
  if (params.mode === 'ref2v' && videoTotal > 30 + 1e-8) {
    return rejected('references', 'Reference videos and video subjects must total no more than 30 seconds.');
  }
  return { ok: true, trustedDurationSecByField, trustedMediaReferences };
}
