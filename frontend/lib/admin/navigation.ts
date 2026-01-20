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

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    items: [
      { id: 'hub-health', label: 'Hub & Health', href: '/admin', icon: 'dashboard' },
      { id: 'service-notice', label: 'Service notice', href: '/admin/system', icon: 'bell' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'users', label: 'Users', href: '/admin/users', icon: 'users' },
      { id: 'jobs', label: 'Jobs', href: '/admin/jobs', icon: 'jobs' },
      { id: 'transactions', label: 'Transactions', href: '/admin/transactions', icon: 'transactions' },
      { id: 'audit-log', label: 'Audit log', href: '/admin/audit', icon: 'audit' },
      { id: 'engines', label: 'Engines', href: '/admin/engines', icon: 'engines' },
      { id: 'pricing', label: 'Pricing rules', href: '/admin/pricing', icon: 'pricing' },
    ],
  },
  {
    id: 'curation',
    label: 'Curation',
    items: [
      { id: 'moderation', label: 'Moderation', href: '/admin/moderation', icon: 'moderation' },
      { id: 'playlists', label: 'Playlists', href: '/admin/playlists', icon: 'playlists' },
      { id: 'homepage', label: 'Homepage programming', href: '/admin/home', icon: 'homepage' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [{ id: 'insights', label: 'Insights', href: '/admin/insights', icon: 'insights' }],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    items: [
      { id: 'legal', label: 'Legal', href: '/admin/legal', icon: 'legal' },
      { id: 'marketing', label: 'Marketing opt-ins', href: '/admin/marketing', icon: 'marketing' },
      { id: 'consents', label: 'Consent exports', href: '/admin/consents.csv', icon: 'consents' },
    ],
  },
  {
    id: 'site',
    label: 'Site',
    secondary: true,
    items: [
      { id: 'marketing-home', label: 'Marketing homepage', href: '/', icon: 'globe' },
      { id: 'pricing-page', label: 'Pricing', href: '/pricing', icon: 'pricing' },
      { id: 'examples', label: 'Examples gallery', href: '/examples', icon: 'examples' },
      { id: 'workflows', label: 'Workflows', href: '/workflows', icon: 'workflows' },
      { id: 'models', label: 'Models catalog', href: '/models', icon: 'models' },
      { id: 'docs', label: 'Docs', href: '/docs', icon: 'docs' },
      { id: 'blog', label: 'Blog', href: '/blog', icon: 'blog' },
      { id: 'changelog', label: 'Changelog', href: '/changelog', icon: 'changelog' },
      { id: 'ai-video-engines', label: 'AI video engines', href: '/ai-video-engines', icon: 'engines' },
      { id: 'about', label: 'About', href: '/about', icon: 'about' },
      { id: 'contact', label: 'Contact', href: '/contact', icon: 'contact' },
      { id: 'status', label: 'Status page', href: '/status', icon: 'status' },
    ],
  },
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
