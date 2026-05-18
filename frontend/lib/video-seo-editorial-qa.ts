import {
  VIDEO_SEO_EDITORIAL_ENTRIES,
  type VideoSeoEditorialEntry,
} from '@/config/video-seo-editorial';
import { validateVideoSeoCanonical } from '@/lib/video-seo-canonical';

export type VideoSeoEditorialQaContext = {
  promptText?: string | null;
  hasVideoAsset?: boolean;
  hasThumbnailAsset?: boolean;
  hasStableVideoAsset?: boolean;
  hasStableThumbnailAsset?: boolean;
  hasInternalLinkTargets?: boolean;
  canonicalUrl?: string | null;
  expectedCanonicalUrl?: string | null;
  canonicalTargetIndexable?: boolean;
  canonicalConflictIds?: ReadonlySet<string> | readonly string[] | null;
  technicallyIndexable?: boolean;
  duplicateVideoObjectNames?: ReadonlySet<string>;
};

export type VideoSeoEditorialQaResult = {
  passed: boolean;
  errors: string[];
  warnings: string[];
};

const REQUIRED_FIELDS = [
  'seoTitle',
  'metaDescription',
  'h1',
  'videoObjectName',
  'shortDescription',
  'targetKeyword',
  'intent',
  'modelSlug',
  'examplesSlug',
] as const satisfies readonly (keyof VideoSeoEditorialEntry)[];

const MIN_PROMPT_WORDS = 28;

export function countEditorialWords(value?: string | null): number {
  if (!value) return 0;
  return value.match(/[A-Za-z0-9][A-Za-z0-9'.-]*/g)?.length ?? 0;
}

export function getDuplicateVideoObjectNames(
  entries: readonly VideoSeoEditorialEntry[] = VIDEO_SEO_EDITORIAL_ENTRIES
): Set<string> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.videoObjectName.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

function isMissing(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function hasForbiddenTitleLanguage(value: string): boolean {
  return /\b(examples hero|model hero)\b/i.test(value);
}

function hasCanonicalQaContext(context: VideoSeoEditorialQaContext): boolean {
  return (
    'canonicalUrl' in context ||
    'expectedCanonicalUrl' in context ||
    'canonicalTargetIndexable' in context ||
    'canonicalConflictIds' in context
  );
}

function looksTruncated(value: string): boolean {
  const clean = value.trim();
  return clean.includes('…') || /\b(the|a|an|in|of|with|and)$/i.test(clean);
}

export function validateVideoSeoEditorialEntry(
  entry: VideoSeoEditorialEntry | null | undefined,
  context: VideoSeoEditorialQaContext = {}
): VideoSeoEditorialQaResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!entry) {
    return {
      passed: false,
      errors: ['Missing editorial SEO override.'],
      warnings,
    };
  }

  for (const field of REQUIRED_FIELDS) {
    if (isMissing(entry[field])) {
      errors.push(`Missing editorial field: ${field}.`);
    }
  }

  if (hasForbiddenTitleLanguage(entry.seoTitle)) {
    errors.push('SEO title must not contain examples hero or model hero.');
  }
  if (looksTruncated(entry.seoTitle)) {
    errors.push('SEO title looks truncated.');
  }
  if (looksTruncated(entry.h1)) {
    errors.push('H1 looks truncated.');
  }
  if (looksTruncated(entry.videoObjectName)) {
    errors.push('VideoObject.name looks truncated.');
  }
  if (entry.h1.length < 32) {
    errors.push('H1 is too short for a premium watch page.');
  }
  if (entry.metaDescription.length < 90 || entry.metaDescription.length > 170) {
    errors.push('Meta description should be between 90 and 170 characters.');
  }
  if (entry.shortDescription.length < 90) {
    errors.push('Short description is too thin.');
  }

  const duplicateNames = context.duplicateVideoObjectNames ?? getDuplicateVideoObjectNames();
  if (duplicateNames.has(entry.videoObjectName.trim().toLowerCase())) {
    errors.push('VideoObject.name is duplicated.');
  }

  if (context.promptText != null && countEditorialWords(context.promptText) < MIN_PROMPT_WORDS) {
    errors.push(`Prompt is too short for video SEO (${countEditorialWords(context.promptText)} words).`);
  }
  if (context.hasVideoAsset === false) errors.push('Missing primary video asset.');
  if (context.hasThumbnailAsset === false) errors.push('Missing thumbnail asset.');
  if (context.hasStableVideoAsset === false) errors.push('Stable public video asset is required.');
  if (context.hasStableThumbnailAsset === false) errors.push('Stable public thumbnail asset is required.');
  if (context.hasInternalLinkTargets === false) errors.push('Approved pages require internal link targets.');
  if (hasCanonicalQaContext(context)) {
    const canonical = validateVideoSeoCanonical({
      videoId: entry.id,
      canonicalUrl: context.canonicalUrl,
      expectedCanonicalUrl: context.expectedCanonicalUrl,
      canonicalTargetIndexable: context.canonicalTargetIndexable,
      canonicalConflictIds: context.canonicalConflictIds,
    });
    errors.push(...canonical.blockerLabels);
  }
  if (context.technicallyIndexable === false) errors.push('Video is not technically indexable.');

  if (entry.seoStatus !== 'approved') {
    warnings.push(`SEO status is ${entry.seoStatus}; page is excluded from the video sitemap.`);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

export function isVideoSeoEditorialApproved(
  entry: VideoSeoEditorialEntry | null | undefined,
  context: VideoSeoEditorialQaContext = {}
): boolean {
  return Boolean(entry && entry.seoStatus === 'approved' && validateVideoSeoEditorialEntry(entry, context).passed);
}
