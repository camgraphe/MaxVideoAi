import type { SeoWatchVideoConfig } from '@/config/video-seo-watchlist';
import { getVideoSeoEditorialEntry, type VideoSeoEditorialEntry } from '@/config/video-seo-editorial';
import { DEFAULT_ENGINE_GUIDE } from '@/lib/engine-guides';
import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { isStablePublicMediaUrl } from '@/lib/media';
import {
  getDuplicateVideoObjectNames,
  isVideoSeoEditorialApproved,
  validateVideoSeoEditorialEntry,
} from '@/lib/video-seo-editorial-qa';
import type { GalleryVideo } from '@/server/videos';
import {
  buildDetailRows,
  buildInputRows,
  buildPromptRows,
  buildWhatThisShows,
  extractDescriptor,
  titlePattern,
} from './content';
import { buildEngineBadges, resolveEngineEntry } from './engine';
import {
  formatClusterLabel,
  formatModeLabel,
  formatPromptPreview,
  likelyExpiringMediaUrl,
  truncateText,
} from './formatting';
import { parseSnapshot } from './snapshot';
import { buildCapabilityTags, extractStyleTags, pickPrimaryIntent } from './tags';
import { buildCompareLinks, buildPromptImprovementNotes } from './recommendations';
import { buildWatchPageCanonicalState } from './canonical';
import type { WatchPageDerivedSignals, WatchPageIntent } from './types';

