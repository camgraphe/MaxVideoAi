'use client';

import Link from 'next/link';
import { LogOut, UserRound, Wallet } from 'lucide-react';
import { useHeaderAccountState } from '@/components/header/useHeaderAccountState';
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

export function StudioHeaderSession() {
  const { authResolved, email, wallet, signOut } = useHeaderAccountState();
  const walletAmount = wallet ? `$${wallet.balance.toFixed(2)}` : authResolved ? '--' : '...';
  const sessionLabel = email ?? (authResolved ? 'No session' : 'Loading session');
  const initials = initialsFromEmail(email);

  return (
    <div className={styles.studioSessionCluster} aria-label="Studio account status">
      <Link
        href="/billing"
        prefetch={false}
        className={styles.studioWalletPill}
        aria-label={`Studio wallet balance ${walletAmount}`}
      >
        <Wallet size={14} />
        <span>Wallet</span>
        <strong>{walletAmount}</strong>
      </Link>
      <div
        className={styles.studioSessionPill}
        title={sessionLabel}
        data-auth-state={email ? 'signed-in' : authResolved ? 'signed-out' : 'loading'}
      >
        <span className={styles.studioSessionAvatar} aria-hidden="true">
          {initials ? initials : <UserRound size={14} />}
        </span>
        <span className={styles.studioSessionText}>
          <span>Session</span>
          <strong>{sessionLabel}</strong>
        </span>
      </div>
      {email ? (
        <button
          type="button"
          className={styles.studioSessionSignOut}
          onClick={signOut}
          aria-label="Sign out of Studio"
          title="Sign out"
        >
          <LogOut size={13} />
        </button>
      ) : null}
    </div>
  );
}
