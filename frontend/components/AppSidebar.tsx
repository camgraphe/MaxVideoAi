'use client';

import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, useId } from 'react';
import { Chip } from '@/components/ui/Chip';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', badge: null, icon: 'dashboard', href: '/dashboard' },
  { id: 'generate', label: 'Generate', badge: 'LIVE', icon: 'generate', href: '/' },
  { id: 'jobs', label: 'Jobs', badge: null, icon: 'jobs', href: '/jobs' },
  { id: 'billing', label: 'Billing', badge: null, icon: 'billing', href: '/billing' },
  { id: 'settings', label: 'Settings', badge: null, icon: 'settings', href: '/settings' }
] as const;

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
  const [collapsed, setCollapsed] = useState<boolean>(() => getStoredBoolean(COLLAPSED_STORAGE_KEY, true));
  const [pinned, setPinned] = useState<boolean>(() => getStoredBoolean(PIN_STORAGE_KEY, false));
  const tooltipBaseId = useId();

  const navigationItems = useMemo(() => NAV_ITEMS, []);
  const pathname = usePathname();

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

const renderNavItem = (item: NavItem, collapsed: boolean, tooltipBaseId: string) => {
    const active = pathname === item.href || (item.id === 'generate' && pathname === '');
    const tooltipId = `${tooltipBaseId}-${item.id}`;

    return (
      <li key={item.id} className="relative">
        <Link
          href={item.href}
          className={clsx(
            'group relative flex w-full items-center rounded-[14px] px-2 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'justify-center gap-0' : 'gap-3 px-3',
            active
              ? 'bg-accentSoft/20 text-text-primary'
              : 'text-text-muted hover:bg-accentSoft/15 hover:text-text-primary'
          )}
          aria-current={active ? 'page' : undefined}
          aria-describedby={collapsed ? tooltipId : undefined}
        >
          <span
            className={clsx(
              'pointer-events-none absolute left-1 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-full bg-accentSoft transition-opacity',
              active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
            )}
            aria-hidden
          />
          <span
            className={clsx(
              'flex items-center justify-center rounded-[12px] border transition-colors duration-150',
              collapsed ? 'h-9 w-9' : 'h-11 w-11',
              active
                ? 'border-accentSoft/40 bg-accentSoft/25 text-accent'
                : 'border-transparent bg-white/80 text-text-muted group-hover:bg-accentSoft/15 group-hover:text-text-primary'
            )}
            aria-hidden
          >
            <Image
              src={`/assets/icons/${item.icon}.svg`}
              alt=""
              width={collapsed ? 18 : 20}
              height={collapsed ? 18 : 20}
              aria-hidden
            />
          </span>
          {!collapsed && (
            <span className="flex items-center gap-2">
              <span>{item.label}</span>
              {item.badge && (
                <Chip className="px-2 py-0.5 text-[10px]" variant="outline">
                  {item.badge}
                </Chip>
              )}
            </span>
          )}
        </Link>
        {collapsed && (
          <div
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none absolute left-[76px] top-1/2 z-[1000] -translate-y-1/2 whitespace-nowrap rounded-card border border-border bg-white px-3 py-1 text-xs font-medium text-text-secondary opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {item.label}
          </div>
        )}
      </li>
    );
  };

  return (
    <aside
      className={clsx(
        'relative hidden h-[calc(100vh-var(--header-height))] lg:flex flex-col border-r border-hairline bg-white/70 backdrop-blur-md transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-[78px]' : 'w-64'
      )}
    >
      <div
        className={clsx(
          'items-center px-4 pt-6',
          collapsed ? 'flex flex-col gap-3' : 'flex flex-row items-center justify-between gap-3 pb-2'
        )}
        aria-label="Sidebar controls"
      >
        <button
          type="button"
          onClick={handleCollapsedToggle}
          className="flex h-10 w-10 items-center justify-center rounded-input border border-hairline bg-white/70 text-text-secondary transition hover:-translate-y-0.5 hover:bg-white/80 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src={`/assets/icons/${collapsed ? 'sidebar-expand' : 'sidebar-collapse'}.svg`}
            alt=""
            width={16}
            height={16}
            aria-hidden
          />
          <span className="sr-only">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
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
          <Image src={`/assets/icons/${pinned ? 'unpin' : 'pin'}.svg`} alt="" width={16} height={16} aria-hidden />
          <span className="sr-only">{pinned ? 'Unpin sidebar' : 'Pin sidebar open'}</span>
        </button>
      </div>

  <nav
    aria-label="App menu"
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

      <div className="px-4 pb-5">
        <div
          className={clsx(
            'flex items-center justify-center rounded-card border border-hairline bg-white/80 shadow-card transition',
            collapsed ? 'h-11 w-11 mx-auto' : 'h-12'
          )}
        >
          <Image
            src="/assets/branding/Logos/SVG/icon-dark.svg"
            alt="MaxVideoAI logo mark"
            width={collapsed ? 22 : 26}
            height={collapsed ? 22 : 26}
          />
        </div>
      </div>
    </aside>
  );
}
