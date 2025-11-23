'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { Chip } from '@/components/ui/Chip';
import { NAV_ITEMS } from '@/components/AppSidebar';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ReconsentPrompt } from '@/components/legal/ReconsentPrompt';
import { AppLanguageToggle } from '@/components/AppLanguageToggle';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { setLogoutIntent } from '@/lib/logout-intent';

export function HeaderBar() {
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [member, setMember] = useState<{ tier: string } | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const walletPromptCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walletPromptId = useId();
  const serviceNoticeEnv = process.env.NEXT_PUBLIC_SERVICE_NOTICE;
  const envNotice =
    serviceNoticeEnv && serviceNoticeEnv.toLowerCase() === 'off'
      ? ''
      : serviceNoticeEnv
        ? serviceNoticeEnv.trim()
        : '';
  const localizedNotice =
    t(
      'workspace.header.serviceNotice',
      'Nous rencontrons actuellement des problèmes avec certains fournisseurs vidéo. Les rendus peuvent être retardés pendant que nous travaillons à la résolution.'
    ) ?? '';
  const defaultNotice: string = envNotice || localizedNotice || '';
  const [serviceNotice, setServiceNotice] = useState<string>(envNotice);
  const bannerMessage = serviceNotice?.trim() ?? '';
  const showServiceNotice = Boolean(bannerMessage);
  useEffect(() => {
    let mounted = true;
    const fetchAccountState = async (token?: string | null) => {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try {
        const [walletRes, memberRes] = await Promise.all([
          fetch('/api/wallet', { headers }).then((r) => r.json()),
          fetch('/api/member-status', { headers }).then((r) => r.json()),
        ]);
        if (!mounted) return;
        setWallet({ balance: walletRes.balance ?? 0 });
        setMember({ tier: memberRes.tier ?? 'Member' });
      } catch {
        if (mounted) {
          setWallet(null);
          setMember(null);
        }
      }
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user?.email ?? null);
      void fetchAccountState(data.session?.access_token);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      void fetchAccountState(session?.access_token);
    });
    const handleInvalidate = async () => {
      const { data } = await supabase.auth.getSession();
      await fetchAccountState(data.session?.access_token);
    };
    window.addEventListener('wallet:invalidate', handleInvalidate);
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('wallet:invalidate', handleInvalidate);
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const fetchNotice = async () => {
      try {
        const response = await fetch('/api/service-notice', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to fetch notice');
        }
        const data = (await response.json().catch(() => null)) as { enabled?: boolean; message?: string } | null;
        if (!isActive || !data) return;
        if (data.enabled && data.message) {
          setServiceNotice(data.message);
        } else {
          setServiceNotice('');
        }
      } catch {
        if (isActive && !envNotice) {
          setServiceNotice(defaultNotice);
        } else if (isActive && envNotice) {
          setServiceNotice(envNotice);
        }
      }
    };
    fetchNotice();
    const interval = window.setInterval(fetchNotice, 60_000);
    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envNotice, defaultNotice]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (avatarRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setAccountMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
  }, [accountMenuOpen]);

  const initials = useMemo(() => {
    if (!email) return '?';
    const [namePart] = email.split('@');
    if (!namePart) return email.slice(0, 2).toUpperCase();
    const tokens = namePart.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    if (tokens.length >= 2) {
      return (tokens[0][0] + tokens[1][0]).toUpperCase();
    }
    return namePart.slice(0, 2).toUpperCase();
  }, [email]);

  const marketingLinks = [
    { key: 'models', href: '/models' },
    { key: 'examples', href: '/examples' },
    { key: 'pricing', href: '/pricing' },
    { key: 'workflows', href: '/workflows' },
    { key: 'docs', href: '/docs' },
    { key: 'blog', href: '/blog' },
  ] as const;

  const openWalletPrompt = () => {
    if (walletPromptCloseTimeout.current) {
      clearTimeout(walletPromptCloseTimeout.current);
      walletPromptCloseTimeout.current = null;
    }
    setWalletPromptOpen(true);
  };

  const scheduleWalletPromptClose = () => {
    if (walletPromptCloseTimeout.current) {
      clearTimeout(walletPromptCloseTimeout.current);
    }
    walletPromptCloseTimeout.current = setTimeout(() => {
      setWalletPromptOpen(false);
      walletPromptCloseTimeout.current = null;
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (walletPromptCloseTimeout.current) {
        clearTimeout(walletPromptCloseTimeout.current);
      }
    };
  }, []);

  return (
    <>
      {showServiceNotice ? (
        <div className="relative z-40 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm" role="status" aria-live="polite">
          {bannerMessage}
        </div>
      ) : null}
      <header
        className={clsx(
          'sticky top-0 z-40 flex h-[var(--header-height)] items-center justify-between px-6 lg:px-8',
          'border-b border-border bg-white/80 backdrop-blur-xl'
        )}
      >
      <div className="flex items-center gap-8">
        <LogoMark />
        <nav className="hidden items-center gap-5 text-sm font-medium text-text-muted md:flex" aria-label={t('workspace.header.marketingNav', 'Marketing navigation')}>
          {marketingLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {t(`nav.linkLabels.${item.key}`, item.key)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 text-xs text-text-muted">
        <AppLanguageToggle />
        <div className="relative" onMouseEnter={openWalletPrompt} onMouseLeave={scheduleWalletPromptClose}>
          <Link
            href="/billing"
            className="flex items-center gap-2 rounded-input border border-hairline bg-white/80 px-3 py-1 uppercase tracking-micro transition-colors hover:border-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-describedby={walletPromptOpen ? walletPromptId : undefined}
            onFocus={openWalletPrompt}
            onBlur={scheduleWalletPromptClose}
          >
            <Image src="/assets/icons/wallet.svg" alt="" width={16} height={16} aria-hidden />
            <span className="text-sm font-semibold tracking-normal text-text-primary">${(wallet?.balance ?? 0).toFixed(2)}</span>
          </Link>
          {walletPromptOpen && (
            <div
              id={walletPromptId}
              role="status"
              className="absolute right-0 top-full z-10 mt-2 w-64 rounded-card border border-hairline bg-white p-3 text-left text-xs text-text-secondary shadow-card"
              onMouseEnter={openWalletPrompt}
              onMouseLeave={scheduleWalletPromptClose}
            >
              <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                {t('workspace.header.walletTopUp.label', 'Top up available')}
              </p>
              <p className="mt-1 text-sm text-text-primary">
                {t('workspace.header.walletTopUp.copy', 'Click to add funds and keep generating without interruption.')}
              </p>
              <Link
                href="/billing"
                className="mt-3 inline-flex w-full items-center justify-center rounded-input bg-accent px-3 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onFocus={openWalletPrompt}
                onBlur={scheduleWalletPromptClose}
              >
                {t('workspace.header.walletTopUp.cta', 'Top up now')}
              </Link>
            </div>
          )}
        </div>
        <Chip className="hidden px-2.5 py-1 text-[12px] md:inline-flex" variant="outline">
          {member?.tier ?? t('workspace.header.memberFallback', 'Member')}
        </Chip>
        {email ? (
          <div className="relative">
            <button
              ref={avatarRef}
              type="button"
              onClick={() => setAccountMenuOpen((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce4ff] bg-gradient-to-br from-[#dfe6ff] via-white/95 to-white text-sm font-semibold text-text-primary shadow-card transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
            >
              {initials}
            </button>
            {accountMenuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-3 w-56 rounded-card border border-hairline bg-white p-3 text-sm text-text-secondary shadow-card"
                role="menu"
              >
                <div className="mb-3 rounded-input bg-bg px-3 py-2">
                  <p className="text-xs uppercase tracking-micro text-text-muted">{t('workspace.header.signedIn', 'Signed in')}</p>
                  <p className="mt-1 truncate text-sm font-medium text-text-primary">{email}</p>
                </div>
                <nav className="mb-2 flex flex-col gap-1" aria-label={t('workspace.header.primaryNav', 'Primary navigation')}>
                  {NAV_ITEMS.map((item) => {
                    const label = t(`workspace.sidebar.links.${item.id}`, item.label);
                    const badgeLabel = item.badge
                      ? t(`workspace.sidebar.badges.${item.badgeKey ?? item.id}`, item.badge)
                      : null;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        role="menuitem"
                        className="flex items-center justify-between rounded-input px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-accentSoft/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        <span>{label}</span>
                        {badgeLabel ? (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-micro text-accent">
                            {badgeLabel}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-input px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-accentSoft/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={async () => {
                    setAccountMenuOpen(false);
                    setLogoutIntent();
                    try {
                      await supabase.auth.signOut();
                    } catch {
                      // ignore logout errors
                    }
                    await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
                    window.location.href = '/';
                  }}
                >
                  {t('workspace.header.signOut', 'Sign out')}
                  <span className="text-[11px] uppercase tracking-micro text-text-muted">⌘⇧Q</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="flex h-10 items-center justify-center rounded-input bg-accent px-3 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('workspace.header.createAccount', 'Create account')}
            </Link>
            <Link
              href="/login?mode=signin"
              className="flex h-10 items-center justify-center rounded-input border border-hairline bg-white/80 px-3 text-sm font-medium text-text-primary transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('workspace.header.signIn', 'Sign in')}
            </Link>
          </div>
        )}
      </div>
      </header>
      <ReconsentPrompt />
    </>
  );
}

function LogoMark() {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-2" aria-label={t('workspace.header.logoAria', 'Go to marketing homepage')}>
      <Image src="/assets/branding/logo-mark.svg" alt="MaxVideoAI" width={28} height={28} priority />
      <span className="text-lg font-semibold tracking-tight text-text-primary">MaxVideo AI</span>
    </Link>
  );
}
