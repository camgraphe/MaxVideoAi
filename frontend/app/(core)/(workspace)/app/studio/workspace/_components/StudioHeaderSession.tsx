'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { LogOut, UserRound, Wallet } from 'lucide-react';
import { NAV_ITEMS } from '@/components/AppSidebar';
import { useHeaderAccountState } from '@/components/header/useHeaderAccountState';
import styles from '../_styles/studio-session.module.css';
import type { StudioCopy } from '../../_lib/studio-copy';

function initialsFromEmail(email: string | null): string {
  if (!email) return '';
  const name = email.split('@')[0]?.trim() ?? '';
  const parts = name.split(/[._\-+\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

type StudioHeaderSessionProps = {
  onExitToProjects: () => void;
  studioCopy: StudioCopy;
};

export function StudioHeaderSession({ onExitToProjects, studioCopy }: StudioHeaderSessionProps) {
  const { authResolved, email, wallet, isAdmin, signOut } = useHeaderAccountState();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const walletPromptId = useId();
  const walletButtonRef = useRef<HTMLButtonElement>(null);
  const walletPromptRef = useRef<HTMLDivElement>(null);
  const sessionButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const walletAmount = wallet ? `$${wallet.balance.toFixed(2)}` : authResolved ? '--' : '...';
  const sessionLabel = email ?? (authResolved ? studioCopy.topbar.noSession : studioCopy.topbar.loadingSession);
  const initials = initialsFromEmail(email);

  useEffect(() => {
    if (!accountMenuOpen && !walletPromptOpen) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (walletButtonRef.current?.contains(target)) return;
      if (walletPromptRef.current?.contains(target)) return;
      if (sessionButtonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setWalletPromptOpen(false);
      setAccountMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWalletPromptOpen(false);
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer, { passive: true });
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [accountMenuOpen, walletPromptOpen]);

  const handleAdminNavigation = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setAccountMenuOpen(false);
    window.location.assign('/admin');
  }, []);

  const handleSignOut = useCallback(() => {
    setAccountMenuOpen(false);
    signOut();
  }, [signOut]);

  return (
    <div className={styles.studioSessionCluster} aria-label={studioCopy.topbar.accountStatus}>
      <div className={styles.studioWalletShell}>
        <button
          ref={walletButtonRef}
          type="button"
          className={styles.studioWalletPill}
          aria-label={formatCopyValue(studioCopy.topbar.walletBalance, { amount: walletAmount })}
          aria-expanded={walletPromptOpen}
          aria-describedby={walletPromptOpen ? walletPromptId : undefined}
          onClick={() => {
            setAccountMenuOpen(false);
            setWalletPromptOpen((open) => !open);
          }}
        >
          <Wallet size={14} />
          <strong>{walletAmount}</strong>
        </button>
        {walletPromptOpen ? (
          <div
            ref={walletPromptRef}
            id={walletPromptId}
            role="status"
            className={styles.studioWalletPrompt}
          >
            <p>{studioCopy.topbar.walletTopUpLabel}</p>
            <span>{studioCopy.topbar.walletTopUpCopy}</span>
            <Link href="/billing" prefetch={false} className={styles.studioWalletPromptCta}>
              {studioCopy.topbar.walletTopUpCta}
            </Link>
          </div>
        ) : null}
      </div>
      <div className={styles.studioSessionMenuShell}>
        <button
          ref={sessionButtonRef}
          type="button"
          className={styles.studioSessionPill}
          title={sessionLabel}
          data-auth-state={email ? 'signed-in' : authResolved ? 'signed-out' : 'loading'}
          aria-haspopup={email ? 'menu' : undefined}
          aria-expanded={email ? accountMenuOpen : undefined}
          onClick={() => {
            if (email) {
              setWalletPromptOpen(false);
              setAccountMenuOpen((open) => !open);
            }
          }}
        >
          <span className={styles.studioSessionAvatar} aria-hidden="true">
            {initials ? initials : <UserRound size={14} />}
          </span>
        </button>
        {accountMenuOpen && email ? (
          <div ref={menuRef} className={styles.studioSessionMenu} role="menu">
            <div className={styles.studioSessionMenuHeader}>
              <span>{studioCopy.topbar.signedIn}</span>
              <strong>{email}</strong>
            </div>
            <nav className={styles.studioSessionMenuNav} aria-label={studioCopy.topbar.primaryNavigation}>
              {NAV_ITEMS.map((item) => {
                const label = studioCopy.topbar.navigationLabels[item.id] ?? item.label;
                const badgeLabel = item.badge ? studioCopy.topbar.navigationLabels[item.badgeKey ?? item.id] ?? item.badge : null;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    prefetch={false}
                    role="menuitem"
                    className={styles.studioSessionMenuItem}
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <span>{label}</span>
                    {badgeLabel ? <small>{badgeLabel}</small> : null}
                  </Link>
                );
              })}
              {isAdmin ? (
                <Link
                  href="/admin"
                  prefetch={false}
                  role="menuitem"
                  className={styles.studioSessionMenuItem}
                  onClick={handleAdminNavigation}
                >
                  <span>{studioCopy.topbar.admin}</span>
                </Link>
              ) : null}
            </nav>
            <button type="button" className={styles.studioSessionMenuAction} onClick={handleSignOut}>
              <span>{studioCopy.topbar.signOut}</span>
              <kbd>⌘⇧Q</kbd>
            </button>
          </div>
        ) : null}
      </div>
      {email ? (
        <button
          type="button"
          className={styles.studioSessionExit}
          onClick={onExitToProjects}
          aria-label={studioCopy.topbar.exitToProjects}
          title={studioCopy.topbar.saveAndReturnToProjects}
        >
          <LogOut size={13} />
        </button>
      ) : null}
    </div>
  );
}
