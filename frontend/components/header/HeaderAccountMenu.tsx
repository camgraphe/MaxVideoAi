'use client';

import Link from 'next/link';
import type { MouseEvent, RefObject } from 'react';
import { NAV_ITEMS } from '@/components/AppSidebar';
import { Button } from '@/components/ui/Button';

type HeaderTranslate = (key: string, fallback: string) => string | undefined;

type HeaderAccountMenuProps = {
  accountMenuOpen: boolean;
  avatarRef: RefObject<HTMLButtonElement>;
  email: string;
  initials: string;
  isAdmin: boolean;
  menuRef: RefObject<HTMLDivElement>;
  t: HeaderTranslate;
  onAdminNavigation: (event: MouseEvent<HTMLAnchorElement>) => void;
  onSignOut: () => void;
  onToggleAccountMenu: () => void;
  onCloseAccountMenu: () => void;
};

export function HeaderAccountMenu({
  accountMenuOpen,
  avatarRef,
  email,
  initials,
  isAdmin,
  menuRef,
  t,
  onAdminNavigation,
  onSignOut,
  onToggleAccountMenu,
  onCloseAccountMenu,
}: HeaderAccountMenuProps) {
  return (
    <div className="relative">
      <Button
        ref={avatarRef}
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggleAccountMenu}
        className="h-10 w-10 min-h-0 rounded-full border border-hairline bg-surface-2 p-0 text-sm font-semibold text-text-primary shadow-sm hover:bg-surface-3"
        aria-haspopup="menu"
        aria-expanded={accountMenuOpen}
      >
        {initials}
        <span className="absolute -bottom-0.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center text-[10px] text-text-muted opacity-40">
          <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5">
            <path
              d="m2.2 4.6 3.8 3.8 3.8-3.8"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          </svg>
        </span>
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
                  role="menuitem"
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
                role="menuitem"
                className="flex items-center justify-between rounded-input px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onAdminNavigation}
              >
                <span>Admin</span>
              </Link>
            ) : null}
          </nav>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-between px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-2"
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
