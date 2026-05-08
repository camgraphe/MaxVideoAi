import { Image as ImageIcon, ListVideo, type LucideIcon, Sparkles } from 'lucide-react';
import { NAV_ITEMS } from '@/components/AppSidebar';
import { MARKETING_TOP_NAV_LINKS } from '@/config/navigation';
import type { LocalizedLinkHref } from '@/i18n/navigation';

export type HeaderMarketingLink = {
  key: string;
  href: string;
};

const MARKETING_TOP_NAV_HREF_BY_KEY: Record<string, string> = Object.fromEntries(
  MARKETING_TOP_NAV_LINKS.map((item) => [item.key, item.href])
);

const GUEST_MOBILE_NAV_ITEM_IDS = new Set(['generate', 'generate-image', 'jobs']);

export const GUEST_MOBILE_NAV_ICONS = {
  generate: Sparkles,
  'generate-image': ImageIcon,
  jobs: ListVideo,
} satisfies Record<string, LucideIcon>;

export function resolveLocalizedHref(href: LocalizedLinkHref): string {
  if (typeof href === 'string') {
    return href;
  }
  const pathname = typeof href.pathname === 'string' ? href.pathname : '';
  const params = 'params' in href ? href.params : undefined;
  let resolved = pathname;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      resolved = resolved.replace(`[${key}]`, encodeURIComponent(String(value)));
    });
  }
  const query = 'query' in href ? href.query : undefined;
  if (query) {
    const search = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        search.set(key, String(value));
      }
    });
    const suffix = search.toString();
    if (suffix) {
      resolved = `${resolved}?${suffix}`;
    }
  }
  return resolved;
}

export function normalizeMarketingLinks(rawMarketingLinks: unknown): HeaderMarketingLink[] {
  const source = Array.isArray(rawMarketingLinks) ? rawMarketingLinks : [];
  const normalized: HeaderMarketingLink[] = [];
  const seen = new Set<string>();

  for (const entry of source) {
    if (!entry || typeof entry !== 'object') continue;
    const key = (entry as { key?: unknown }).key;
    if (typeof key !== 'string' || seen.has(key)) continue;
    const allowedHref = MARKETING_TOP_NAV_HREF_BY_KEY[key];
    if (!allowedHref) continue;
    seen.add(key);
    normalized.push({ key, href: allowedHref });
  }

  if (normalized.length) {
    return normalized;
  }
  return MARKETING_TOP_NAV_LINKS.map((item) => ({ key: item.key, href: item.href }));
}

export function getGuestMobileNavItems() {
  return NAV_ITEMS.filter((item) => GUEST_MOBILE_NAV_ITEM_IDS.has(item.id));
}
