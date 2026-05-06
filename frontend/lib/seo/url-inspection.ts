import type {
  ContentMomentumItem,
  CtrDoctorItem,
  InternalLinkSuggestion,
  MissingContentItem,
  StrategicSeoOpportunity,
  UrlInspectionGroup,
  UrlInspectionItem,
  UrlInspectionSeverity,
  UrlInspectionStatus,
  UrlInspectionTarget,
  UrlInspectionTargetSource,
} from './internal-seo-types';
import { stripOrigin } from './seo-opportunity-engine';

const SITE_ORIGIN = 'https://maxvideoai.com';
const MAX_CURATED_TARGETS = 30;
const RECENT_INSPECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

export const MANUAL_URL_INSPECTION_TARGETS: UrlInspectionTarget[] = [
  ...buildTargets(['/', '/models', '/examples', '/ai-video-engines', '/pricing'], 'core', ['manual']),
  ...buildTargets(
    [
      '/models/seedance-2-0',
      '/models/seedance-2-0-fast',
      '/models/kling-3-pro',
      '/models/veo-3-1',
      '/models/ltx-2-3-pro',
      '/models/ltx-2-3-fast',
    ],
    'strategic-models',
    ['manual', 'strategic']
  ),
  ...buildTargets(['/examples/ltx', '/examples/seedance', '/examples/kling', '/examples/veo'], 'examples', ['manual']),
  ...buildTargets(
    [
      '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
      '/ai-video-engines/seedance-1-5-pro-vs-seedance-2-0',
      '/ai-video-engines/ltx-2-3-fast-vs-seedance-2-0',
    ],
    'comparisons',
    ['manual']
  ),
];

type BuildCuratedUrlInspectionTargetsOptions = {
  opportunities?: StrategicSeoOpportunity[];
  ctrDoctorItems?: CtrDoctorItem[];
  missingContentItems?: MissingContentItem[];
  internalLinkSuggestions?: InternalLinkSuggestion[];
  momentumItems?: ContentMomentumItem[];
  origin?: string;
};

type GoogleUrlInspectionResult = {
  inspectionResultLink?: string;
  indexStatusResult?: {
    sitemap?: string[];
    verdict?: string;
    coverageState?: string;
    robotsTxtState?: string;
    indexingState?: string;
    lastCrawlTime?: string;
    pageFetchState?: string;
    googleCanonical?: string;
    userCanonical?: string;
  };
  mobileUsabilityResult?: {
    verdict?: string;
    issues?: unknown[];
  };
  richResultsResult?: {
    verdict?: string;
    detectedItems?: Array<{ richResultType?: string; items?: unknown[] }>;
    issues?: unknown[];
  };
};

export function buildCuratedUrlInspectionTargets(options: BuildCuratedUrlInspectionTargetsOptions = {}): UrlInspectionTarget[] {
  const origin = normalizeOrigin(options.origin ?? SITE_ORIGIN);
  const targets = new Map<string, UrlInspectionTarget>();

  for (const target of MANUAL_URL_INSPECTION_TARGETS) {
    addTarget(targets, { ...target, url: absoluteUrl(target.path, origin) });
  }

  for (const opportunity of options.opportunities ?? []) {
    addSignalTarget(targets, opportunity.targetUrl, 'opportunity', 'opportunities', origin);
  }
  for (const item of options.ctrDoctorItems ?? []) {
    addSignalTarget(targets, item.targetUrl, 'ctr', 'opportunities', origin);
  }
  for (const item of options.missingContentItems ?? []) {
    addSignalTarget(targets, item.targetUrl, 'missing_content', 'opportunities', origin);
  }
  for (const item of options.internalLinkSuggestions ?? []) {
    addSignalTarget(targets, item.sourceUrl, 'internal_link', 'opportunities', origin);
    addSignalTarget(targets, item.targetUrl, 'internal_link', 'opportunities', origin);
  }
  for (const item of options.momentumItems ?? []) {
    addSignalTarget(targets, item.pageUrl, 'momentum', 'opportunities', origin);
  }

  return Array.from(targets.values()).slice(0, MAX_CURATED_TARGETS);
}

