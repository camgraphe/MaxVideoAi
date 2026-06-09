'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { LogOut, UserRound, Wallet } from 'lucide-react';
import { NAV_ITEMS } from '@/components/AppSidebar';
import { useHeaderAccountState } from '@/components/header/useHeaderAccountState';
import { useI18n } from '@/lib/i18n/I18nProvider';
import styles from '../maxvideoai-editor.module.css';

function initialsFromEmail(email: string | null): string {
  if (!email) return '';
  const name = email.split('@')[0]?.trim() ?? '';
  const parts = name.split(/[._\-+\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

type StudioHeaderSessionProps = {
  onExitToProjects: () => void;
};

export function StudioHeaderSession({ onExitToProjects }: StudioHeaderSessionProps) {
  const { t } = useI18n();
  const { authResolved, email, wallet, isAdmin, signOut } = useHeaderAccountState();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const walletPromptId = useId();
  const walletButtonRef = useRef<HTMLButtonElement>(null);
  const walletPromptRef = useRef<HTMLDivElement>(null);
  const sessionButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const walletAmount = wallet ? `$${wallet.balance.toFixed(2)}` : authResolved ? '--' : '...';
  const sessionLabel = email ?? (authResolved ? 'No session' : 'Loading session');
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
    <div className={styles.studioSessionCluster} aria-label="Studio account status">
      <div className={styles.studioWalletShell}>
        <button
          ref={walletButtonRef}
          type="button"
          className={styles.studioWalletPill}
          aria-label={`Studio wallet balance ${walletAmount}`}
          aria-expanded={walletPromptOpen}
          aria-describedby={walletPromptOpen ? walletPromptId : undefined}
          onClick={() => {
            setAccountMenuOpen(false);
            setWalletPromptOpen((open) => !open);
          }}
        >
          <Wallet size={14} />
          <span>Wallet</span>
          <strong>{walletAmount}</strong>
        </button>
        {walletPromptOpen ? (
          <div
            ref={walletPromptRef}
            id={walletPromptId}
            role="status"
            className={styles.studioWalletPrompt}
          >
            <p>{t('workspace.header.walletTopUp.label', 'Top up available')}</p>
            <span>{t('workspace.header.walletTopUp.copy', 'Click to add funds and keep generating without interruption.')}</span>
            <Link href="/billing" prefetch={false} className={styles.studioWalletPromptCta}>
              {t('workspace.header.walletTopUp.cta', 'Top up now')}
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
          <span className={styles.studioSessionText}>
            <span>Session</span>
            <strong>{sessionLabel}</strong>
          </span>
        </button>
        {accountMenuOpen && email ? (
          <div ref={menuRef} className={styles.studioSessionMenu} role="menu">
            <div className={styles.studioSessionMenuHeader}>
              <span>{t('workspace.header.signedIn', 'Signed in')}</span>
              <strong>{email}</strong>
            </div>
            <nav className={styles.studioSessionMenuNav} aria-label={t('workspace.header.primaryNav', 'Primary navigation')}>
              {NAV_ITEMS.map((item) => {
                const label = t(`workspace.sidebar.links.${item.id}`, item.label);
                const badgeLabel = item.badge ? t(`workspace.sidebar.badges.${item.badgeKey ?? item.id}`, item.badge) : null;
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
                  <span>Admin</span>
                </Link>
              ) : null}
            </nav>
            <button type="button" className={styles.studioSessionMenuAction} onClick={handleSignOut}>
              <span>{t('workspace.header.signOut', 'Sign out')}</span>
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
          aria-label="Exit to projects"
          title="Save and return to projects"
        >
          <LogOut size={13} />
        </button>
      ) : null}
    </div>
  );
}
