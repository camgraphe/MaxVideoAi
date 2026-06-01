import {
  VIDEO_SEO_EDITORIAL_ENTRIES,
  type VideoSeoEditorialEntry,
} from '@/config/video-seo-editorial';
import { validateVideoSeoCanonical } from '@/lib/video-seo-canonical';

export type VideoSeoEditorialQaContext = {
  promptText?: string | null;
  isVisualReferenceWorkflow?: boolean;
  hasVisualReferenceAsset?: boolean;
  hasAudio?: boolean;
  hasMultiShot?: boolean;
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
const MIN_VISUAL_PROMPT_CONTEXT_WORDS = 80;
const MIN_VISUAL_PROMPT_CONTEXT_UNIQUE_WORDS = 45;
const VISUAL_SOURCE_PATTERN =
  /\b(source image|reference image|reference images|visual reference|reference frame|reference frames|storyboard|first frame|last frame|end frame)\b/i;
const VISUAL_WORKFLOW_PATTERN = /\b(image-to-video|storyboard-to-video|reference-to-video|first[- ]?last[- ]?frame)\b/i;
const CREATIVE_INTENT_PATTERN = /\b(creative|intent|intention|goal|planning|guide|define|direction|staging)\b/i;
const GENERATED_RESULT_PATTERN = /\b(generate|generates|generated|turns|creates|animated|animation|video|sequence|output|result)\b/i;
const AUDIO_CONTEXT_PATTERN = /\b(audio|dialogue|voice|sound|speech|music)\b/i;
const MULTI_SHOT_CONTEXT_PATTERN = /\b(multi[- ]?(prompt|shot)|shot|scene progression|scenes|sequence)\b/i;
const CONTINUITY_CONTEXT_PATTERN = /\b(continuity|scene structure|reference frames|storyboard|first frame|last frame|visual planning)\b/i;

export function countEditorialWords(value?: string | null): number {
  if (!value) return 0;
  return value.match(/[A-Za-z0-9][A-Za-z0-9'.-]*/g)?.length ?? 0;
}

function normalizeEditorialWords(value?: string | null): string[] {
  return (value?.match(/[A-Za-z0-9][A-Za-z0-9'.-]*/g) ?? [])
    .map((word) => word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter(Boolean);
}

function countUniqueEditorialWords(value?: string | null): number {
  return new Set(normalizeEditorialWords(value)).size;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textMentionsModel(value: string, modelSlug: string): boolean {
  const modelTerms = modelSlug
    .split(/[-_\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => /[a-z]/.test(part) && part.length >= 2);
  if (!modelTerms.length) return true;
  return modelTerms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(value));
}

export function resolveVideoSeoPromptContext(entry: VideoSeoEditorialEntry | null | undefined): string | null {
  const editorialBreakdown = entry?.editorialPromptBreakdown?.trim();
  if (editorialBreakdown) return editorialBreakdown;
  const shortDescription = entry?.shortDescription?.trim();
  return shortDescription || null;
}

function validateVisualPromptException(
  entry: VideoSeoEditorialEntry,
  context: VideoSeoEditorialQaContext
): string[] {
  const errors: string[] = [];
  const promptContext = resolveVideoSeoPromptContext(entry);

  if (entry.seoStatus !== 'approved') {
    errors.push('Short visual prompts require manual SEO approval.');
  }
  if (!context.isVisualReferenceWorkflow) {
    errors.push('Short prompt exception requires an image-to-video, storyboard, first-last-frame, or reference-to-video workflow.');
  }
  if (!context.hasVisualReferenceAsset) {
    errors.push('Short visual prompts require a source image, storyboard frame, first frame, last frame, or reference image.');
  }
  if (countEditorialWords(promptContext) < MIN_VISUAL_PROMPT_CONTEXT_WORDS) {
    errors.push(`Visual prompt SEO context must be at least ${MIN_VISUAL_PROMPT_CONTEXT_WORDS} words.`);
  }
  if (countUniqueEditorialWords(promptContext) < MIN_VISUAL_PROMPT_CONTEXT_UNIQUE_WORDS) {
    errors.push('Visual prompt SEO context must include enough unique detail.');
  }
  if (!promptContext || !VISUAL_SOURCE_PATTERN.test(promptContext)) {
    errors.push('Visual prompt SEO context must mention the source image, storyboard, first frame, last frame, or reference frame.');
  }
  if (!promptContext || !VISUAL_WORKFLOW_PATTERN.test(promptContext)) {
    errors.push('Visual prompt SEO context must mention the visual workflow.');
  }
  if (!promptContext || !textMentionsModel(promptContext, entry.modelSlug)) {
    errors.push('Visual prompt SEO context must mention the model used.');
  }
  if (!promptContext || !CREATIVE_INTENT_PATTERN.test(promptContext)) {
    errors.push('Visual prompt SEO context must describe the creative intent.');
  }
  if (!promptContext || !GENERATED_RESULT_PATTERN.test(promptContext)) {
    errors.push('Visual prompt SEO context must describe what the video generates.');
  }
  if (context.hasAudio && (!promptContext || !AUDIO_CONTEXT_PATTERN.test(promptContext))) {
    errors.push('Visual prompt SEO context must mention audio or dialogue when present.');
  }
  if (context.hasMultiShot && (!promptContext || !MULTI_SHOT_CONTEXT_PATTERN.test(promptContext))) {
    errors.push('Visual prompt SEO context must mention multi-shot or scene progression when present.');
  }
  if (!promptContext || !CONTINUITY_CONTEXT_PATTERN.test(promptContext)) {
    errors.push('Visual prompt SEO context must describe visual continuity or scene structure.');
  }

  return errors;
}

export function canUseVideoSeoVisualPromptException(
  entry: VideoSeoEditorialEntry | null | undefined,
  context: VideoSeoEditorialQaContext = {}
): boolean {
  return Boolean(entry && validateVisualPromptException(entry, context).length === 0);
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
    const visualPromptErrors = validateVisualPromptException(entry, context);
    if (visualPromptErrors.length) {
      errors.push(`Prompt is too short for video SEO (${countEditorialWords(context.promptText)} words).`);
      if (context.isVisualReferenceWorkflow) {
        errors.push(...visualPromptErrors);
      }
    }
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
