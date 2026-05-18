import { VIDEO_SEO_WATCHLIST, type SeoWatchVideoConfig } from '@/config/video-seo-watchlist';
import { isStablePublicMediaUrl } from '@/lib/media';
import { buildExpectedVideoCanonicalUrl } from '@/lib/video-seo-canonical';
import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { getDuplicateVideoObjectNames } from '@/lib/video-seo-editorial-qa';
import { deriveWatchPageSignals } from '@/server/watch-page-signals';
import type { WatchPageDerivedSignals } from '@/server/watch-page-signals';
import { getSeoVideosByIds, listPublicVideoPagesForSeoAudit, type GalleryVideo } from '@/server/videos';
import { listVideoSeoEditorialEntryMap, type PersistedVideoSeoEditorialEntry } from '@/server/video-seo-editorial';
import type { VideoSeoAuditSourceRow } from '@/server/video-seo-audit';

const WATCHLIST_BY_ID = new Map(VIDEO_SEO_WATCHLIST.map((entry) => [entry.id, entry] as const));
const FALLBACK_PUBLISHED_AT = '1970-01-01T00:00:00.000Z';

function countInternalLinks(signals: Pick<WatchPageDerivedSignals, 'modelPath' | 'parentPath' | 'compareLinks'>, relatedCount: number) {
  return Number(Boolean(signals.modelPath)) + Number(Boolean(signals.parentPath)) + signals.compareLinks.length + relatedCount;
}

function buildAuditMeta(options: {
  id: string;
  base?: SeoWatchVideoConfig | null;
  editorial?: PersistedVideoSeoEditorialEntry | null;
  video?: GalleryVideo | null;
}): SeoWatchVideoConfig {
  const { id, base, editorial, video } = options;
  if (!editorial && base) return base;

  const modelSlug = editorial?.modelSlug || base?.engineSlug || normalizeEngineId(video?.engineId ?? '') || video?.engineId || '';
  const examplesSlug = editorial?.examplesSlug || base?.engineFamily || resolveExampleCanonicalSlug(modelSlug) || '';
  const engineLabel = base?.engineLabel || video?.engineLabel || modelSlug || 'AI video engine';

  return {
    id,
    engineSlug: modelSlug,
    engineFamily: examplesSlug || base?.engineFamily || 'video',
    engineLabel,
    sourceType: examplesSlug ? 'examples' : 'models',
    sourcePath: examplesSlug ? `/examples/${examplesSlug}` : modelSlug ? `/models/${modelSlug}` : '/examples',
    sourceLabel: examplesSlug ? `Editorial examples - ${examplesSlug}` : `Editorial model - ${modelSlug || 'video'}`,
    seoTitle: editorial?.seoTitle || base?.seoTitle || `${engineLabel} video SEO candidate`,
    intro: editorial?.shortDescription || base?.intro || `Editorial video SEO candidate for ${engineLabel}.`,
    reasonForSelection: editorial?.seoStatus === 'approved' ? 'Approved editorial SEO watch page.' : `Editorial SEO status: ${editorial?.seoStatus ?? 'candidate'}.`,
    priority: base?.priority ?? 0,
    publishedAt: base?.publishedAt ?? video?.createdAt ?? FALLBACK_PUBLISHED_AT,
    watchPageEligible: base?.watchPageEligible,
    videoPrimaryIntent: base?.videoPrimaryIntent,
    exampleFamily: examplesSlug || base?.exampleFamily,
    styleTags: base?.styleTags,
    capabilityTags: base?.capabilityTags,
    seoTitleOverride: base?.seoTitleOverride,
    seoSummaryOverride: base?.seoSummaryOverride,
  };
}

export async function listVideoSeoAuditSourceRows(limit = 1000): Promise<VideoSeoAuditSourceRow[]> {
  const editorialMap = await listVideoSeoEditorialEntryMap();
  const selectedIds = new Set([...VIDEO_SEO_WATCHLIST.map((entry) => entry.id), ...editorialMap.keys()]);
  const videoMap = await getSeoVideosByIds([...selectedIds]);
  const duplicateVideoObjectNames = getDuplicateVideoObjectNames([...editorialMap.values()]);
  const selectedSourceRows = [...selectedIds].map((id) => {
    const entry = buildAuditMeta({
      id,
      base: WATCHLIST_BY_ID.get(id) ?? null,
      editorial: editorialMap.get(id) ?? null,
      video: videoMap.get(id) ?? null,
    });
    const video = videoMap.get(id) ?? null;
    const editorial = editorialMap.get(id) ?? null;
    const signals = video ? deriveWatchPageSignals({ entry, video, editorial, duplicateVideoObjectNames }) : null;
    const isEligible = Boolean(video?.visibility === 'public' && video.indexable && video.videoUrl && signals?.indexable);
    return {
      videoId: entry.id,
      seoStatus: signals?.seoStatus ?? editorial?.seoStatus ?? 'candidate',
      isEligible,
      canonicalUrl: signals?.canonicalUrl ?? buildExpectedVideoCanonicalUrl(entry.id),
      expectedCanonicalUrl: signals?.expectedCanonicalUrl ?? buildExpectedVideoCanonicalUrl(entry.id),
      videoObjectPresent: isEligible,
      stableThumbnailUrl: isStablePublicMediaUrl(video?.thumbUrl),
      stableVideoUrl: isStablePublicMediaUrl(video?.videoUrl),
      internalLinkCount: signals ? countInternalLinks(signals, 0) : 0,
      editorialQaErrors: signals?.editorialQaErrors ?? [],
      technicalEligibilityBlockers: signals?.auditNotes?.filter((note) => !note.startsWith('Editorial QA:')) ?? [],
      canonicalConflictIds: signals?.canonicalBlockers.includes('Canonical conflict') ? [entry.id] : [],
    };
  });

  const publicVideos = await listPublicVideoPagesForSeoAudit(limit);
  const publicSourceRows = publicVideos.flatMap((video) => {
    if (selectedIds.has(video.id)) return [];
    const signals = deriveWatchPageSignals({ video });
    return [
      {
        videoId: video.id,
        seoStatus: signals.seoStatus ?? 'candidate',
        isEligible: false,
        canonicalUrl: signals.canonicalUrl,
        expectedCanonicalUrl: signals.expectedCanonicalUrl,
        videoObjectPresent: false,
        stableThumbnailUrl: isStablePublicMediaUrl(video.thumbUrl),
        stableVideoUrl: isStablePublicMediaUrl(video.videoUrl),
        internalLinkCount: countInternalLinks(signals, 0),
        editorialQaErrors: signals.editorialQaErrors,
        technicalEligibilityBlockers: signals.auditNotes.filter((note) => !note.startsWith('Editorial QA:')),
        canonicalConflictIds: [],
      },
    ];
  });

  return [...selectedSourceRows, ...publicSourceRows];
}
