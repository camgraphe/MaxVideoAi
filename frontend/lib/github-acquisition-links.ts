import attributionMap from '../../docs/marketing/github-attribution-map.json';

type GithubSurface = keyof typeof attributionMap.surfaces;
type WebsiteDestination = keyof typeof attributionMap.destinations;
type GithubLocale = keyof typeof attributionMap.locales;

export type GithubAcquisitionLinkInput = {
  surface: GithubSurface;
  destination: WebsiteDestination;
  content: string;
  locale?: GithubLocale;
};

const INPUT_KEYS = new Set(['surface', 'destination', 'content', 'locale']);

function hasOnlyExpectedInputKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => INPUT_KEYS.has(key));
}

function isGithubSurface(value: unknown): value is GithubSurface {
  return typeof value === 'string' && value in attributionMap.surfaces;
}

function isWebsiteDestination(value: unknown): value is WebsiteDestination {
  return typeof value === 'string' && value in attributionMap.destinations;
}

function isGithubLocale(value: unknown): value is GithubLocale {
  return typeof value === 'string' && value in attributionMap.locales;
}

function pathFor(destination: WebsiteDestination, locale: GithubLocale): string | null {
  const contract = attributionMap.destinations[destination];
  if ('path' in contract) return contract.path;
  const slug = contract.localizedSlugs[locale];
  const prefix = attributionMap.locales[locale];
  return slug ? `/${[prefix, slug].filter(Boolean).join('/')}` : null;
}

/**
 * Builds the only tracked URLs permitted on GitHub-owned surfaces. Inputs are
 * intentionally identifiers rather than URLs so callers cannot add fragments,
 * duplicate query values, foreign origins, or private acquisition data.
 */
export function buildGithubAcquisitionUrl(input: GithubAcquisitionLinkInput): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const candidate = input as Record<string, unknown>;
  if (
    !hasOnlyExpectedInputKeys(candidate)
    || !isGithubSurface(candidate.surface)
    || !isWebsiteDestination(candidate.destination)
    || typeof candidate.content !== 'string'
    || (candidate.locale !== undefined && !isGithubLocale(candidate.locale))
  ) {
    return null;
  }

  const surface = attributionMap.surfaces[candidate.surface];
  // A listing must name a reviewed canonical target before it receives a URL.
  // No external listing is approved in this repository yet.
  if (surface.source === 'canonical_target_name' || !surface.contents.includes(candidate.content)) return null;

  const path = pathFor(candidate.destination, candidate.locale ?? 'en');
  if (!path) return null;

  const url = new URL(path, attributionMap.websiteOrigin);
  url.searchParams.set('utm_source', surface.source);
  url.searchParams.set('utm_medium', surface.medium);
  url.searchParams.set('utm_campaign', surface.campaign);
  url.searchParams.set('utm_content', candidate.content);
  return url.toString();
}
