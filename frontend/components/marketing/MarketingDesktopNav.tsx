'use client';

import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { MarketingNavEntryContent } from '@/components/marketing/MarketingNavEntryContent';
import { MARKETING_NAV_DROPDOWNS, type MarketingTopNavLink } from '@/config/navigation';

type MarketingTranslate = <T = unknown>(key: string, fallback?: T) => T | undefined;
type Props = {
  desktopDropdownOpen: string | null;
  links: readonly MarketingTopNavLink[];
  pathname: string | null;
  t: MarketingTranslate;
  onCloseDesktopDropdown: (delay?: number) => void;
  onOpenDesktopDropdown: (key: string) => void;
};

export function MarketingDesktopNav({ desktopDropdownOpen, links, pathname, t, onCloseDesktopDropdown, onOpenDesktopDropdown }: Props) {
  const navRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onCloseDesktopDropdown);
  closeRef.current = onCloseDesktopDropdown;
  useEffect(() => {
    if (!desktopDropdownOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) closeRef.current(0);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [desktopDropdownOpen]);

  return <nav ref={navRef} aria-label={t('nav.primaryNavigation', 'Main navigation')} className="marketing-desktop-nav hidden lg:flex">
    {links.map(item => {
      const dropdown = MARKETING_NAV_DROPDOWNS[item.key];
      const label = t<string>(`nav.linkLabels.${item.key}`, item.key) ?? item.key;
      const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
      if (!dropdown) return <Link key={item.key} href={item.href} prefetch={false} className="marketing-nav-trigger" aria-current={active ? 'page' : undefined}>{label}</Link>;
      const isOpen = desktopDropdownOpen === item.key;
      const panelId = `marketing-${item.key}-dropdown`;
      const twoColumns = dropdown.desktopColumns === 2 || item.key === 'compare';
      return <div key={item.key} className="marketing-nav-item"
        onMouseEnter={() => onOpenDesktopDropdown(item.key)}
        onMouseLeave={() => onCloseDesktopDropdown(160)}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onCloseDesktopDropdown(0); }}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault(); onCloseDesktopDropdown(0);
            event.currentTarget.querySelector<HTMLButtonElement>('.marketing-nav-trigger')?.focus();
          }
        }}>
        <button type="button" className={clsx('marketing-nav-trigger', active && 'is-active')} aria-expanded={isOpen} aria-controls={panelId}
          onClick={event => event.detail === 0 && isOpen ? onCloseDesktopDropdown(0) : onOpenDesktopDropdown(item.key)}
          onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); onOpenDesktopDropdown(item.key); } }}>
          {label}{item.key === 'connect' ? <span className="marketing-mcp-tag">MCP</span> : null}<ChevronDown size={12} aria-hidden="true" />
        </button>
        <div id={panelId} className="marketing-mega-menu" hidden={!isOpen}>
          <header className="marketing-mega-heading"><div><p>{t(`nav.dropdown.${item.key}.heading`, dropdown.heading)}</p><span>{t(`nav.dropdown.${item.key}.intro`, dropdown.intro)}</span></div>
            <Link href={dropdown.allHref} prefetch={false} onClick={() => onCloseDesktopDropdown(0)}>{t(dropdown.allLabelKey, dropdown.allLabelFallback)}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          </header>
          <div className={clsx('marketing-mega-content', dropdown.sections?.length && 'has-aside')}>
            <div className={clsx('marketing-mega-links', twoColumns && 'two-columns')}>
              {dropdown.items.map(entry => {
                const entryLabel = t<string>(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label) ?? entry.label;
                const badgeLabel = entry.badge ? t<string>(`nav.badges.${entry.badge}`, entry.badge) : undefined;
                const description = entry.description ? t<string>(`nav.dropdown.${item.key}.descriptions.${entry.key}`, entry.description) : undefined;
                return <Link key={entry.key} href={entry.href} prefetch={false} onClick={() => onCloseDesktopDropdown(0)} className="marketing-mega-link">
                  <MarketingNavEntryContent entry={entry} label={entryLabel} badgeLabel={badgeLabel} showModelLogo={item.key === 'models'} />
                  {description ? <small>{description}</small> : null}
                </Link>;
              })}
            </div>
            {dropdown.sections?.length ? <aside className="marketing-mega-aside">{dropdown.sections.map(section => <div key={section.key}>
              {!section.hideTitle ? <p className="marketing-menu-caption">{section.titleKey ? t(section.titleKey, section.titleFallback) : section.titleFallback}</p> : null}
              {section.items.map(entry => <Link key={entry.key} href={entry.href} prefetch={false} onClick={() => onCloseDesktopDropdown(0)} className={clsx('marketing-aside-link', entry.emphasized && 'font-semibold text-text-primary')}>
                <MarketingNavEntryContent entry={entry} label={t<string>(`nav.dropdown.${item.key}.sections.${section.key}.items.${entry.key}`, entry.label) ?? entry.label} showModelLogo={false} /><ArrowUpRight size={13} aria-hidden="true" />
              </Link>)}
            </div>)}</aside> : null}
          </div>
        </div>
      </div>;
    })}
  </nav>;
}
