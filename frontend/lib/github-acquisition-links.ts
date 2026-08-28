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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExpectedOwnFields(value: Record<string, unknown>): boolean {
  return ['surface', 'destination', 'content'].every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => INPUT_KEYS.has(key));
}

function isGithubSurface(value: unknown): value is GithubSurface {
  return typeof value === 'string' && Object.hasOwn(attributionMap.surfaces, value);
}

function isWebsiteDestination(value: unknown): value is WebsiteDestination {
  return typeof value === 'string' && Object.hasOwn(attributionMap.destinations, value);
}

function isGithubLocale(value: unknown): value is GithubLocale {
  return typeof value === 'string' && Object.hasOwn(attributionMap.locales, value);
}

function pathFor(destination: WebsiteDestination, locale: GithubLocale): string | null {
  const contract = attributionMap.destinations[destination];
  if ('path' in contract) return contract.path;
  if (!Object.hasOwn(contract.localizedSlugs, locale) || !Object.hasOwn(attributionMap.locales, locale)) return null;
  const slug = contract.localizedSlugs[locale];
  const prefix = attributionMap.locales[locale];
  return slug ? `/${[prefix, slug].filter(Boolean).join('/')}` : null;
}

/**
 * Builds the only tracked URLs permitted on GitHub-owned surfaces. Inputs are
 * intentionally identifiers rather than URLs so callers cannot add fragments,
 * duplicate query values, foreign origins, or private acquisition data.
 */
export function buildGithubAcquisitionUrl(input: unknown): string | null {
  try {
    if (!isPlainRecord(input) || !hasExpectedOwnFields(input)) return null;
    const candidate = input;
    if (
      !isGithubSurface(candidate.surface)
      || !isWebsiteDestination(candidate.destination)
      || typeof candidate.content !== 'string'
      || (Object.hasOwn(candidate, 'locale') && !isGithubLocale(candidate.locale))
    ) {
      return null;
    }

    const surface = attributionMap.surfaces[candidate.surface];
    // A listing must name a reviewed canonical target before it receives a URL.
    // No external listing is approved in this repository yet.
    if (surface.source === 'canonical_target_name' || !surface.contents.includes(candidate.content)) return null;

    const path = pathFor(candidate.destination, Object.hasOwn(candidate, 'locale') ? candidate.locale as GithubLocale : 'en');
    if (!path) return null;

    const url = new URL(path, attributionMap.websiteOrigin);
    url.searchParams.set('utm_source', surface.source);
    url.searchParams.set('utm_medium', surface.medium);
    url.searchParams.set('utm_campaign', surface.campaign);
    url.searchParams.set('utm_content', candidate.content);
    return url.toString();
  } catch {
    return null;
  }
}
