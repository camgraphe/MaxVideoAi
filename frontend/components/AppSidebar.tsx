'use client';

import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, useId } from 'react';
import {
  BookOpen,
  Image as ImageIcon,
  LayoutDashboard,
  ListVideo,
  LucideIcon,
  PanelLeftOpen,
  PanelRightOpen,
  Pin,
  PinOff,
  Settings as SettingsIcon,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { UIIcon } from '@/components/ui/UIIcon';
import { useI18n } from '@/lib/i18n/I18nProvider';

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
  { id: 'library', label: 'Library', badge: null, icon: 'library', href: '/app/library' },
  { id: 'jobs', label: 'Jobs', badge: null, icon: 'jobs', href: '/jobs' },
  { id: 'billing', label: 'Billing', badge: null, icon: 'billing', href: '/billing' },
  { id: 'settings', label: 'Settings', badge: null, icon: 'settings', href: '/settings' }
];

const NAV_ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  generate: Sparkles,
  'generate-image': ImageIcon,
  library: BookOpen,
  jobs: ListVideo,
  billing: Wallet,
  settings: SettingsIcon,
};

const COLLAPSED_STORAGE_KEY = 'sidebarCollapsed';
const PIN_STORAGE_KEY = 'sidebarPinned';

type NavItem = (typeof NAV_ITEMS)[number];

function getStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.warn(`[AppSidebar] Unable to read ${key} from localStorage`, error);
    return fallback;
  }
}

