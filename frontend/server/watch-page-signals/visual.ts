import type { VideoSeoEditorialEntry } from '@/config/video-seo-editorial';
import {
  canUseVideoSeoVisualPromptException,
  countEditorialWords,
  getDuplicateVideoObjectNames,
  resolveVideoSeoPromptContext,
  type VideoSeoEditorialQaContext,
} from '@/lib/video-seo-editorial-qa';
import type { GalleryVideo } from '@/server/videos';
import { buildSourceImages } from './content';
import type { ParsedSnapshot, WatchPageIntent, WatchPageSourceImage } from './types';

type CanonicalContext = {
  canonicalUrl: string;
  canonicalTargetIndexable: boolean;
  validation: {
    expectedCanonicalUrl: string;
  };
};

export type WatchPageVisualContext = {
  hasAudio: boolean;
  hasMultiShot: boolean;
  visualReferenceWorkflow: boolean;
  visualReferenceAsset: boolean;
  promptQualityGate: boolean;
  seoPromptContext: string | null;
  sourceImages: WatchPageSourceImage[];
  baseEditorialQaContext: VideoSeoEditorialQaContext;
};

function hasVisualReferenceAsset(snapshot: ParsedSnapshot): boolean {
  return Boolean(
    snapshot.refs.imageUrl ||
      snapshot.refs.firstFrameUrl ||
      snapshot.refs.lastFrameUrl ||
      snapshot.refs.endImageUrl ||
      snapshot.refs.referenceImages.length > 0
  );
}

function isVisualReferenceWorkflow(
  snapshot: ParsedSnapshot,
  capabilityTags: readonly string[],
  primaryIntent: WatchPageIntent
): boolean {
  const visualInputModes = new Set(['i2v', 'r2v', 'fl2v', 'ref2v', 'image-to-video', 'reference-to-video']);
  return (
    visualInputModes.has(snapshot.inputMode ?? '') ||
    primaryIntent === 'image-to-video' ||
    primaryIntent === 'first-last-frame' ||
    capabilityTags.some((tag) =>
      ['image-to-video', 'reference-to-video', 'first-last-frame', 'reference-image', 'reference-images'].includes(tag)
    )
  );
}

export function buildWatchPageVisualContext(params: {
  snapshot: ParsedSnapshot;
  video: GalleryVideo;
  editorial?: VideoSeoEditorialEntry | null;
  capabilityTags: readonly string[];
  primaryIntent: WatchPageIntent;
  promptText: string;
  title: string;
  intro: string;
  stableVideoAsset: boolean;
  stableThumbnailAsset: boolean;
  hasInternalLinkTargets: boolean;
  canonical: CanonicalContext;
  duplicateVideoObjectNames?: ReadonlySet<string>;
}): WatchPageVisualContext {
  const {
    snapshot,
    video,
    editorial,
    capabilityTags,
    primaryIntent,
    promptText,
    title,
    intro,
    stableVideoAsset,
    stableThumbnailAsset,
    hasInternalLinkTargets,
    canonical,
  } = params;
  const visualReferenceWorkflow = isVisualReferenceWorkflow(snapshot, capabilityTags, primaryIntent);
  const visualReferenceAsset = hasVisualReferenceAsset(snapshot);
  const hasAudio = Boolean(snapshot.core.audio ?? video.hasAudio);
  const hasMultiShot = snapshot.advanced.multiPromptCount > 1 || capabilityTags.includes('multi-shot');
  const baseEditorialQaContext = {
    promptText,
    isVisualReferenceWorkflow: visualReferenceWorkflow,
    hasVisualReferenceAsset: visualReferenceAsset,
    hasAudio,
    hasMultiShot,
    hasVideoAsset: Boolean(video.videoUrl),
    hasThumbnailAsset: Boolean(video.thumbUrl),
    hasStableVideoAsset: stableVideoAsset,
    hasStableThumbnailAsset: stableThumbnailAsset,
    hasInternalLinkTargets,
    canonicalUrl: canonical.canonicalUrl,
    expectedCanonicalUrl: canonical.validation.expectedCanonicalUrl,
    canonicalTargetIndexable: canonical.canonicalTargetIndexable,
    duplicateVideoObjectNames: params.duplicateVideoObjectNames ?? getDuplicateVideoObjectNames(),
  };
  const promptMeetsLengthGate = promptText.trim().length >= 24;
  const promptTooShortForSeo = countEditorialWords(promptText) < 28;
  const hasVisualPromptException =
    promptTooShortForSeo && canUseVideoSeoVisualPromptException(editorial, baseEditorialQaContext);
  const editorialPromptContext = resolveVideoSeoPromptContext(editorial);
  const seoPromptContext =
    visualReferenceWorkflow &&
    editorialPromptContext &&
    (Boolean(editorial?.editorialPromptBreakdown?.trim()) || hasVisualPromptException)
      ? editorialPromptContext
      : null;

  return {
    hasAudio,
    hasMultiShot,
    visualReferenceWorkflow,
    visualReferenceAsset,
    promptQualityGate: promptMeetsLengthGate || hasVisualPromptException,
    seoPromptContext,
    sourceImages: buildSourceImages(snapshot, {
      enabled: Boolean(
        editorial?.showSourceImages &&
          editorial?.seoStatus === 'approved' &&
          video.visibility === 'public' &&
          video.indexable &&
          visualReferenceWorkflow &&
          visualReferenceAsset
      ),
      title,
      altContext: seoPromptContext ?? editorial?.shortDescription ?? intro,
    }),
    baseEditorialQaContext,
  };
}