export function deriveWatchPageSignals(params: {
  entry?: SeoWatchVideoConfig | null;
  video: GalleryVideo;
  editorial?: VideoSeoEditorialEntry | null;
  duplicateVideoObjectNames?: ReadonlySet<string>;
}): WatchPageDerivedSignals {
  const { entry, video } = params;
  const editorial = params.editorial ?? getVideoSeoEditorialEntry(video.id);
  const snapshot = parseSnapshot(video);
  const engineEntry = resolveEngineEntry(editorial?.modelSlug ?? entry?.engineSlug ?? snapshot.engineId ?? video.engineId);
  const engineSlug = editorial?.modelSlug ?? engineEntry?.modelSlug ?? entry?.engineSlug ?? normalizeEngineId(video.engineId ?? '') ?? null;
  const engineLabel = engineEntry?.marketingName ?? entry?.engineLabel ?? video.engineLabel ?? 'AI video engine';
  const exampleFamily =
    editorial?.examplesSlug ?? entry?.exampleFamily ?? resolveExampleCanonicalSlug(entry?.engineSlug ?? engineSlug ?? video.engineId ?? null);
  const exampleFamilyLabel = formatClusterLabel(exampleFamily ?? entry?.engineFamily ?? null);
  const modelPath = editorial?.modelSlug ? `/models/${editorial.modelSlug}` : engineEntry?.seo.canonicalPath ?? (entry?.sourceType === 'models' ? entry.sourcePath : null);
  const parentPath = editorial?.examplesSlug ? `/examples/${editorial.examplesSlug}` : exampleFamily ? `/examples/${exampleFamily}` : modelPath ?? entry?.sourcePath ?? '/examples';
  const parentLabel = exampleFamilyLabel ? `Browse ${exampleFamilyLabel} video examples` : 'Browse video examples';
  const modelLabel = `Open ${engineLabel} model page`;
  const promptText = snapshot.prompt || video.prompt || '';
  const promptPreview = formatPromptPreview(promptText);
  const styleTags = extractStyleTags(promptText, entry?.styleTags ?? []);
  const capabilityTags = buildCapabilityTags(snapshot, video, entry?.capabilityTags ?? []);
  const primaryIntent = (entry?.videoPrimaryIntent as WatchPageIntent | undefined) ?? pickPrimaryIntent(capabilityTags, styleTags);
  const descriptor = extractDescriptor(promptText) ?? 'generated scene';
  const fallbackTitle = titlePattern(primaryIntent, engineLabel, descriptor);
  const title = editorial?.h1 ?? truncateText(entry?.seoTitleOverride ?? fallbackTitle, 86);
  const metaTitle = editorial?.seoTitle ?? truncateText(entry?.seoTitleOverride ?? entry?.seoTitle ?? title, 86);
  const introSentences = [
    `This ${engineLabel} ${formatModeLabel(snapshot.inputMode).toLowerCase()} example shows ${descriptor}.`,
    (() => {
      const claims: string[] = [];
      if (capabilityTags.includes('multi-shot')) claims.push('multi-shot prompting');
      if (capabilityTags.includes('first-last-frame')) claims.push('first and last frame control');
      if (capabilityTags.includes('reference-images')) claims.push('reference images');
      if (capabilityTags.includes('audio-enabled')) claims.push('audio-enabled output');
      if (capabilityTags.includes('drone') || capabilityTags.includes('push-in') || capabilityTags.includes('tracking')) {
        claims.push('camera motion control');
      }
      const head = claims.length ? `It highlights ${claims.slice(0, 2).join(' and ')}` : `It shows how ${engineLabel} handles this prompt`;
      const tailParts = [
        snapshot.core.durationSec ? `${snapshot.core.durationSec}-second timing` : null,
        snapshot.core.aspectRatio ? snapshot.core.aspectRatio : null,
        snapshot.core.resolution ? snapshot.core.resolution : null,
      ].filter(Boolean);
      return tailParts.length ? `${head} with ${tailParts.join(' · ')} output.` : `${head}.`;
    })(),
  ];
  const intro = editorial?.shortDescription ?? truncateText(entry?.seoSummaryOverride ?? introSentences.join(' '), 240);
  const metaDescription = editorial?.metaDescription ?? truncateText(`${intro} Prompt: ${promptPreview}`, 170);
  const videoDescription = editorial?.shortDescription ?? truncateText(`${intro} ${promptPreview}`, 280);
  const badges = [
    engineLabel,
    formatModeLabel(snapshot.inputMode),
    snapshot.core.durationSec ? `${snapshot.core.durationSec}s` : null,
    snapshot.core.aspectRatio ?? null,
    capabilityTags.includes('audio-enabled') ? 'Audio' : null,
    capabilityTags.includes('multi-shot') ? 'Multi-shot' : null,
    capabilityTags.includes('first-last-frame') ? 'First/Last frame' : null,
  ]
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);
  const whatThisShows = buildWhatThisShows(snapshot, capabilityTags, styleTags, descriptor);
  const detailRows = buildDetailRows(video, snapshot, engineLabel);
  const promptRows = buildPromptRows(snapshot);
  const inputRows = buildInputRows(snapshot);
  const compareLinks = buildCompareLinks({ engineSlug, engineLabel, engineEntry });
  const promptImprovementNotes = buildPromptImprovementNotes({
    capabilityTags,
    primaryIntent,
    hasNegativePrompt: Boolean(snapshot.negativePrompt),
  });
  const stableVideoAsset = isStablePublicMediaUrl(video.videoUrl);
  const stableThumbnailAsset = isStablePublicMediaUrl(video.thumbUrl);
  const hasInternalLinkTargets = Boolean(modelPath && exampleFamily && parentPath);
  const canonicalSlug = editorial?.canonicalSlug ?? null;
  const canonical = buildWatchPageCanonicalState({
    video,
    canonicalSlug,
    stableVideoAsset,
    stableThumbnailAsset,
    hasInternalLinkTargets,
  });
  const completenessScore = [
    video.videoUrl ? 25 : 0,
    video.thumbUrl ? 15 : 0,
    promptText.trim().length >= 24 ? 10 : 0,
    snapshot.surface === 'video' ? 10 : 0,
    modelPath ? 10 : 0,
    parentPath ? 10 : 0,
    detailRows.length >= 6 ? 10 : 0,
    whatThisShows.length >= 3 ? 10 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const differentiationScore = [
    descriptor && descriptor !== 'generated scene' ? 25 : 0,
    styleTags.length ? 15 : 0,
    capabilityTags.filter((tag) => !['text-to-video', 'image-to-video'].includes(tag)).length >= 1 ? 20 : 0,
    inputRows.length ? 20 : 0,
    promptRows.length ? 10 : 0,
    snapshot.core.resolution ? 10 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const auditNotes: string[] = [];
  if (!video.videoUrl) auditNotes.push('Missing primary video asset.');
  if (!video.thumbUrl) auditNotes.push('Missing thumbnail asset.');
  if (video.videoUrl && !stableVideoAsset) auditNotes.push('Stable public video asset is required.');
  if (video.thumbUrl && !stableThumbnailAsset) auditNotes.push('Stable public thumbnail asset is required.');
  if (!hasInternalLinkTargets) auditNotes.push('Internal link targets are missing.');
  auditNotes.push(...canonical.validation.blockerLabels);
  if (promptText.trim().length < 24) auditNotes.push('Prompt is too thin for a differentiated watch page.');
  if (whatThisShows.length < 3) auditNotes.push('Derived summary is still too sparse.');
  const editorialQaContext = {
    promptText,
    hasVideoAsset: Boolean(video.videoUrl),
    hasThumbnailAsset: Boolean(video.thumbUrl),
    hasStableVideoAsset: stableVideoAsset,
    hasStableThumbnailAsset: stableThumbnailAsset,
    hasInternalLinkTargets,
    canonicalUrl: canonical.canonicalUrl,
    expectedCanonicalUrl: canonical.validation.expectedCanonicalUrl,
    canonicalTargetIndexable: canonical.canonicalTargetIndexable,
    technicallyIndexable: Boolean(video.videoUrl && video.thumbUrl && video.visibility === 'public' && video.indexable),
    duplicateVideoObjectNames: params.duplicateVideoObjectNames ?? getDuplicateVideoObjectNames(),
  };
  const editorialQa = entry
    ? validateVideoSeoEditorialEntry(editorial, editorialQaContext)
    : { passed: true, errors: [] as string[], warnings: [] as string[] };
  if (entry && !editorial) auditNotes.push('Missing editorial SEO override.');
  auditNotes.push(...editorialQa.errors.map((error) => `Editorial QA: ${error}`));
  auditNotes.push(...editorialQa.warnings.map((warning) => `Editorial QA: ${warning}`));
  const stabilityWarnings = [
    likelyExpiringMediaUrl(video.videoUrl) ? 'Video URL looks signed or temporary.' : null,
    likelyExpiringMediaUrl(video.thumbUrl) ? 'Thumbnail URL looks signed or temporary.' : null,
  ].filter((value): value is string => Boolean(value));
  const technicallyIndexable =
    Boolean(video.videoUrl) &&
    Boolean(video.thumbUrl) &&
    stableVideoAsset &&
    stableThumbnailAsset &&
    hasInternalLinkTargets &&
    canonical.validation.passed &&
    promptText.trim().length >= 24 &&
    completenessScore >= 50 &&
    (entry?.watchPageEligible ?? true);
  const indexable = entry ? technicallyIndexable && isVideoSeoEditorialApproved(editorial, editorialQaContext) : technicallyIndexable;
  const engineGuide = engineEntry && DEFAULT_ENGINE_GUIDE[engineEntry.modelSlug];
  const engineDescription = engineGuide?.description ?? engineEntry?.seo.description ?? 'Open the engine page for specs, controls, and pricing.';
  const engineBadges = buildEngineBadges(engineEntry);

  return {
    title,
    metaTitle,
    metaDescription,
    videoObjectName: editorial?.videoObjectName ?? title,
    canonicalSlug,
    canonicalUrl: canonical.canonicalUrl,
    expectedCanonicalUrl: canonical.validation.expectedCanonicalUrl,
    canonicalBlockers: canonical.validation.blockerLabels,
    targetKeyword: editorial?.targetKeyword ?? null,
    seoStatus: editorial?.seoStatus ?? null,
    editorialQaErrors: editorialQa.errors,
    videoDescription,
    intro,
    promptText,
    promptPreview,
    negativePrompt: snapshot.negativePrompt,
    engineLabel,
    engineSlug,
    engineFamily: entry?.engineFamily ?? exampleFamily ?? null,
    exampleFamily,
    exampleFamilyLabel,
    mode: snapshot.inputMode,
    modeLabel: formatModeLabel(snapshot.inputMode),
    durationSec: snapshot.core.durationSec,
    aspectRatio: snapshot.core.aspectRatio,
    resolution: snapshot.core.resolution,
    fps: snapshot.core.fps,
    hasAudio: Boolean(snapshot.core.audio ?? video.hasAudio),
    primaryIntent,
    capabilityTags,
    styleTags,
    badges,
    whatThisShows,
    detailRows,
    promptRows,
    inputRows,
    promptImprovementNotes,
    compareLinks,
    parentPath,
    parentLabel,
    modelPath,
    modelLabel,
    recreatePath: `/app?from=${encodeURIComponent(video.id)}`,
    breadcrumbs: exampleFamilyLabel
      ? [
          { label: 'Home', href: '/' },
          { label: 'Examples', href: '/examples' },
          { label: exampleFamilyLabel, href: parentPath },
          { label: title },
        ]
      : [
          { label: 'Home', href: '/' },
          { label: 'Models', href: '/models' },
          { label: engineLabel, href: modelPath ?? undefined },
          { label: title },
        ],
    engineDescription,
    engineBadges,
    completenessScore,
    differentiationScore,
    indexable,
    auditNotes,
    stabilityWarnings,
  };
}
