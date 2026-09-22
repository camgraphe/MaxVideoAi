export type AdminNavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
};

export type AdminNavBadgeTone = 'info' | 'warn';

export type AdminNavBadge = {
  label: string;
  tone?: AdminNavBadgeTone;
};

export type AdminNavBadgeMap = Record<string, AdminNavBadge[]>;

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
  secondary?: boolean;
};

/** Sections share stable route owners; navigation never owns pricing or other domain state. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { id: 'overview', label: 'Overview', items: [
    { id: 'hub-health', label: 'Today', href: '/admin', icon: 'dashboard' },
    { id: 'insights', label: 'Trends', href: '/admin/insights', icon: 'insights' },
    { id: 'mcp', label: 'MCP activity', href: '/admin/mcp', icon: 'insights' },
  ] },
  { id: 'users', label: 'Users', items: [
    { id: 'users', label: 'Users', href: '/admin/users', icon: 'users' },
  ] },
  { id: 'transactions', label: 'Transactions', items: [
    { id: 'transactions', label: 'Wallet activity', href: '/admin/transactions', icon: 'transactions' },
    { id: 'checkout-report', label: 'Checkout review', href: '/admin/checkout-report', icon: 'shield' },
  ] },
  { id: 'generations', label: 'Generations', items: [
    { id: 'jobs', label: 'Generations', href: '/admin/jobs', icon: 'jobs' },
    { id: 'engines', label: 'Model activity', href: '/admin/engines', icon: 'engines' },
  ] },
  { id: 'content', label: 'Content', items: [
    { id: 'moderation', label: 'Moderation', href: '/admin/moderation', icon: 'moderation' },
    { id: 'editorial', label: 'Articles', href: '/admin/editorial', icon: 'blog' },
    { id: 'playlists', label: 'Site placements', href: '/admin/playlists', icon: 'playlists' },
    { id: 'homepage', label: 'Homepage', href: '/admin/home', icon: 'homepage' },
    { id: 'video-seo', label: 'Video publishing', href: '/admin/video-seo', icon: 'examples' },
  ] },
  { id: 'settings', label: 'Settings', secondary: true, items: [
    { id: 'settings', label: 'Settings', href: '/admin/settings', icon: 'settings' },
    { id: 'service-notice', label: 'Service notice', href: '/admin/system', icon: 'bell' },
    { id: 'infra-costs', label: 'Infrastructure costs', href: '/admin/infra-costs', icon: 'costs' },
    { id: 'audit-log', label: 'Audit log', href: '/admin/audit', icon: 'audit' },
    { id: 'billing-products', label: 'Billing products', href: '/admin/billing-products', icon: 'billing-products' },
    { id: 'legal', label: 'Legal', href: '/admin/legal', icon: 'legal' },
    { id: 'marketing', label: 'Marketing consent', href: '/admin/marketing', icon: 'marketing' },
    { id: 'consents', label: 'Export consents', href: '/admin/consents.csv', icon: 'consents' },
  ] },
];

export const ADMIN_EXTERNAL_LINKS = [
  { label: 'View site', href: '/' },
  { label: 'Search Console', href: 'https://search.google.com/search-console' },
];

export function normalizeAdminPath(pathname?: string | null): string {
  if (!pathname) return '/';
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

export function isAdminNavMatch(pathname: string | null | undefined, href: string): boolean {
  const current = normalizeAdminPath(pathname);
  const target = normalizeAdminPath(href);
  const isAdminRoute = target.startsWith('/admin');

  if (!isAdminRoute) {
    return current === target;
  }

  if (target === '/admin') {
    return current === target;
  }

  return current === target || current.startsWith(`${target}/`);
}

export function findAdminNavMatch(
  pathname: string | null | undefined,
  groups: AdminNavGroup[]
): { group: AdminNavGroup; item: AdminNavItem } | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (isAdminNavMatch(pathname, item.href)) {
        return { group, item };
      }
    }
  }
  return null;
}
