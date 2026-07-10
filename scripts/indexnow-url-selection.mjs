const EXCLUDED_ENGINE_SLUGS = new Set([
  'nano-banana',
  'nano-banana-lite',
  'nano-banana-pro',
  'nano-banana-2',
  'gpt-image-2',
  'seedream',
  'seedream-5-0-pro',
  'luma-uni-1',
  'luma-uni-1-max',
]);

function canonicalCompareSlug(left, right) {
  if (!left || !right || left === right) return null;
  const [canonicalLeft, canonicalRight] = [left.trim(), right.trim()].sort((a, b) => a.localeCompare(b, 'en'));
  if (!canonicalLeft || !canonicalRight) return null;
  return `${canonicalLeft}-vs-${canonicalRight}`;
}

function canonicalizeComparisonSlug(slug) {
  if (typeof slug !== 'string' || !slug.includes('-vs-')) return null;
  const [left, right] = slug.split('-vs-');
  return canonicalCompareSlug(left, right);
}

function toAbsoluteUrl(site, pathname) {
  const normalizedSite = site.replace(/\/+$/, '');
  return `${normalizedSite}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

export function getPublishedComparisonSlugs(catalog) {
  const entries = Array.isArray(catalog) ? catalog : [];
  const validSlugs = new Set(entries.map((entry) => entry?.modelSlug).filter(Boolean));
  const published = new Set();

  entries.forEach((entry) => {
    const left = entry?.modelSlug;
    if (!left || EXCLUDED_ENGINE_SLUGS.has(left)) return;
    const opponents = entry?.surfaces?.compare?.publishedPairs;
    if (!Array.isArray(opponents)) return;

    opponents.forEach((right) => {
      if (!validSlugs.has(right) || right === left || EXCLUDED_ENGINE_SLUGS.has(right)) return;
      const slug = canonicalCompareSlug(left, right);
      if (slug) published.add(slug);
    });
  });

  return Array.from(published).sort((a, b) => a.localeCompare(b, 'en'));
}

export function getPublishedComparisonSlugsForModels(catalog, changedModelSlugs) {
  const changed = changedModelSlugs instanceof Set ? changedModelSlugs : new Set(changedModelSlugs ?? []);
  return getPublishedComparisonSlugs(catalog).filter((slug) => {
    const [left, right] = slug.split('-vs-');
    return changed.has(left) || changed.has(right);
  });
}

export function addComparisonUrls(urls, site, comparisonSlug) {
  const slug = canonicalizeComparisonSlug(comparisonSlug);
  if (!slug) return;
  urls.add(toAbsoluteUrl(site, `/ai-video-engines/${slug}`));
  urls.add(toAbsoluteUrl(site, `/fr/comparatif/${slug}`));
  urls.add(toAbsoluteUrl(site, `/es/comparativa/${slug}`));
}

export function addComparisonHubUrls(urls, site) {
  urls.add(toAbsoluteUrl(site, '/ai-video-engines'));
  urls.add(toAbsoluteUrl(site, '/fr/comparatif'));
  urls.add(toAbsoluteUrl(site, '/es/comparativa'));
}
