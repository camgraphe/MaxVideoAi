import compareHubConfig from '@/config/compare-hub.json';
import engineCatalog from '@/config/engine-catalog.json';

const EXCLUDED_ENGINE_SLUGS = new Set(['nano-banana', 'nano-banana-pro']);
const ELIGIBLE_STATUSES = new Set(['live', 'early_access']);
const VIDEO_MODES = new Set(['t2v', 'i2v', 'v2v', 'r2v']);
const LEGACY_UNAVAILABLE = new Set(['paused']);

export type HubEngine = {
  modelSlug: string;
  marketingName: string;
  provider: string;
  availability: string;
  status: string;
  modes: string[];
  audio: boolean;
  maxDurationSec: number | null;
  maxResolutionLabel: string;
  maxResolutionValue: number | null;
  bestFor: string | null;
};

export type HubPair = {
  leftSlug: string;
  rightSlug: string;
  slug: string;
  leftName: string;
  rightName: string;
  label: string;
};

export type CompareRoute = {
  slug: string;
  order?: string;
};

type PairSeed = {
  left: string;
  right: string;
  tags?: string[];
};

type UseCaseBucketSeed = {
  id: string;
  pairs: PairSeed[];
};

type CompareHubConfig = {
  popularComparisons: PairSeed[];
  useCaseBuckets: UseCaseBucketSeed[];
  opponentOverrides?: Record<string, string[]>;
};

export type HubPopularComparison = HubPair & {
  tags: string[];
};

export type HubUseCaseBucket = {
  id: string;
  pairs: HubPair[];
};

type CatalogEngine = (typeof engineCatalog)[number];
type HubEngineFilterOptions = {
  includeLimited?: boolean;
  includeWaitlist?: boolean;
  includeUnavailable?: boolean;
};

const hubConfig = compareHubConfig as CompareHubConfig;
const catalogEntries = engineCatalog as CatalogEngine[];

function normalizeMode(mode: string): string {
  if (mode === 'r2v') return 'v2v';
  return mode;
}

