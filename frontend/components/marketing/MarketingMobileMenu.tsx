'use client';

import clsx from 'clsx';
import { useEffect, useState, type RefObject } from 'react';
import { useMarketingMenuFocus } from './useMarketingMenuFocus';
import { AudioWaveform, Boxes, Clapperboard, Images, Plug, Scale, WalletCards, Wrench, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { LanguageToggle } from '@/components/marketing/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { MarketingNavEntryContent } from '@/components/marketing/MarketingNavEntryContent';
import { MARKETING_NAV_DROPDOWNS } from '@/config/navigation';
import type { MarketingTopNavLink } from '@/config/navigation';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { useI18n } from '@/lib/i18n/I18nProvider';
const MENU_ICONS: Record<string, LucideIcon> = { models: Boxes, examples: Clapperboard, compare: Scale, tools: Wrench, pricing: WalletCards, connect: Plug };
type MarketingTranslate = <T = unknown>(key: string, fallback?: T) => T | undefined;
type MarketingMobileMenuProps = {
  cta: string;
  generateLabel: string;
  isAuthenticated: boolean;
  links: readonly MarketingTopNavLink[];
  login: string;
  menuId: string;
  menuRef: RefObject<HTMLDivElement>;
  pathname: string | null;
  t: MarketingTranslate;
  onClose: () => void;
  onSignOut: () => void;
};

export function MarketingMobileMenu({
  cta,
  generateLabel,
  isAuthenticated,
  links,
  login,
  menuId,
  menuRef,
  pathname,
  t,
  onClose,
  onSignOut,
}: MarketingMobileMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [staticMenu, setStaticMenu] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<Record<string, boolean>>({});
  const decorateMenu = menuOpen || staticMenu;
  const panelRef = useMarketingMenuFocus(menuOpen, menuId);
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    if (typeof menu.showPopover !== 'function') { setStaticMenu(true); return; }
    const syncOpen = () => {
      const open = menu.matches(':popover-open');
      setMenuOpen(open);
      const sections = Array.from(menu.querySelectorAll<HTMLDetailsElement>('details[data-menu-section]'));
      if (!open) sections.forEach(section => { section.open = false; });
      setMobileDropdownOpen(Object.fromEntries(sections.map(section => [section.dataset.menuSection!, section.open])));
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) menu.hidePopover(); };
    menu.addEventListener('toggle', syncOpen);
    desktop.addEventListener('change', closeOnDesktop);
    // Toggle events before hydration have already fired; adopt the DOM state.
    closeOnDesktop();
    syncOpen();
    return () => { menu.removeEventListener('toggle', syncOpen); desktop.removeEventListener('change', closeOnDesktop); };
  }, [menuRef]);
  const { locale } = useI18n();
  const loginHref = buildLoginHref({ mode: 'signin', nextPath: '/app', locale });

  return (
    <div id={menuId} ref={menuRef} popover="auto" className="marketing-menu-overlay fixed inset-0 z-50 overflow-y-auto overscroll-y-contain lg:hidden">
      <button type="button" tabIndex={-1} aria-hidden="true" className="marketing-menu-backdrop" {...{ popovertarget: menuId, popovertargetaction: 'hide' }} />
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={menuOpen || undefined}
      aria-label={t('nav.primaryNavigation', 'Main navigation')}
      className="marketing-menu-panel"
    >
      <div className="marketing-menu-header">
        <span className="flex items-center gap-2 text-base font-semibold"><span className="marketing-menu-logo" aria-hidden="true">{decorateMenu ? <Image src="/assets/branding/logo-mark.svg" alt="" aria-hidden="true" width={28} height={28} /> : null}</span>MaxVideoAI</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="marketing-menu-invoker min-h-0 h-11 w-11 rounded-lg border border-hairline bg-surface p-2 text-text-primary"
          aria-label={t('nav.mobileClose', 'Close menu')}
          autoFocus
          {...{ popovertarget: menuId, popovertargetaction: 'hide' }}
        >
          <span className="marketing-menu-close-icon" aria-hidden="true" />
        </Button>
      </div>
      <div className="marketing-menu-body">
        <p className="marketing-menu-caption">{t('nav.menuCreate', 'Create')}</p>
        <div className="marketing-menu-create">{[
          { href: '/app', key: 'video', label: 'Video', icon: Clapperboard },
          { href: '/app/image', key: 'image', label: 'Image', icon: Images },
          { href: '/app/audio', key: 'audio', label: 'Audio', icon: AudioWaveform },
        ].map((entry) => <Link key={entry.key} href={entry.href} prefetch={false} onClick={onClose}><span className="marketing-menu-icon" aria-hidden="true">{decorateMenu ? <UIIcon icon={entry.icon} size={21} /> : null}</span><span>{t(`nav.menuMedia.${entry.key}`, entry.label)}</span></Link>)}</div>
        <p className="marketing-menu-caption">{t('nav.menuExplore', 'Explore')}</p>
        <nav className="marketing-menu-nav">
          {links.map((item) => {
            const dropdown = MARKETING_NAV_DROPDOWNS[item.key];
            const Icon = MENU_ICONS[item.key] ?? Plug;
            const label = t(`nav.linkLabels.${item.key}`, item.key);
            if (!dropdown) {
              return (
                <Link prefetch={false}
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={clsx(
                    'marketing-menu-row',
                    pathname === item.href ? 'bg-surface-2 text-text-primary' : 'bg-transparent'
                  )}
                >
                  <span className="marketing-menu-icon" aria-hidden="true">{decorateMenu ? <UIIcon icon={Icon} size={18} /> : null}</span><span>{label}{item.key === 'connect' ? <span className="marketing-mcp-tag">MCP</span> : null}</span>
                </Link>
              );
            }
            const allLabel = t(dropdown.allLabelKey, dropdown.allLabelFallback);
            const panelId = `mobile-${item.key}-panel`;
            const isOpen = Boolean(mobileDropdownOpen[item.key]);
            return (
              <details key={item.key} className="marketing-menu-group" data-menu-section={item.key}
                onToggle={event => { const open = event.currentTarget.open; setMobileDropdownOpen(previous => ({ ...previous, [item.key]: open })); }}>
                <summary
                  className="marketing-menu-row w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-controls={panelId}
                >
                  <span className="marketing-menu-icon" aria-hidden="true">{decorateMenu ? <UIIcon icon={Icon} size={18} /> : null}</span><span className="flex-1">{label}{item.key === 'connect' ? <span className="marketing-mcp-tag">MCP</span> : null}</span>
                  <span className="marketing-menu-chevron" aria-hidden="true" />
                </summary>
                  <div id={panelId} className="marketing-menu-subnav flex flex-col gap-1 text-sm text-text-secondary">
                    <Link prefetch={false}
                      href={dropdown.allHref}
                      onClick={onClose}
                      className="rounded-input px-2 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {allLabel}
                    </Link>
                    {isOpen ? dropdown.items.map((entry) => {
                      const entryLabel = t<string>(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label) ?? entry.label;
                      const badgeLabel = entry.badge ? t<string>(`nav.badges.${entry.badge}`, entry.badge) : undefined;
                      return (
                        <Link prefetch={false}
                          key={entry.key}
                          href={entry.href}
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
                    }) : null}
                    {isOpen ? dropdown.sections?.map((section) => {
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
                            <Link prefetch={false}
                              key={entry.key}
                              href={entry.href}
                              onClick={onClose}
                              className={clsx(
                                'block rounded-input px-2 py-2 transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                entry.emphasized ? 'font-semibold text-text-primary' : undefined
                              )}
                            >
                              <MarketingNavEntryContent entry={entry} label={t<string>(`nav.dropdown.${item.key}.sections.${section.key}.items.${entry.key}`, entry.label) ?? entry.label} showModelLogo={false} />
                            </Link>
                          ))}
                        </div>
                      );
                    }) : null}
                  </div>
              </details>
            );
          })}
        </nav>
        <div className="marketing-menu-account">
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
              {t('nav.account.signOut', 'Sign out')}
            </Button>
          </div>
        ) : (
          <div className="stack-gap-sm">
            <Link
              href={loginHref}
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
        <div className="marketing-menu-settings flex justify-end gap-2">
          {decorateMenu ? <LanguageToggle variant="icon" /> : null}
        </div>
      </div>
    </div>
    </div>
  );
}
