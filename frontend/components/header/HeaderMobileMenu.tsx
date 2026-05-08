'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { NAV_ITEMS } from '@/components/AppSidebar';
import { AppLanguageToggle } from '@/components/AppLanguageToggle';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { MARKETING_NAV_DROPDOWNS } from '@/config/navigation';
import {
  GUEST_MOBILE_NAV_ICONS,
  resolveLocalizedHref,
  type HeaderMarketingLink,
} from '@/components/header/header-nav-helpers';

type HeaderTranslate = (key: string, fallback: string) => string | undefined;
type GuestMobileNavItem = (typeof NAV_ITEMS)[number];

type HeaderMobileMenuProps = {
  ctaLabel?: string;
  guestMobileNavItems: GuestMobileNavItem[];
  isAuthenticated: boolean;
  loginLabel?: string;
  marketingLinks: HeaderMarketingLink[];
  mobileDropdownOpen: Record<string, boolean>;
  pathname: string | null;
  t: HeaderTranslate;
  theme: 'light' | 'dark';
  themeToggleLabel?: string;
  onClose: () => void;
  onToggleDropdown: (key: string) => void;
  onToggleTheme: () => void;
};

export function HeaderMobileMenu({
  ctaLabel,
  guestMobileNavItems,
  isAuthenticated,
  loginLabel,
  marketingLinks,
  mobileDropdownOpen,
  pathname,
  t,
  theme,
  themeToggleLabel,
  onClose,
  onToggleDropdown,
  onToggleTheme,
}: HeaderMobileMenuProps) {
  return (
    <div className="fixed inset-0 z-50 bg-bg px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-sm items-center justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-0 h-9 w-9 rounded-full border border-hairline bg-surface p-2 text-text-primary"
          aria-label={t('workspace.header.mobileClose', 'Close menu')}
          onClick={onClose}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </Button>
      </div>
      <div className="mx-auto mt-5 max-w-sm stack-gap-lg">
        <div className="flex justify-end gap-2">
          <AppLanguageToggle />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-text-primary hover:bg-surface-2"
            aria-label={themeToggleLabel ?? (theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')}
            onClick={onToggleTheme}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center">
              <UIIcon icon={theme === 'dark' ? Sun : Moon} size={16} strokeWidth={1.75} />
            </span>
          </Button>
        </div>
        <nav className="flex flex-col gap-3 text-base font-semibold text-text-primary">
          {!isAuthenticated ? (
            <div className="rounded-[28px] border border-hairline bg-surface px-4 py-4 shadow-card">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Workspace</p>
                  <p className="mt-1 text-sm font-medium text-text-primary">Open the app without dead ends.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {guestMobileNavItems.map((item) => {
                  const Icon = GUEST_MOBILE_NAV_ICONS[item.id as keyof typeof GUEST_MOBILE_NAV_ICONS];
                  const label = t(`workspace.sidebar.links.${item.id}`, item.label);
                  const currentPath = pathname ?? '';
                  const isActive =
                    item.id === 'generate'
                      ? currentPath === item.href
                      : currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      prefetch={false}
                      className={clsx(
                        'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive
                          ? 'border-border bg-surface-2 text-text-primary'
                          : 'border-hairline bg-bg text-text-primary hover:bg-surface-2'
                      )}
                      onClick={onClose}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-surface text-text-primary">
                        <UIIcon icon={Icon} size={18} />
                      </span>
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
          {marketingLinks.map((item) => {
            const dropdown = MARKETING_NAV_DROPDOWNS[item.key];
            const label = t(`nav.linkLabels.${item.key}`, item.key);
            if (!dropdown) {
              const href = item.href;
              const currentPath = pathname ?? '';
              const isActive = currentPath === href || currentPath.startsWith(`${href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={clsx(
                    'rounded-2xl border border-hairline px-4 py-3',
                    isActive ? 'bg-surface-2 text-text-primary' : 'bg-surface'
                  )}
                  onClick={onClose}
                >
                  {label}
                </Link>
              );
            }
            const panelId = `mobile-${item.key}-panel`;
            const isOpen = Boolean(mobileDropdownOpen[item.key]);
            const allLabel = t(dropdown.allLabelKey, dropdown.allLabelFallback);
            return (
              <div key={item.href} className="rounded-2xl border border-hairline bg-surface px-4 py-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => onToggleDropdown(item.key)}
                >
                  <span>{label}</span>
                  <UIIcon
                    icon={ChevronDown}
                    size={14}
                    strokeWidth={1.6}
                    className={clsx('text-text-muted transition-transform', isOpen ? 'rotate-180' : undefined)}
                  />
                </button>
                {isOpen ? (
                  <div id={panelId} className="mt-2 flex flex-col gap-1 text-sm font-medium text-text-secondary">
                    <Link
                      href={resolveLocalizedHref(dropdown.allHref)}
                      onClick={onClose}
                      className="rounded-input px-2 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {allLabel}
                    </Link>
                    {dropdown.items.map((entry) => {
                      const href = resolveLocalizedHref(entry.href);
                      return (
                        <Link
                          key={entry.key}
                          href={href}
                          onClick={onClose}
                          className="rounded-input px-2 py-2 transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {t(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label)}
                        </Link>
                      );
                    })}
                    {dropdown.sections?.map((section) => {
                      const sectionLabel = section.titleKey
                        ? t(section.titleKey, section.titleFallback ?? section.key)
                        : (section.titleFallback ?? label);

                      return (
                        <div key={section.key} className="mt-2 border-t border-hairline pt-2">
                          {!section.hideTitle && sectionLabel ? (
                            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                              {sectionLabel}
                            </p>
                          ) : null}
                          {section.items.map((entry) => {
                            const href = resolveLocalizedHref(entry.href);
                            return (
                              <Link
                                key={entry.key}
                                href={href}
                                onClick={onClose}
                                className={clsx(
                                  'block rounded-input px-2 py-2 transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                  entry.emphasized ? 'font-semibold text-text-primary' : undefined
                                )}
                              >
                                {t(`nav.dropdown.${item.key}.sections.${section.key}.items.${entry.key}`, entry.label)}
                              </Link>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        {isAuthenticated ? null : (
          <div className="stack-gap-sm">
            <Link
              href="/login?next=/app"
              className="block rounded-2xl border border-hairline px-4 py-3 text-center text-base font-semibold text-text-primary shadow-card"
              onClick={onClose}
            >
              {loginLabel ?? 'Log in'}
            </Link>
            <Link
              href="/app"
              prefetch={false}
              className="block rounded-2xl bg-brand px-4 py-3 text-center text-base font-semibold text-on-brand shadow-card"
              onClick={onClose}
            >
              {ctaLabel ?? 'Generate'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