function parseResolutionValue(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'auto') return null;
  if (normalized.includes('4k')) return 2160;
  const pMatch = normalized.match(/(\d{3,4})p/);
  if (pMatch) {
    const parsed = Number(pMatch[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const dimMatch = normalized.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/);
  if (dimMatch) {
    const width = Number(dimMatch[1]);
    const height = Number(dimMatch[2]);
    if (Number.isFinite(width) && Number.isFinite(height)) {
      return Math.max(width, height);
    }
  }
  return null;
}

function resolveMaxResolution(resolutions: string[] | undefined): { label: string; value: number | null } {
  const list = Array.isArray(resolutions) ? resolutions : [];
  let bestValue: number | null = null;
  let bestLabel = 'Unknown';

  list.forEach((entry) => {
    const value = parseResolutionValue(entry);
    if (value == null) return;
    if (bestValue == null || value > bestValue) {
      bestValue = value;
      bestLabel = entry;
    }
  });

  if (bestValue == null) {
    return { label: 'Unknown', value: null };
  }

  return { label: bestLabel, value: bestValue };
}

function isHubEligibleEngine(entry: CatalogEngine, options: HubEngineFilterOptions = {}): boolean {
  if (!entry?.modelSlug || EXCLUDED_ENGINE_SLUGS.has(entry.modelSlug)) return false;
  const status = String(entry.engine?.status ?? '').toLowerCase();
  if (!ELIGIBLE_STATUSES.has(status)) return false;
  const availability = String(entry.availability ?? '').toLowerCase();
  const allowedAvailability = new Set<string>(['available']);
  if (options.includeLimited) allowedAvailability.add('limited');
  if (options.includeWaitlist) allowedAvailability.add('waitlist');
  if (options.includeUnavailable) {
    allowedAvailability.add('unavailable');
    LEGACY_UNAVAILABLE.forEach((value) => allowedAvailability.add(value));
  }
  if (!allowedAvailability.has(availability)) return false;
  const modes = entry.engine?.modes ?? [];
  return modes.some((mode) => VIDEO_MODES.has(mode));
}

export function canonicalizeComparePair(leftSlug: string, rightSlug: string): { leftSlug: string; rightSlug: string } {
  const [left, right] = [leftSlug, rightSlug].sort((a, b) => a.localeCompare(b));
  return { leftSlug: left, rightSlug: right };
}

export function buildCanonicalCompareSlug(leftSlug: string, rightSlug: string): string {
  const { leftSlug: left, rightSlug: right } = canonicalizeComparePair(leftSlug, rightSlug);
  return `${left}-vs-${right}`;
}

export function buildCompareRoute(leftSlug: string, rightSlug: string): CompareRoute {
  const { leftSlug: canonicalLeft, rightSlug: canonicalRight } = canonicalizeComparePair(leftSlug, rightSlug);
  const slug = `${canonicalLeft}-vs-${canonicalRight}`;
  return {
    slug,
    order: canonicalLeft === leftSlug ? undefined : leftSlug,
  };
}

export function getHubEngines(options: HubEngineFilterOptions = {}): HubEngine[] {
  return catalogEntries
    .filter((entry) => isHubEligibleEngine(entry, options))
    .map((entry) => {
      const maxResolution = resolveMaxResolution(entry.engine?.resolutions as string[] | undefined);
      const modes = Array.from(new Set((entry.engine?.modes ?? []).map((mode) => normalizeMode(String(mode)))));
      return {
        modelSlug: entry.modelSlug,
        marketingName: entry.marketingName,
        provider: entry.provider,
        availability: String(entry.availability ?? 'unknown'),
        status: String(entry.engine?.status ?? 'unknown'),
        modes,
        audio: Boolean(entry.engine?.audio),
        maxDurationSec: typeof entry.engine?.maxDurationSec === 'number' ? entry.engine.maxDurationSec : null,
        maxResolutionLabel: maxResolution.label,
        maxResolutionValue: maxResolution.value,
        bestFor: entry.bestFor ?? null,
      };
    })
    .sort((a, b) => a.marketingName.localeCompare(b.marketingName, 'en'));
}

function buildPair(leftSlug: string, rightSlug: string, enginesBySlug: Map<string, HubEngine>): HubPair | null {
  const left = enginesBySlug.get(leftSlug);
  const right = enginesBySlug.get(rightSlug);
  if (!left || !right || left.modelSlug === right.modelSlug) return null;

  const { leftSlug: canonicalLeft, rightSlug: canonicalRight } = canonicalizeComparePair(left.modelSlug, right.modelSlug);
  const canonicalLeftEngine = enginesBySlug.get(canonicalLeft);
  const canonicalRightEngine = enginesBySlug.get(canonicalRight);
  if (!canonicalLeftEngine || !canonicalRightEngine) return null;

  return {
    leftSlug: canonicalLeft,
    rightSlug: canonicalRight,
    slug: `${canonicalLeft}-vs-${canonicalRight}`,
    leftName: canonicalLeftEngine.marketingName,
    rightName: canonicalRightEngine.marketingName,
    label: `${canonicalLeftEngine.marketingName} vs ${canonicalRightEngine.marketingName}`,
  };
}

export function getAllCanonicalPairs(engines: HubEngine[] = getHubEngines()): HubPair[] {
  const enginesBySlug = new Map(engines.map((engine) => [engine.modelSlug, engine]));
  const slugs = engines.map((engine) => engine.modelSlug).sort((a, b) => a.localeCompare(b));
  const pairs: HubPair[] = [];

  slugs.forEach((leftSlug, index) => {
    slugs.slice(index + 1).forEach((rightSlug) => {
      const pair = buildPair(leftSlug, rightSlug, enginesBySlug);
      if (pair) pairs.push(pair);
    });
  });

  return pairs;
}

function dedupePairs(pairs: HubPair[]): HubPair[] {
  const seen = new Set<string>();
  const result: HubPair[] = [];
  pairs.forEach((pair) => {
    if (seen.has(pair.slug)) return;
    seen.add(pair.slug);
    result.push(pair);
  });
  return result;
}

export function getPopularComparisons(engines: HubEngine[] = getHubEngines()): HubPopularComparison[] {
  const enginesBySlug = new Map(engines.map((engine) => [engine.modelSlug, engine]));
  return hubConfig.popularComparisons
    .map((entry) => {
      const pair = buildPair(entry.left, entry.right, enginesBySlug);
      if (!pair) return null;
      return {
        ...pair,
        tags: Array.isArray(entry.tags) ? entry.tags.slice(0, 3) : [],
      };
    })
    .filter((entry): entry is HubPopularComparison => Boolean(entry));
}

export function getUseCaseBuckets(engines: HubEngine[] = getHubEngines()): HubUseCaseBucket[] {
  const enginesBySlug = new Map(engines.map((engine) => [engine.modelSlug, engine]));
  return hubConfig.useCaseBuckets
    .map((bucket) => {
      const pairs = dedupePairs(
        bucket.pairs
          .map((entry) => buildPair(entry.left, entry.right, enginesBySlug))
          .filter((entry): entry is HubPair => Boolean(entry))
      );
      if (!pairs.length) return null;
      return {
        id: bucket.id,
        pairs: pairs.slice(0, 3),
      };
    })
    .filter((entry): entry is HubUseCaseBucket => Boolean(entry));
}

export function getSuggestedOpponents(
  engineSlug: string,
  engines: HubEngine[] = getHubEngines(),
  maxCount = 3
): HubEngine[] {
  const enginesBySlug = new Map(engines.map((engine) => [engine.modelSlug, engine]));
  const overrideSlugs = hubConfig.opponentOverrides?.[engineSlug] ?? [];
  const fromOverrides = overrideSlugs
    .map((slug) => enginesBySlug.get(slug))
    .filter((entry): entry is HubEngine => entry != null)
    .filter((entry) => entry.modelSlug !== engineSlug);

  if (fromOverrides.length >= maxCount) {
    return fromOverrides.slice(0, maxCount);
  }

  const fallback = engines
    .filter((engine) => engine.modelSlug !== engineSlug)
    .filter((engine) => !fromOverrides.some((entry) => entry.modelSlug === engine.modelSlug))
    .slice(0, maxCount - fromOverrides.length);

  return [...fromOverrides, ...fallback].slice(0, maxCount);
}

export function getRankedComparisonPairs(engines: HubEngine[] = getHubEngines()): HubPair[] {
  const allPairs = getAllCanonicalPairs(engines);
  const allBySlug = new Map(allPairs.map((pair) => [pair.slug, pair]));

  const prioritizedSeeds: HubPair[] = [
    ...getPopularComparisons(engines),
    ...getUseCaseBuckets(engines).flatMap((bucket) => bucket.pairs),
  ];
  const prioritized = dedupePairs(prioritizedSeeds.map((pair) => allBySlug.get(pair.slug)).filter((pair): pair is HubPair => Boolean(pair)));

  const prioritizedSet = new Set(prioritized.map((pair) => pair.slug));
  const remainder = allPairs
    .filter((pair) => !prioritizedSet.has(pair.slug))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));

  return [...prioritized, ...remainder];
}

export function getHubComparisonSlugsForSitemap(): string[] {
  return getAllCanonicalPairs(
    getHubEngines({
      includeLimited: true,
      includeWaitlist: true,
      includeUnavailable: true,
    })
  ).map((pair) => pair.slug);
}
