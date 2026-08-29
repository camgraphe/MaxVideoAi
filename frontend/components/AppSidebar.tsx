'use client';

import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
  AudioWaveform,
  ArrowRight,
  Clapperboard,
  Home,
  Images,
  Info,
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
import { FEATURES } from '@/content/feature-flags';
import { isSettingsPath } from '@/lib/settings-navigation';

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

const ASSISTANT_CONNECTIONS = [
  {
    id: 'claude',
    href: '/integrations/claude',
    lightMark: '/brand/partners/anthropic/claude-mark-light.svg',
    darkMark: '/brand/partners/anthropic/claude-mark-dark.svg',
    fallbackLabel: 'Claude',
  },
  {
    id: 'chatgpt',
    href: '/integrations/chatgpt',
    lightMark: '/brand/partners/openai/openai-mark-light.svg',
    darkMark: '/brand/partners/openai/openai-mark-dark.svg',
    fallbackLabel: 'ChatGPT',
  },
  {
    id: 'codex',
    href: '/integrations/codex',
    lightMark: '/brand/partners/openai/openai-mark-light.svg',
    darkMark: '/brand/partners/openai/openai-mark-dark.svg',
    fallbackLabel: 'Codex',
  },
] as const;

type SidebarTranslate = (path: string, fallback: string) => string | undefined;

export function AssistantConnectionsCard({ t }: { t: SidebarTranslate }) {
  const tooltip = t(
    'workspace.sidebar.assistantConnections.tooltip',
    'Connect your account to use MaxVideoAI directly from your AI assistant.',
  );

  return (
    <div className="rounded-card border border-hairline bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-primary">
          {t('workspace.sidebar.assistantConnections.label', 'Connect')}
        </p>
        <span className="group/assistant-tip relative inline-flex">
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={tooltip}
            aria-describedby="assistant-connections-tooltip"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span
            id="assistant-connections-tooltip"
            role="tooltip"
            className="pointer-events-none absolute bottom-0 left-full z-50 ml-2 hidden w-56 rounded-input border border-border bg-surface px-3 py-2 text-left text-[11px] font-normal leading-4 normal-case tracking-normal text-text-secondary shadow-lg group-hover/assistant-tip:block group-focus-within/assistant-tip:block dark:border-white/12 dark:bg-[#111827] dark:text-white/78"
          >
            {tooltip}
          </span>
        </span>
      </div>

      <div className="overflow-hidden rounded-b-card border-t border-hairline divide-y divide-hairline">
        {ASSISTANT_CONNECTIONS.map((connection) => (
          <Link
            key={connection.id}
            href={connection.href}
            prefetch={false}
            className="group flex min-h-10 items-center gap-2.5 px-3.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
              <Image
                src={connection.lightMark}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] object-contain dark:hidden"
              />
              <Image
                src={connection.darkMark}
                alt=""
                width={18}
                height={18}
                className="hidden h-[18px] w-[18px] object-contain dark:block"
              />
            </span>
            <span className="min-w-0 flex-1 whitespace-nowrap text-[13px]">
              {t(`workspace.sidebar.assistantConnections.${connection.id}`, connection.fallbackLabel)}
            </span>
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

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
        : item.id === 'settings'
          ? isSettingsPath(normalizedPath)
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
          <AssistantConnectionsCard t={t} />
        </div>
      </div>
    </aside>
  );
}