export function normalizeUrlInspectionItem(args: {
  target: UrlInspectionTarget;
  inspectedAt: string;
  raw: GoogleUrlInspectionResult;
}): UrlInspectionItem {
  const index = args.raw.indexStatusResult ?? {};
  const status = normalizeUrlInspectionStatus(index);
  const googleCanonical = index.googleCanonical ?? null;
  const userCanonical = index.userCanonical ?? null;
  const canonicalMatches = googleCanonical && userCanonical ? canonicalUrlMatches(googleCanonical, userCanonical) : null;
  const finalStatus = status === 'indexed_ok' && canonicalMatches === false ? 'indexed_canonical_mismatch' : status;

  return {
    ...args.target,
    lastInspectedAt: args.inspectedAt,
    status: finalStatus,
    severity: severityForStatus(finalStatus),
    indexVerdict: index.verdict ?? null,
    coverageState: index.coverageState ?? null,
    robotsTxtState: index.robotsTxtState ?? null,
    indexingState: index.indexingState ?? null,
    pageFetchState: index.pageFetchState ?? null,
    googleCanonical,
    userCanonical,
    canonicalMatches,
    lastCrawlTime: index.lastCrawlTime ?? null,
    sitemapPresent: Array.isArray(index.sitemap) ? index.sitemap.length > 0 : null,
    sitemaps: index.sitemap ?? [],
    mobileUsabilityStatus: args.raw.mobileUsabilityResult?.verdict ?? null,
    richResultsStatus: args.raw.richResultsResult?.verdict ?? null,
    richResultTypes: (args.raw.richResultsResult?.detectedItems ?? [])
      .map((item) => item.richResultType)
      .filter((value): value is string => Boolean(value)),
    inspectionResultLink: args.raw.inspectionResultLink ?? null,
    suggestedAction: suggestedActionForStatus(finalStatus),
    raw: args.raw,
  };
}

export function createPendingUrlInspectionItem(target: UrlInspectionTarget, cached?: UrlInspectionItem | null): UrlInspectionItem {
  if (cached) {
    return {
      ...cached,
      ...target,
      sources: Array.from(new Set([...target.sources, ...cached.sources])),
    };
  }
  return {
    ...target,
    lastInspectedAt: null,
    status: 'unknown',
    severity: 'unknown',
    indexVerdict: null,
    coverageState: null,
    robotsTxtState: null,
    indexingState: null,
    pageFetchState: null,
    googleCanonical: null,
    userCanonical: null,
    canonicalMatches: null,
    lastCrawlTime: null,
    sitemapPresent: null,
    sitemaps: [],
    mobileUsabilityStatus: null,
    richResultsStatus: null,
    richResultTypes: [],
    inspectionResultLink: null,
    suggestedAction: 'Inspect this curated URL manually before making indexation decisions.',
    raw: null,
  };
}

export function shouldSkipRecentUrlInspection(
  lastInspectedAt: string | null | undefined,
  now = new Date(),
  maxAgeMs = RECENT_INSPECTION_WINDOW_MS
) {
  if (!lastInspectedAt) return false;
  const inspectedTime = new Date(lastInspectedAt).getTime();
  if (!Number.isFinite(inspectedTime)) return false;
  return now.getTime() - inspectedTime < maxAgeMs;
}

export function formatUrlInspectionSectionMarkdown(items: UrlInspectionItem[]): string {
  if (!items.length) {
    return ['# URL Inspection', '', 'No URL Inspection items generated for this snapshot.'].join('\n');
  }

  return [
    '# URL Inspection',
    '',
    `Curated URLs: ${items.length}`,
    '',
    ...items.map((item, index) => [
      `## ${index + 1}. ${item.path}`,
      '',
      `Status: ${labelizeUrlInspectionStatus(item.status)}`,
      `Severity: ${item.severity}`,
      `Last inspected: ${item.lastInspectedAt ?? 'Not inspected yet'}`,
      `Google canonical: ${item.googleCanonical ?? 'Unknown'}`,
      `User canonical: ${item.userCanonical ?? 'Unknown'}`,
      `Last crawl: ${item.lastCrawlTime ?? 'Unknown'}`,
      `Coverage: ${item.coverageState ?? 'Unknown'}`,
      '',
      `Suggested action: ${item.suggestedAction}`,
    ].join('\n')),
  ].join('\n\n');
}

export function sanitizeUrlInspectionItemsForExport(items: UrlInspectionItem[]): UrlInspectionItem[] {
  return items.map((item) => ({
    ...item,
    inspectionResultLink: null,
    raw: sanitizeRawInspectionResult(item.raw),
  }));
}

