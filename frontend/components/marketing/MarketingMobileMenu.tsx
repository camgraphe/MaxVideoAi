'use client';

import clsx from 'clsx';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LanguageToggle } from '@/components/marketing/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { MARKETING_NAV_DROPDOWNS } from '@/config/navigation';
import type { MarketingTopNavLink } from '@/config/navigation';

type MarketingTranslate = <T = unknown>(key: string, fallback?: T) => T | undefined;

type MarketingMobileMenuProps = {
  cta: string;
  generateLabel: string;
  isAuthenticated: boolean;
  isHomePage: boolean;
  links: readonly MarketingTopNavLink[];
  login: string;
  mobileDropdownOpen: Record<string, boolean>;
  pathname: string | null;
  t: MarketingTranslate;
  theme: 'light' | 'dark';
  onClose: () => void;
  onSignOut: () => void;
  onToggleDropdown: (key: string) => void;
  onToggleTheme: () => void;
};

export function MarketingMobileMenu({
  cta,
  generateLabel,
  isAuthenticated,
  isHomePage,
  links,
  login,
  mobileDropdownOpen,
  pathname,
  t,
  theme,
  onClose,
  onSignOut,
  onToggleDropdown,
  onToggleTheme,
}: MarketingMobileMenuProps) {
  return (
    <div className={clsx('fixed inset-0 z-50 bg-bg px-4 py-6 sm:px-6', isHomePage && 'home-monochrome')}>
      <div className="mx-auto flex max-w-sm items-center justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-0 h-9 w-9 rounded-full border border-hairline bg-surface p-2 text-text-primary"
          aria-label={t('nav.mobileClose', 'Close menu')}
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
          <LanguageToggle variant="icon" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-text-primary hover:bg-surface-2"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={onToggleTheme}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center">
              <UIIcon icon={theme === 'dark' ? Sun : Moon} size={16} strokeWidth={1.75} />
            </span>
          </Button>
        </div>
        <nav className="flex flex-col gap-3 text-base font-semibold text-text-primary">
          {links.map((item) => {
            const dropdown = MARKETING_NAV_DROPDOWNS[item.key];
            const label = t(`nav.linkLabels.${item.key}`, item.key);
            if (!dropdown) {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={clsx(
                    'rounded-2xl border border-hairline px-4 py-3',
                    pathname === item.href ? 'bg-surface-2 text-text-primary' : 'bg-surface'
                  )}
                >
                  {label}
                </Link>
              );
            }
            const allLabel = t(dropdown.allLabelKey, dropdown.allLabelFallback);
            const panelId = `mobile-${item.key}-panel`;
            const isOpen = Boolean(mobileDropdownOpen[item.key]);
            return (
              <div key={item.key} className="rounded-2xl border border-hairline bg-surface px-4 py-3">
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
                      href={dropdown.allHref}
                      onClick={onClose}
                      className="rounded-input px-2 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {allLabel}
                    </Link>
                    {dropdown.items.map((entry) => (
                      <Link
                        key={entry.key}
                        href={entry.href}
                        onClick={onClose}
                        className="rounded-input px-2 py-2 transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label)}
                      </Link>
                    ))}
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
                          {section.items.map((entry) => (
                            <Link
                              key={entry.key}
                              href={entry.href}
                              onClick={onClose}
                              className={clsx(
                                'block rounded-input px-2 py-2 transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                entry.emphasized ? 'font-semibold text-text-primary' : undefined
                              )}
                            >
                              {t(`nav.dropdown.${item.key}.sections.${section.key}.items.${entry.key}`, entry.label)}
                            </Link>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        {isAuthenticated ? (
          <div className="stack-gap-sm">
            <Link
              href="/app"
              prefetch={false}
              className="block rounded-2xl bg-brand px-4 py-3 text-center text-base font-semibold text-on-brand shadow-card dark:bg-white dark:text-[#030712] dark:shadow-[0_14px_32px_rgba(255,255,255,0.14)] dark:hover:bg-slate-100"
              onClick={onClose}
            >
              {generateLabel}
            </Link>
            <Button
              type="button"
              size="md"
              variant="outline"
              className="w-full rounded-2xl border-hairline px-4 py-3 text-base font-semibold text-text-primary shadow-card"
              onClick={onSignOut}
            >
              {t('workspace.header.signOut', 'Sign out')}
            </Button>
          </div>
        ) : (
          <div className="stack-gap-sm">
            <Link
              href="/login?next=/app"
              prefetch={false}
              className="block rounded-2xl border border-hairline px-4 py-3 text-center text-base font-semibold text-text-primary shadow-card"
              onClick={onClose}
              data-analytics-event="cta_click"
              data-analytics-cta-name="marketing_nav_login"
              data-analytics-cta-location="marketing_nav_mobile"
              data-analytics-target-family="auth"
            >
              {login}
            </Link>
            <Link
              href="/app"
              prefetch={false}
              className="block rounded-input bg-[image:var(--brand-gradient)] px-6 py-3 text-center text-base font-semibold text-on-brand shadow-[var(--shadow-brand-button)] transition hover:bg-[image:var(--brand-gradient-strong)] active:brightness-95"
              onClick={onClose}
              data-analytics-event="cta_click"
              data-analytics-cta-name="marketing_nav_start_app"
              data-analytics-cta-location="marketing_nav_mobile"
              data-analytics-target-family="workspace"
            >
              {cta}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
