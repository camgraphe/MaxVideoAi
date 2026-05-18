import { CANONICAL_PRODUCTION_ORIGIN } from '@/lib/siteOrigin';
import { isSignedMediaUrl, isTemporaryProviderMediaUrl } from '@/lib/media';

export type VideoSeoCanonicalBlocker =
  | 'missing_canonical'
  | 'canonical_mismatch'
  | 'canonical_conflict'
  | 'canonical_target_not_indexable';

export type VideoSeoCanonicalValidationInput = {
  videoId: string;
  canonicalUrl?: string | null;
  expectedCanonicalUrl?: string | null;
  canonicalTargetIndexable?: boolean;
  canonicalConflictIds?: ReadonlySet<string> | readonly string[] | null;
};

export type VideoSeoCanonicalValidationResult = {
  passed: boolean;
  canonicalUrl: string | null;
  expectedCanonicalUrl: string;
  blockers: VideoSeoCanonicalBlocker[];
  blockerLabels: string[];
};

const CANONICAL_BLOCKER_LABELS: Record<VideoSeoCanonicalBlocker, string> = {
  missing_canonical: 'Missing canonical',
  canonical_mismatch: 'Canonical mismatch',
  canonical_conflict: 'Canonical conflict',
  canonical_target_not_indexable: 'Canonical target not indexable',
};

const PRIVATE_CANONICAL_PATH_PATTERN = /^\/(?:api|admin|app|billing|connect|dashboard|generate|jobs|settings)(?:\/|$)/i;
const PRODUCTION_CANONICAL_HOST = new URL(CANONICAL_PRODUCTION_ORIGIN).hostname.toLowerCase();
const MAX_VIDEO_CANONICAL_SLUG_LENGTH = 96;

function uniqueBlockers(blockers: VideoSeoCanonicalBlocker[]): VideoSeoCanonicalBlocker[] {
  return Array.from(new Set(blockers));
}

function hasCanonicalConflicts(value: VideoSeoCanonicalValidationInput['canonicalConflictIds']): boolean {
  if (!value) return false;
  if ('size' in value) return value.size > 0;
  return value.length > 0;
}

function trimSlug(value: string): string {
  return value
    .slice(0, MAX_VIDEO_CANONICAL_SLUG_LENGTH)
    .replace(/-+$/g, '')
    .replace(/^-+/g, '');
}

function getShortVideoId(videoId: string): string {
  const normalized = videoId.replace(/^job[_-]/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return normalized.slice(0, 8) || 'video';
}

function decodeIdentifier(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeVideoSeoCanonicalSlug(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bmax\s*video\s*ai\b/gi, ' ')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  if (/^job-[a-z0-9-]+$/i.test(normalized)) return '';
  return trimSlug(normalized);
}

export function buildDefaultVideoSeoCanonicalSlug(input: {
  videoId: string;
  title?: string | null;
  h1?: string | null;
  videoObjectName?: string | null;
  targetKeyword?: string | null;
}): string {
  const source =
    input.title?.trim() ||
    input.h1?.trim() ||
    input.videoObjectName?.trim() ||
    input.targetKeyword?.trim() ||
    'video example';
  const base = normalizeVideoSeoCanonicalSlug(source) || 'video-example';
  const suffix = getShortVideoId(input.videoId);
  if (base.endsWith(`-${suffix}`)) return base;

  const suffixWithDash = `-${suffix}`;
  const safeBase = trimSlug(base.slice(0, Math.max(1, MAX_VIDEO_CANONICAL_SLUG_LENGTH - suffixWithDash.length)));
  return `${safeBase || 'video-example'}${suffixWithDash}`;
}

export function buildVideoWatchPath(videoId: string, canonicalSlug?: string | null): string {
  const identifier = normalizeVideoSeoCanonicalSlug(canonicalSlug) || videoId;
  return `/video/${encodeURIComponent(identifier)}`;
}

export function buildExpectedVideoCanonicalUrl(videoId: string, canonicalSlug?: string | null): string {
  return `${CANONICAL_PRODUCTION_ORIGIN}${buildVideoWatchPath(videoId, canonicalSlug)}`;
}

export function getVideoCanonicalRedirectPath(input: {
  requestedIdentifier: string;
  videoId: string;
  canonicalSlug?: string | null;
  isEligible: boolean;
}): string | null {
  if (!input.isEligible) return null;
  const canonicalSlug = normalizeVideoSeoCanonicalSlug(input.canonicalSlug);
  if (!canonicalSlug) return null;
  const requested = normalizeVideoSeoCanonicalSlug(decodeIdentifier(input.requestedIdentifier));
  if (requested === canonicalSlug) return null;
  return buildVideoWatchPath(input.videoId, canonicalSlug);
}

export function validateVideoSeoCanonical(input: VideoSeoCanonicalValidationInput): VideoSeoCanonicalValidationResult {
  const expectedCanonicalUrl = input.expectedCanonicalUrl ?? buildExpectedVideoCanonicalUrl(input.videoId);
  const blockers: VideoSeoCanonicalBlocker[] = [];
  const canonicalUrl = typeof input.canonicalUrl === 'string' ? input.canonicalUrl.trim() : null;

  if (!canonicalUrl) {
    blockers.push('missing_canonical');
  } else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(canonicalUrl);
    } catch {
      blockers.push('canonical_mismatch');
    }

    if (parsed) {
      const expected = new URL(expectedCanonicalUrl);
      if (
        parsed.protocol !== 'https:' ||
        parsed.hostname.toLowerCase() !== PRODUCTION_CANONICAL_HOST ||
        parsed.pathname !== expected.pathname ||
        parsed.search ||
        parsed.hash ||
        PRIVATE_CANONICAL_PATH_PATTERN.test(parsed.pathname) ||
        isTemporaryProviderMediaUrl(canonicalUrl) ||
        isSignedMediaUrl(canonicalUrl)
      ) {
        blockers.push('canonical_mismatch');
      }
    }
  }

  if (hasCanonicalConflicts(input.canonicalConflictIds)) {
    blockers.push('canonical_conflict');
  }
  if (input.canonicalTargetIndexable === false) {
    blockers.push('canonical_target_not_indexable');
  }

  const unique = uniqueBlockers(blockers);
  return {
    passed: unique.length === 0,
    canonicalUrl,
    expectedCanonicalUrl,
    blockers: unique,
    blockerLabels: unique.map((blocker) => CANONICAL_BLOCKER_LABELS[blocker]),
  };
}