export function AppSidebar() {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [pinned, setPinned] = useState<boolean>(false);
  const tooltipBaseId = useId();

  const navigationItems = useMemo(() => NAV_ITEMS, []);
  const pathname = usePathname();

  useEffect(() => {
    setCollapsed(getStoredBoolean(COLLAPSED_STORAGE_KEY, true));
    setPinned(getStoredBoolean(PIN_STORAGE_KEY, false));
  }, []);

  useEffect(() => {
    if (pinned) {
      setCollapsed(false);
    }
  }, [pinned]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinned));
  }, [pinned]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'b') return;
      event.preventDefault();
      setCollapsed((previous) => {
        const next = !previous;
        if (next) {
          setPinned(false);
        }
        return next;
      });
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const handleCollapsedToggle = () => {
    setCollapsed((previous) => {
      const next = !previous;
      if (next) {
        setPinned(false);
      }
      return next;
    });
  };

  const handlePinToggle = () => {
    setPinned((previous) => {
      const next = !previous;
      if (next) {
        setCollapsed(false);
      }
      return next;
    });
  };

  const handleMouseEnter = () => {
    if (!pinned) {
      setCollapsed(false);
    }
  };

  const handleMouseLeave = () => {
    if (!pinned) {
      setCollapsed(true);
    }
  };

  const renderNavItem = (item: NavItem, collapsedNav: boolean, tooltipBase: string) => {
    const normalizedPath = pathname?.replace(/\/+$/, '') || '/';
    const normalizedHref = item.href.replace(/\/+$/, '') || '/';
    const matchesExact = normalizedPath === normalizedHref;
    const matchesSubroute =
      normalizedHref !== '/' && normalizedPath.startsWith(`${normalizedHref}/`);
    const active =
      item.id === 'generate'
        ? matchesExact
        : matchesExact || matchesSubroute || (item.id === 'generate-image' && normalizedPath === '/app/image');
    const tooltipId = `${tooltipBase}-${item.id}`;
    const label = t(`workspace.sidebar.links.${item.id}`, item.label);
    const badgeLabel = item.badge
      ? t(`workspace.sidebar.badges.${item.badgeKey ?? item.id}`, item.badge)
      : null;
    const IconComponent = NAV_ICON_MAP[item.id] ?? LayoutDashboard;

    return (
      <li key={item.id} className="relative">
        <Link
          href={item.href}
          prefetch={false}
          className={clsx(
            'group relative flex w-full items-center rounded-[14px] px-2 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsedNav ? 'justify-center gap-0' : 'gap-3 px-3',
            active
              ? 'bg-surface-2 text-text-primary'
              : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'
          )}
          aria-current={active ? 'page' : undefined}
          aria-describedby={collapsedNav ? tooltipId : undefined}
        >
          <span
            className={clsx(
              'pointer-events-none absolute left-1 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-full bg-brand transition-opacity',
              active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
            )}
            aria-hidden
          />
          <span
            className={clsx(
              'flex items-center justify-center rounded-[12px] border transition-colors duration-150',
              collapsedNav ? 'h-10 w-10' : 'h-12 w-12',
              active
                ? 'border-text-muted bg-surface-2 text-text-primary'
                : 'border-transparent bg-white/80 text-text-muted group-hover:bg-surface-2 group-hover:text-text-primary'
            )}
            aria-hidden
          >
            <UIIcon icon={IconComponent} size={collapsedNav ? 20 : 22} />
          </span>
          {!collapsedNav && (
            <span className="flex items-center gap-2">
              <span>{label}</span>
              {badgeLabel && (
                <Chip className="px-2 py-0.5 text-[10px]" variant="outline">
                  {badgeLabel}
                </Chip>
              )}
            </span>
          )}
        </Link>
        {collapsedNav && (
          <div
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none absolute left-[76px] top-1/2 z-[1000] -translate-y-1/2 whitespace-nowrap rounded-card border border-border bg-white px-3 py-1 text-xs font-medium text-text-secondary opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {label}
          </div>
        )}
      </li>
    );
  };

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        'relative hidden min-h-[calc(100vh-var(--header-height))] md:flex flex-col border-r border-hairline bg-white/70 backdrop-blur-md transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-[78px]' : 'w-64'
      )}
    >
      <div
        className={clsx(
          'items-center px-4 pt-6',
          collapsed ? 'flex flex-col gap-3' : 'flex flex-row items-center justify-between gap-3 pb-2'
        )}
        aria-label={t('workspace.sidebar.aria.controls', 'Sidebar controls')}
      >
        <button
          type="button"
          onClick={handleCollapsedToggle}
          className="flex h-10 w-10 items-center justify-center rounded-input border border-hairline bg-white/70 text-text-secondary transition hover:-translate-y-0.5 hover:bg-white/80 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UIIcon icon={collapsed ? PanelRightOpen : PanelLeftOpen} size={20} />
          <span className="sr-only">
            {collapsed
              ? t('workspace.sidebar.aria.expand', 'Expand sidebar')
              : t('workspace.sidebar.aria.collapse', 'Collapse sidebar')}
          </span>
        </button>

        <button
          type="button"
          onClick={handlePinToggle}
          className={clsx(
            'flex h-10 w-10 items-center justify-center rounded-input border border-hairline bg-white/70 text-text-secondary transition hover:bg-white/80 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
          )}
          aria-hidden={collapsed}
          tabIndex={collapsed ? -1 : 0}
        >
          <UIIcon icon={pinned ? PinOff : Pin} size={18} />
          <span className="sr-only">
            {pinned
              ? t('workspace.sidebar.aria.unpin', 'Unpin sidebar')
              : t('workspace.sidebar.aria.pin', 'Pin sidebar open')}
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col">
        <nav
          aria-label={t('workspace.sidebar.aria.menu', 'App menu')}
          className={clsx(
            'flex flex-1 items-start justify-start overflow-y-auto px-2 pb-6',
            collapsed && 'pt-2'
          )}
        >
          <ul
            className={clsx(
              'w-full',
              collapsed ? 'flex flex-col items-center gap-1.5' : 'mt-4 flex flex-col gap-1.5'
            )}
          >
            {navigationItems.map((item) => renderNavItem(item, collapsed, tooltipBaseId))}
          </ul>
        </nav>
        <div className="mt-auto px-4 pb-5">
          <Link
            href="/"
            aria-label={t('workspace.sidebar.aria.home', 'Go to home')}
            className={clsx(
              'flex items-center justify-center rounded-card border border-hairline bg-white/80 shadow-card transition',
              collapsed ? 'mx-auto h-11 w-11' : 'h-12'
            )}
          >
            <Image
              src="/assets/branding/logo-mark.svg"
              alt="MaxVideoAI logo mark"
              width={collapsed ? 22 : 26}
              height={collapsed ? 22 : 26}
            />
          </Link>
        </div>
      </div>
    </aside>
  );
}
