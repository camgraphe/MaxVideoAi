'use client';

import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import { MARKETING_NAV_DROPDOWNS } from '@/config/navigation';
import type { MarketingTopNavLink } from '@/config/navigation';

type MarketingTranslate = <T = unknown>(key: string, fallback?: T) => T | undefined;

type MarketingDesktopNavProps = {
  desktopDropdownOpen: string | null;
  links: readonly MarketingTopNavLink[];
  pathname: string | null;
  t: MarketingTranslate;
  onCloseDesktopDropdown: (delay?: number) => void;
  onOpenDesktopDropdown: (key: string) => void;
};

export function MarketingDesktopNav({
  desktopDropdownOpen,
  links,
  pathname,
  t,
  onCloseDesktopDropdown,
  onOpenDesktopDropdown,
}: MarketingDesktopNavProps) {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-5 text-sm font-medium text-text-secondary lg:flex xl:gap-7">
      {links.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(`${item.href}/`));
        const dropdown = MARKETING_NAV_DROPDOWNS[item.key];
        const label = t(`nav.linkLabels.${item.key}`, item.key);
        if (!dropdown) {
          return (
            <Link
              key={item.key}
              href={item.href}
              className={clsx(
                'whitespace-nowrap transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                isActive ? 'text-text-primary' : undefined
              )}
            >
              {label}
            </Link>
          );
        }

        const allLabel = t(dropdown.allLabelKey, dropdown.allLabelFallback);
        const isOpen = desktopDropdownOpen === item.key;
        const hasSections = Boolean(dropdown.sections?.length);

        return (
          <div
            key={item.key}
            className="relative"
            onMouseEnter={() => onOpenDesktopDropdown(item.key)}
            onMouseLeave={() => onCloseDesktopDropdown()}
            onFocus={() => onOpenDesktopDropdown(item.key)}
            onBlur={(event) => {
              const next = event.relatedTarget as Node | null;
              if (!event.currentTarget.contains(next)) {
                onCloseDesktopDropdown();
              }
            }}
          >
            <Link
              href={item.href}
              aria-haspopup="menu"
              className={clsx(
                'inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                isActive ? 'text-text-primary' : undefined
              )}
              onClick={() => onCloseDesktopDropdown(200)}
            >
              <span>{label}</span>
              <UIIcon icon={ChevronDown} size={14} strokeWidth={1.6} className="text-text-muted" />
            </Link>
            <div
              className={clsx(
                'absolute left-0 top-full z-20 pt-2 transition duration-150',
                isOpen ? 'visible opacity-100' : 'invisible opacity-0'
              )}
            >
              <div className="min-w-[240px] rounded-card border border-hairline bg-surface p-3 shadow-card">
                <div className={clsx('grid gap-3', hasSections ? 'min-w-[520px] grid-cols-[1fr_1fr]' : 'min-w-0 grid-cols-1')}>
                  <nav className="flex flex-col gap-1" role="menu" aria-label={label}>
                    <Link
                      href={dropdown.allHref}
                      className="rounded-input px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      role="menuitem"
                      onClick={() => onCloseDesktopDropdown(200)}
                    >
                      {allLabel}
                    </Link>
                    {dropdown.items.map((entry) => (
                      <Link
                        key={entry.key}
                        href={entry.href}
                        className="rounded-input px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        role="menuitem"
                        onClick={() => onCloseDesktopDropdown(200)}
                      >
                        {t(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label)}
                      </Link>
                    ))}
                  </nav>
                  {dropdown.sections?.map((section) => {
                    const sectionLabel = section.titleKey
                      ? t(section.titleKey, section.titleFallback ?? section.key)
                      : (section.titleFallback ?? label);

                    return (
                      <nav
                        key={section.key}
                        className="flex flex-col gap-1 border-l border-hairline pl-3"
                        role="menu"
                        aria-label={sectionLabel}
                      >
                        {!section.hideTitle && sectionLabel ? (
                          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
                            {sectionLabel}
                          </p>
                        ) : null}
                        {section.items.map((entry) => (
                          <Link
                            key={entry.key}
                            href={entry.href}
                            className={clsx(
                              'rounded-input px-3 py-2 text-sm transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              entry.emphasized ? 'font-semibold text-text-primary' : 'text-text-secondary'
                            )}
                            role="menuitem"
                            onClick={() => onCloseDesktopDropdown(200)}
                          >
                            {t(`nav.dropdown.${item.key}.sections.${section.key}.items.${entry.key}`, entry.label)}
                          </Link>
                        ))}
                      </nav>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
