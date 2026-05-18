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

function uniqueBlockers(blockers: VideoSeoCanonicalBlocker[]): VideoSeoCanonicalBlocker[] {
  return Array.from(new Set(blockers));
}

function hasCanonicalConflicts(value: VideoSeoCanonicalValidationInput['canonicalConflictIds']): boolean {
  if (!value) return false;
  if ('size' in value) return value.size > 0;
  return value.length > 0;
}

export function buildExpectedVideoCanonicalUrl(videoId: string): string {
  return `${CANONICAL_PRODUCTION_ORIGIN}/video/${encodeURIComponent(videoId)}`;
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
