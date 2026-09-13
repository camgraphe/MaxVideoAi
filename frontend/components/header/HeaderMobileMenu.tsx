'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { NAV_ITEMS, NAV_ICON_MAP } from '@/components/AppSidebar';
import { AppLanguageToggle } from '@/components/AppLanguageToggle';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { MarketingNavEntryContent } from '@/components/marketing/MarketingNavEntryContent';
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
  loginHref: string;
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
  loginHref,
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
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('workspace.sidebar.aria.menu', 'App menu')} onKeyDown={onDialogKeyDown} className="app-mobile-menu fixed inset-0 z-50 overflow-y-auto overscroll-y-contain bg-bg px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-sm items-center justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="!min-h-11 gap-2 rounded-lg border border-hairline bg-surface px-3 text-text-primary"
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
          {t('workspace.header.mobileClose', 'Close')}
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
          {(
            <div className="rounded-[28px] border border-hairline bg-surface px-4 py-4 shadow-card">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t('workspace.sidebar.aria.menu', 'App menu')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(isAuthenticated ? NAV_ITEMS : guestMobileNavItems).map((item) => {
                  const Icon = NAV_ICON_MAP[item.id] ?? GUEST_MOBILE_NAV_ICONS.generate;
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
                      aria-current={isActive ? 'page' : undefined}
                      className={clsx(
                        'flex min-h-20 flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive
                          ? 'border-border bg-surface-2 text-text-primary'
                          : 'border-hairline bg-bg text-text-primary hover:bg-surface-2'
                      )}
                      onClick={onClose}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-hairline bg-surface text-text-primary">
                        <UIIcon icon={Icon} size={18} />
                      </span>
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
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
                      const entryLabel = t(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label) ?? entry.label;
                      const badgeLabel = entry.badge ? (t(`nav.badges.${entry.badge}`, entry.badge) ?? entry.badge) : undefined;
                      return (
                        <Link
                          key={entry.key}
                          href={href}
                          onClick={onClose}
                          className="rounded-input px-2 py-2 transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <MarketingNavEntryContent
                            entry={entry}
                            label={entryLabel}
                            badgeLabel={badgeLabel}
                            showModelLogo={item.key === 'models'}
                          />
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
              href={loginHref}
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
