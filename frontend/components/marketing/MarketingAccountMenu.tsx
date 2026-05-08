'use client';

import type { MouseEvent, RefObject } from 'react';
import { Link } from '@/i18n/navigation';
import { NAV_ITEMS } from '@/components/AppSidebar';
import { Button } from '@/components/ui/Button';

type MarketingTranslate = <T = unknown>(key: string, fallback?: T) => T | undefined;

type MarketingAccountMenuProps = {
  accountMenuOpen: boolean;
  avatarRef: RefObject<HTMLButtonElement>;
  email: string;
  initials: string;
  isAdmin: boolean;
  menuRef: RefObject<HTMLDivElement>;
  t: MarketingTranslate;
  onAdminNavigation: (event: MouseEvent<HTMLAnchorElement>) => void;
  onCloseAccountMenu: () => void;
  onSignOut: () => void;
  onToggleAccountMenu: () => void;
};

export function MarketingAccountMenu({
  accountMenuOpen,
  avatarRef,
  email,
  initials,
  isAdmin,
  menuRef,
  t,
  onAdminNavigation,
  onCloseAccountMenu,
  onSignOut,
  onToggleAccountMenu,
}: MarketingAccountMenuProps) {
  return (
    <div className="relative">
      <Button
        ref={avatarRef}
        type="button"
        size="sm"
        variant="ghost"
        onClick={onToggleAccountMenu}
        className="min-h-0 h-10 w-10 rounded-full border border-hairline bg-surface-2 text-sm font-semibold text-text-primary shadow-card hover:bg-surface-3"
        aria-haspopup="menu"
        aria-expanded={accountMenuOpen}
      >
        {initials}
      </Button>
      {accountMenuOpen ? (
        <div
          ref={menuRef}
          className="absolute right-0 mt-3 w-56 rounded-card border border-hairline bg-surface p-3 text-sm text-text-primary shadow-card"
          role="menu"
        >
          <div className="mb-3 rounded-input bg-bg px-3 py-2">
            <p className="text-xs uppercase tracking-micro text-text-muted">
              {t('workspace.header.signedIn', 'Signed in')}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-text-primary">{email}</p>
          </div>
          <nav className="mb-2 flex flex-col gap-1" aria-label={t('workspace.header.primaryNav', 'Primary navigation')}>
            {NAV_ITEMS.map((item) => {
              const label = t(`workspace.sidebar.links.${item.id}`, item.label);
              const badgeLabel = item.badge ? t(`workspace.sidebar.badges.${item.badgeKey ?? item.id}`, item.badge) : null;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={false}
                  className="flex items-center justify-between rounded-input px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={onCloseAccountMenu}
                >
                  <span>{label}</span>
                  {badgeLabel ? (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-micro text-text-primary">
                      {badgeLabel}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            {isAdmin ? (
              <Link
                href="/admin"
                prefetch={false}
                className="flex items-center justify-between rounded-input px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onAdminNavigation}
              >
                <span>Admin</span>
              </Link>
            ) : null}
          </nav>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-0 h-auto w-full justify-between rounded-input px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-2"
            onClick={onSignOut}
          >
            {t('workspace.header.signOut', 'Sign out')}
            <span className="text-[11px] uppercase tracking-micro text-text-muted">⌘⇧Q</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
