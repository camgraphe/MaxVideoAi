type HrefLike = string | { pathname?: string | null } | null | undefined;

const EXTERNAL_HREF_PATTERN = /^(?:[a-z][a-z0-9+\-.]*:|\/\/)/i;
const NOFOLLOW_PREFIXES = ['/app', '/generate', '/dashboard', '/jobs', '/billing', '/settings', '/connect'];
const NOFOLLOW_VIDEO_PREFIX = '/video';

function extractHrefPath(href: HrefLike): string | null {
  if (!href) return null;
  if (typeof href === 'string') {
    const trimmed = href.trim();
    if (!trimmed || EXTERNAL_HREF_PATTERN.test(trimmed)) {
      return null;
    }
    const clean = trimmed.split(/[?#]/)[0];
    return clean || null;
  }
  if (typeof href === 'object' && typeof href.pathname === 'string') {
    return href.pathname;
  }
  return null;
}

export function shouldNofollowHref(href: HrefLike): boolean {
  const path = extractHrefPath(href);
  if (!path) return false;
  const normalized = path.toLowerCase();
  if (normalized === NOFOLLOW_VIDEO_PREFIX || normalized.startsWith(`${NOFOLLOW_VIDEO_PREFIX}/`)) {
    return true;
  }
  return NOFOLLOW_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function applyNofollowRel(rel: string | undefined, href: HrefLike): string | undefined {
  if (!shouldNofollowHref(href)) {
    return rel;
  }
  const tokens = new Set((rel ?? '').split(/\s+/).map((value) => value.trim()).filter(Boolean));
  tokens.add('nofollow');
  return Array.from(tokens).join(' ');
}
