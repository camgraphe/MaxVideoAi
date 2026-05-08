import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import type { ExampleSort } from '@/server/videos';
import { appendTrackingParams, DEFAULT_SORT } from './examples-route-utils';

type ExamplesSearchParams = Record<string, string | string[] | undefined>;
type ExamplesPaginationHref = string | { pathname: '/examples'; query?: Record<string, string> };

export function buildExamplesEngineFilterHref({
  engineId,
  galleryBasePath,
}: {
  engineId: string | null;
  galleryBasePath: string;
}): string {
  if (!engineId) {
    return galleryBasePath;
  }
  const canonicalSlug = resolveExampleCanonicalSlug(engineId);
  if (canonicalSlug) {
    return `${galleryBasePath}/${canonicalSlug}`;
  }
  const query = new URLSearchParams();
  query.set('engine', engineId);
  const suffix = query.toString();
  return suffix ? `${galleryBasePath}?${suffix}` : galleryBasePath;
}

export function buildExamplesPaginationHref({
  engineFromPath,
  galleryBasePath,
  modelLandingSlug,
  selectedEngine,
  sort,
  targetPage,
}: {
  engineFromPath: string;
  galleryBasePath: string;
  modelLandingSlug?: string;
  selectedEngine: string | null;
  sort: ExampleSort;
  targetPage: number;
}): ExamplesPaginationHref {
  const query = buildExamplesQueryParams({
    engineFromPath,
    engineValue: selectedEngine,
    pageValue: targetPage,
    sort,
  });
  if (engineFromPath && modelLandingSlug) {
    const modelPath = `${galleryBasePath}/${modelLandingSlug}`;
    if (!query) return modelPath;
    const params = new URLSearchParams(query);
    const suffix = params.toString();
    return suffix ? `${modelPath}?${suffix}` : modelPath;
  }
  return {
    pathname: '/examples' as const,
    query,
  };
}

export function buildExamplesQueryParams({
  engineFromPath,
  engineValue,
  pageValue,
  sort,
}: {
  engineFromPath: string;
  engineValue: string | null;
  pageValue?: number;
  sort: ExampleSort;
}): Record<string, string> | undefined {
  const query: Record<string, string> = {};
  if (sort !== DEFAULT_SORT) {
    query.sort = sort;
  }
  if (engineValue && !engineFromPath) {
    query.engine = engineValue;
  }
  if (pageValue && pageValue > 1) {
    query.page = String(pageValue);
  }
  return Object.keys(query).length ? query : undefined;
}

export function buildExamplesNormalizedRedirectTarget({
  currentPage,
  engineFromPath,
  galleryBasePath,
  modelLandingSlug,
  searchParams,
  sort,
  targetPage,
}: {
  currentPage?: number;
  engineFromPath: string;
  galleryBasePath: string;
  modelLandingSlug?: string;
  searchParams: ExamplesSearchParams;
  sort: ExampleSort;
  targetPage: number;
}) {
  const normalizedBasePath =
    engineFromPath && modelLandingSlug ? `${galleryBasePath}/${modelLandingSlug}` : galleryBasePath;
  const redirectedQuery = new URLSearchParams();
  appendTrackingParams(redirectedQuery, searchParams);
  if (sort !== DEFAULT_SORT) {
    redirectedQuery.set('sort', sort);
  }
  const normalizedPage = currentPage ?? targetPage;
  if (normalizedPage > 1) {
    redirectedQuery.set('page', String(normalizedPage));
  }
  const target = redirectedQuery.toString()
    ? `${normalizedBasePath}?${redirectedQuery.toString()}`
    : normalizedBasePath;
  return target;
}
