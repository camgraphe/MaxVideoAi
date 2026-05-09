'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
  AudioWaveform,
  Check,
  Clapperboard,
  Home,
  Images,
  LibraryBig,
  ListChecks,
  LucideIcon,
  SlidersHorizontal,
  Wrench,
  WalletCards,
} from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { UIIcon } from '@/components/ui/UIIcon';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ButtonLink } from '@/components/ui/Button';
import { FEATURES } from '@/content/feature-flags';

type NavItemDefinition = {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: string | null;
  badgeKey?: string | null;
};

export const NAV_ITEMS: readonly NavItemDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', badge: null, icon: 'dashboard', href: '/dashboard' },
  { id: 'generate', label: 'Generate Video', badge: null, icon: 'generate', href: '/app' },
  { id: 'generate-image', label: 'Generate Image', badge: null, icon: 'generate-image', href: '/app/image' },
  { id: 'generate-audio', label: 'Generate Audio', badge: null, icon: 'generate-audio', href: '/app/audio' },
  ...(FEATURES.workflows.toolsSection
    ? [{ id: 'tools', label: 'Tools', badge: null, icon: 'tools', href: '/app/tools' }]
    : []),
  { id: 'library', label: 'Library', badge: null, icon: 'library', href: '/app/library' },
  { id: 'jobs', label: 'History', badge: null, icon: 'jobs', href: '/jobs' },
  { id: 'billing', label: 'Billing', badge: null, icon: 'billing', href: '/billing' },
  { id: 'settings', label: 'Settings', badge: null, icon: 'settings', href: '/settings' }
];

const NAV_ICON_MAP: Record<string, LucideIcon> = {
  dashboard: Home,
  generate: Clapperboard,
  'generate-image': Images,
  'generate-audio': AudioWaveform,
  tools: Wrench,
  library: LibraryBig,
  jobs: ListChecks,
  billing: WalletCards,
  settings: SlidersHorizontal,
};

type NavItem = (typeof NAV_ITEMS)[number];

export function AppSidebar() {
  const { t } = useI18n();
  const navigationItems = useMemo(() => NAV_ITEMS, []);
  const pathname = usePathname();

  const renderNavItem = (item: NavItem) => {
    const normalizedPath = pathname?.replace(/\/+$/, '') || '/';
    const normalizedHref = item.href.replace(/\/+$/, '') || '/';
    const matchesExact = normalizedPath === normalizedHref;
    const matchesSubroute =
      normalizedHref !== '/' && normalizedPath.startsWith(`${normalizedHref}/`);
    const active =
      item.id === 'generate'
        ? matchesExact
        : matchesExact || matchesSubroute || (item.id === 'generate-image' && normalizedPath === '/app/image');
    const label = t(`workspace.sidebar.links.${item.id}`, item.label);
    const badgeLabel = item.badge
      ? t(`workspace.sidebar.badges.${item.badgeKey ?? item.id}`, item.badge)
      : null;
    const IconComponent = NAV_ICON_MAP[item.id] ?? Home;

    return (
      <li key={item.id} className="group/sidebar-item relative">
        <Link
          href={item.href}
          prefetch={false}
          className={clsx(
            'relative flex min-h-[42px] w-full items-center rounded-input border border-transparent text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'gap-2 px-2',
            active
              ? 'bg-[var(--brand-soft)] text-brand'
              : 'text-text-secondary hover:bg-surface hover:text-text-primary'
          )}
          aria-current={active ? 'page' : undefined}
        >
          <span
            className={clsx(
              'flex h-6 w-6 shrink-0 items-center justify-center transition-colors duration-150',
              active
                ? 'text-brand'
                : 'text-text-muted group-hover/sidebar-item:text-text-primary'
            )}
            aria-hidden
          >
            <UIIcon icon={IconComponent} size={19} strokeWidth={1.9} />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate">{label}</span>
            {badgeLabel && (
              <Chip className="px-2 py-0.5 text-[10px]" variant="outline">
                {badgeLabel}
              </Chip>
            )}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <aside
      className="sticky top-[var(--header-height)] hidden h-[calc(100vh-var(--header-height))] w-[188px] shrink-0 flex-col border-r border-hairline bg-surface-2 md:flex"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <nav
          aria-label={t('workspace.sidebar.aria.menu', 'App menu')}
          className="flex-none items-start justify-start overflow-y-auto px-2.5 pb-3 pt-4"
        >
          <ul
            className="mt-2 flex w-full flex-col gap-1"
          >
            {navigationItems.map((item) => renderNavItem(item))}
          </ul>
        </nav>
        <div className="mt-auto px-3 pb-5 pt-3">
          <div className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
            <p className="text-xs text-text-secondary">
              {t('workspace.sidebar.newModel.label', 'New model')}
            </p>
            <p className="mt-1 text-base font-semibold text-brand">
              {t('workspace.sidebar.newModel.name', 'Seedance 2.0')}
            </p>
            <ul className="mt-3 space-y-2 text-xs text-text-secondary">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-brand" aria-hidden />
                {t('workspace.sidebar.newModel.quality1', 'Cinematic motion')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-brand" aria-hidden />
                {t('workspace.sidebar.newModel.quality2', 'Multi-shot continuity')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-brand" aria-hidden />
                {t('workspace.sidebar.newModel.quality3', 'Native audio workflow')}
              </li>
            </ul>
            <ButtonLink
              href="/app?engine=seedance-2-0"
              prefetch={false}
              size="sm"
              className="mt-4 w-full"
            >
              {t('workspace.sidebar.newModel.cta', 'Try now')}
            </ButtonLink>
          </div>
        </div>
      </div>
    </aside>
  );
}