export function labelizeUrlInspectionStatus(status: UrlInspectionStatus) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function labelizeUrlInspectionGroup(group: UrlInspectionGroup) {
  if (group === 'strategic-models') return 'Strategic models';
  return group.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeUrlInspectionStatus(index: GoogleUrlInspectionResult['indexStatusResult'] = {}): UrlInspectionStatus {
  const coverage = (index.coverageState ?? '').toLowerCase();
  if (index.robotsTxtState === 'DISALLOWED' || index.pageFetchState === 'BLOCKED_ROBOTS_TXT') return 'blocked_by_robots';
  if (index.indexingState === 'BLOCKED_BY_META_TAG' || index.indexingState === 'BLOCKED_BY_HTTP_HEADER') return 'noindex';
  if (index.pageFetchState === 'NOT_FOUND' || coverage.includes('not found') || coverage.includes('404')) return 'not_found';
  if (index.pageFetchState === 'SERVER_ERROR') return 'server_error';
  if (index.pageFetchState === 'REDIRECT_ERROR' || coverage.includes('redirect')) return 'redirect';
  if (coverage.includes('discovered') && coverage.includes('not indexed')) return 'discovered_not_indexed';
  if (coverage.includes('crawled') && coverage.includes('not indexed')) return 'crawled_not_indexed';
  if (index.verdict === 'PASS') return 'indexed_ok';
  if (index.verdict === 'FAIL' || index.verdict === 'NEUTRAL') return 'not_indexed';
  return 'unknown';
}

function severityForStatus(status: UrlInspectionStatus): UrlInspectionSeverity {
  if (status === 'indexed_ok') return 'ok';
  if (status === 'unknown') return 'unknown';
  if (status === 'discovered_not_indexed' || status === 'crawled_not_indexed' || status === 'indexed_canonical_mismatch' || status === 'redirect') {
    return 'warning';
  }
  if (status === 'not_indexed' || status === 'blocked_by_robots' || status === 'noindex' || status === 'not_found' || status === 'server_error') {
    return 'critical';
  }
  return 'info';
}

function suggestedActionForStatus(status: UrlInspectionStatus) {
  if (status === 'indexed_ok') return 'No immediate action. Monitor canonical, crawl recency, and rich result signals.';
  if (status === 'indexed_canonical_mismatch') return 'Review canonical tags, internal links, and duplicate page signals; confirm the Google-selected canonical is intended.';
  if (status === 'crawled_not_indexed') return 'Strengthen content quality, internal links, and page uniqueness before requesting indexing manually if important.';
  if (status === 'discovered_not_indexed') return 'Improve internal links and sitemap discovery signals; inspect again later or request indexing manually for a priority URL.';
  if (status === 'blocked_by_robots') return 'Verify whether robots.txt blocking is intentional for this priority URL.';
  if (status === 'noindex') return 'Verify whether noindex is intentional. Remove only if this priority URL should be indexable.';
  if (status === 'redirect') return 'Check canonical, sitemap, and internal links so they point to the final intended URL.';
  if (status === 'not_found') return 'Check whether the URL should exist. Fix sitemap/canonical/internal links or restore/redirect the page.';
  if (status === 'server_error') return 'Investigate server errors for Googlebot and verify the page can be fetched reliably.';
  if (status === 'not_indexed') return 'Review the raw coverage state and decide whether content, indexability, or internal-link improvements are needed.';
  return 'Inspect this curated URL manually before making indexation decisions.';
}

function addSignalTarget(
  targets: Map<string, UrlInspectionTarget>,
  value: string | null | undefined,
  source: UrlInspectionTargetSource,
  group: UrlInspectionGroup,
  origin: string
) {
  const path = normalizePath(value);
  if (!path || shouldIgnorePath(path)) return;
  addTarget(targets, { path, url: absoluteUrl(path, origin), group, sources: [source] });
}

function addTarget(targets: Map<string, UrlInspectionTarget>, target: UrlInspectionTarget) {
  const path = normalizePath(target.path);
  if (!path || shouldIgnorePath(path)) return;
  const existing = targets.get(path);
  if (existing) {
    targets.set(path, {
      ...existing,
      sources: Array.from(new Set([...existing.sources, ...target.sources])),
      group: existing.group === 'opportunities' ? target.group : existing.group,
    });
    return;
  }
  targets.set(path, { ...target, path, url: absoluteUrl(path, normalizeOrigin(target.url)) });
}

function buildTargets(paths: string[], group: UrlInspectionGroup, sources: UrlInspectionTargetSource[]): UrlInspectionTarget[] {
  return paths.map((path) => ({ path, url: absoluteUrl(path), group, sources }));
}

function normalizePath(value: string | null | undefined) {
  if (!value) return null;
  const path = stripOrigin(value).split('?')[0].replace(/\/$/, '') || '/';
  if (!path.startsWith('/')) return null;
  return path;
}

function shouldIgnorePath(path: string) {
  return path.startsWith('/api/') || path.startsWith('/admin/') || path.includes('*') || path.includes('[');
}

function absoluteUrl(path: string, origin = SITE_ORIGIN) {
  const normalizedOrigin = normalizeOrigin(origin);
  return `${normalizedOrigin}${path === '/' ? '/' : path}`;
}

function normalizeOrigin(value: string) {
  try {
    const parsed = new URL(value.startsWith('http') ? value : SITE_ORIGIN);
    return `${parsed.protocol}//${parsed.host}`.replace(/\/$/, '');
  } catch {
    return SITE_ORIGIN;
  }
}

function canonicalUrlMatches(left: string, right: string) {
  return normalizeCanonical(left) === normalizeCanonical(right);
}

function normalizeCanonical(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, '') || '/'}${parsed.search}`;
  } catch {
    return value.replace(/\/$/, '');
  }
}

function sanitizeRawInspectionResult(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const rest = { ...(raw as Record<string, unknown>) };
  delete rest.inspectionResultLink;
  return rest;
}
