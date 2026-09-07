'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';
import { AppGlyph } from '@/components/app/AppGlyph';
import { ButtonLink } from '@/components/ui/Button';

type HeaderTranslate = (key: string, fallback: string) => string | undefined;

type HeaderWalletStatusProps = {
  authResolved: boolean;
  promptId: string;
  t: HeaderTranslate;
  wallet: { balance: number } | null;
  walletPromptOpen: boolean;
  onOpenPrompt: () => void;
  onSchedulePromptClose: () => void;
};

export function HeaderWalletStatus({
  authResolved,
  promptId,
  t,
  wallet,
  walletPromptOpen,
  onOpenPrompt,
  onSchedulePromptClose,
}: HeaderWalletStatusProps) {
  const walletAmount = wallet ? `$${wallet.balance.toFixed(2)}` : authResolved ? '--' : '...';
  const walletBaseLabel = t('workspace.header.wallet.label', 'Wallet') ?? 'Wallet';
  const missingLabel = authResolved ? t('workspace.header.wallet.unavailable', 'Unavailable') ?? 'Unavailable' : t('workspace.header.wallet.loading', 'Loading…') ?? 'Loading…';
  const walletLabel = `${walletBaseLabel}: ${wallet ? walletAmount : missingLabel}`;

  return (
    <div className="relative shrink-0" onMouseEnter={onOpenPrompt} onMouseLeave={onSchedulePromptClose}>
      <Link
        href="/billing"
        prefetch={false}
        className="app-wallet-trigger flex !min-h-11 w-[72px] items-center justify-center gap-1 rounded-input border border-hairline bg-surface px-2 py-1 text-text-primary shadow-sm transition-colors hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-1.5 lg:w-24 lg:gap-2 lg:px-3"
        aria-label={walletLabel}
        aria-describedby={walletPromptOpen ? promptId : undefined}
        onFocus={onOpenPrompt}
        onBlur={onSchedulePromptClose}
      >
        <UIIcon icon={Wallet} size={16} className="app-wallet-legacy-icon text-text-primary" />
        <span hidden className="app-wallet-glyph"><AppGlyph name="wallet" /></span>
        <span className="app-wallet-copy"><span hidden className="app-wallet-label">{walletBaseLabel}</span>
        <span className="max-w-[5rem] truncate text-xs font-semibold tracking-normal text-text-primary sm:max-w-none sm:text-sm">
          {wallet ? walletAmount : <><span className="app-wallet-fallback">{walletAmount}</span><span hidden className="app-wallet-state">{missingLabel}</span></>}
        </span></span>
      </Link>
      {walletPromptOpen ? (
        <div
          id={promptId}
          role="status"
          className="absolute right-0 top-full z-10 mt-2 w-64 rounded-card border border-hairline bg-surface p-3 text-left text-xs text-text-primary shadow-card"
          onMouseEnter={onOpenPrompt}
          onMouseLeave={onSchedulePromptClose}
        >
          <p className="text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
            {t('workspace.header.walletTopUp.label', 'Top up available')}
          </p>
          <p className="mt-1 text-sm text-text-primary">
            {t('workspace.header.walletTopUp.copy', 'Click to add funds and keep generating without interruption.')}
          </p>
          <ButtonLink
            href="/billing"
            prefetch={false}
            size="sm"
            className="mt-3 w-full shadow-card"
            onFocus={onOpenPrompt}
            onBlur={onSchedulePromptClose}
          >
            {t('workspace.header.walletTopUp.cta', 'Top up now')}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
