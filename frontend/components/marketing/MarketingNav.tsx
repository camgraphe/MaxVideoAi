'use client';

import Image from 'next/image';
import clsx from 'clsx';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link, usePathname } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/marketing/LanguageToggle';
import { supabase } from '@/lib/supabaseClient';
import { NAV_ITEMS } from '@/components/AppSidebar';
import { Button } from '@/components/ui/Button';
import { setLogoutIntent } from '@/lib/logout-intent';
import {
  clearLastKnownAccount,
  readLastKnownUserId,
  readLastKnownWallet,
  writeLastKnownUserId,
  writeLastKnownWallet,
} from '@/lib/last-known';

export function MarketingNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const walletPromptCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walletPromptId = useId();
  const brand = t('nav.brand', 'MaxVideo AI') ?? 'MaxVideo AI';
  const defaultLinks: Array<{ key: string; href: string }> = [
    { key: 'models', href: '/models' },
    { key: 'examples', href: '/examples' },
    { key: 'pricing', href: '/pricing' },
    { key: 'workflows', href: '/workflows' },
    { key: 'docs', href: '/docs' },
    { key: 'blog', href: '/blog' },
  ];
  const maybeLinks = t('nav.links', defaultLinks);
  const links = Array.isArray(maybeLinks) && maybeLinks.length ? maybeLinks : defaultLinks;
  const login = t('nav.login', 'Log in');
  const cta = t('nav.cta', 'Start a render');
  const generateLabel = t('nav.generate', 'Generate');
  const isAuthenticated = Boolean(email);

  useEffect(() => {
    const storedWallet = readLastKnownWallet();
    if (storedWallet) {
      setWallet((current) => current ?? { balance: storedWallet.balance });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchAccountState = async (token?: string | null, userId?: string | null) => {
      if (!token) {
        setIsAdmin(false);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [walletRes, adminRes] = await Promise.all([
          fetch('/api/wallet', { headers }),
          fetch('/api/admin/access', { headers, cache: 'no-store' }),
        ]);
        const walletJson = await walletRes.json().catch(() => null);
        const adminJson = await adminRes.json().catch(() => null);
        if (!mounted) return;
        const nextAdmin = Boolean(adminRes.ok && adminJson?.ok);
        setIsAdmin(nextAdmin);
        const balance = typeof walletJson?.balance === 'number' ? walletJson.balance : null;
        if (balance !== null) {
          setWallet({ balance });
          const currency = typeof walletJson?.currency === 'string' ? walletJson.currency : undefined;
          writeLastKnownWallet({ balance, currency }, userId ?? readLastKnownUserId());
        }
      } catch {
        // Keep last known values on transient failures.
      }
    };

    const applySession = (session: Session | null) => {
      if (!mounted) return null;
      const userId = session?.user?.id ?? null;
      if (userId) {
        writeLastKnownUserId(userId);
      }
      setEmail(session?.user?.email ?? null);
      return userId;
    };

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const session = data.session ?? null;
        const userId = applySession(session);
        if (!mounted) return;
        void fetchAccountState(session?.access_token, userId ?? session?.user?.id ?? null);
      })
      .catch(() => {
        if (mounted) {
          setEmail(null);
        }
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      const eventType = event as string;
      if (eventType === 'SIGNED_OUT' || eventType === 'USER_DELETED') {
        clearLastKnownAccount();
        writeLastKnownUserId(null);
        setEmail(null);
        setWallet(null);
        setIsAdmin(false);
        return;
      }
      const userId = applySession(session ?? null);
      void fetchAccountState(session?.access_token, userId ?? session?.user?.id ?? null);
    });
    const handleInvalidate = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session ?? null;
      const userId = session?.user?.id ?? null;
      if (userId) {
        writeLastKnownUserId(userId);
      }
      await fetchAccountState(session?.access_token, userId);
    };
    window.addEventListener('wallet:invalidate', handleInvalidate);
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
      window.removeEventListener('wallet:invalidate', handleInvalidate);
      if (walletPromptCloseTimeout.current) {
        clearTimeout(walletPromptCloseTimeout.current);
        walletPromptCloseTimeout.current = null;
      }
    };
  }, []);

  const signOut = ({ closeAccountMenu, closeMobileMenu }: { closeAccountMenu?: boolean; closeMobileMenu?: boolean } = {}) => {
    if (closeAccountMenu) {
      setAccountMenuOpen(false);
    }
    if (closeMobileMenu) {
      setMobileMenuOpen(false);
    }
    setLogoutIntent();
    setEmail(null);
    setWallet(null);
    clearLastKnownAccount();
    writeLastKnownUserId(null);
    void supabase.auth.signOut().catch(() => undefined);
    const payload = JSON.stringify({});
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/auth/signout', blob);
    } else {
      void fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => undefined);
    }
    window.location.href = '/';
  };

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }
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

  useEffect(() => {
    return () => {
      if (walletPromptCloseTimeout.current) {
        clearTimeout(walletPromptCloseTimeout.current);
        walletPromptCloseTimeout.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.removeProperty('overflow');
      return;
    }
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.removeProperty('overflow');
      document.removeEventListener('keydown', handleKey);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  const initials = useMemo(() => {
    if (!email) return '?';
    const [namePart] = email.split('@');
    if (!namePart) return email.slice(0, 2).toUpperCase();
    const tokens = namePart
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
    if (tokens.length >= 2) {
      return (tokens[0][0] + tokens[1][0]).toUpperCase();
    }
    return namePart.slice(0, 2).toUpperCase();
  }, [email]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-4 font-display text-base font-semibold tracking-tight text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Image
            src="/assets/branding/logo-mark.svg"
            alt="MaxVideoAI"
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
          <span>{brand}</span>
        </Link>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-0 h-9 w-9 rounded-full border border-hairline bg-surface-glass-80 p-2 text-text-primary hover:bg-surface-2 md:hidden"
          aria-label={t('nav.mobileToggle', 'Open menu')}
          onClick={() => setMobileMenuOpen(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </Button>
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm font-medium text-text-secondary md:flex">
          {links.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href + '/'));
            return (
              <Link
                key={item.key}
                href={item.href}
                className={clsx(
                  'transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  isActive ? 'text-text-primary' : undefined
                )}
              >
                {t(`nav.linkLabels.${item.key}`, item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <LanguageToggle />
          </div>
          {isAuthenticated ? (
            <>
              <div className="hidden items-center gap-4 md:flex">
                <div
                  className="relative"
                  onMouseEnter={openWalletPrompt}
                  onMouseLeave={scheduleWalletPromptClose}
                  onFocusCapture={openWalletPrompt}
                  onBlurCapture={scheduleWalletPromptClose}
                >
                  <Link
                    href="/billing"
                    prefetch={false}
                    className="flex items-center gap-2 rounded-pill border border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary transition hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-describedby={walletPromptOpen ? walletPromptId : undefined}
                  >
                    <WalletGlyph size={16} className="text-text-primary" />
                    <span className="text-sm font-semibold tracking-normal text-text-primary">
                      {wallet ? `$${wallet.balance.toFixed(2)}` : '--'}
                    </span>
                  </Link>
                  {walletPromptOpen && (
                    <div
                      id={walletPromptId}
                      role="status"
                    className="absolute right-0 top-full z-10 mt-2 w-64 rounded-card border border-hairline bg-surface p-3 text-left text-xs text-text-primary shadow-card"
                      onMouseEnter={openWalletPrompt}
                      onMouseLeave={scheduleWalletPromptClose}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
                        {t('workspace.header.walletTopUp.label', 'Top up available')}
                      </p>
                      <p className="mt-1 text-sm text-text-primary">
                        {t(
                          'workspace.header.walletTopUp.copy',
                          'Click to add funds and keep generating without interruption.'
                        )}
                      </p>
                      <Link
                        href="/billing"
                        prefetch={false}
                className="mt-3 inline-flex w-full items-center justify-center rounded-input bg-brand px-3 py-2 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t('workspace.header.walletTopUp.cta', 'Top up now')}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              <Link
                href="/app"
                prefetch={false}
                className="inline-flex items-center rounded-pill border border-hairline px-4 py-2 text-sm font-semibold text-text-primary shadow-card transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {generateLabel}
              </Link>
              <div className="relative">
                <Button
                  ref={avatarRef}
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  className="min-h-0 h-10 w-10 rounded-full border border-hairline bg-gradient-to-br from-surface-2 via-surface-glass-95 to-surface text-sm font-semibold text-text-primary shadow-card hover:brightness-110"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                >
                  {initials}
                </Button>
                {accountMenuOpen && (
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
                    <nav
                      className="mb-2 flex flex-col gap-1"
                      aria-label={t('workspace.header.primaryNav', 'Primary navigation')}
                    >
                      {NAV_ITEMS.map((item) => {
                        const label = t(`workspace.sidebar.links.${item.id}`, item.label);
                        const badgeLabel = item.badge
                          ? t(`workspace.sidebar.badges.${item.badgeKey ?? item.id}`, item.badge)
                          : null;
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            prefetch={false}
                          className="flex items-center justify-between rounded-input px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => setAccountMenuOpen(false)}
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
                          onClick={() => setAccountMenuOpen(false)}
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
                      onClick={() => signOut({ closeAccountMenu: true })}
                    >
                      {t('workspace.header.signOut', 'Sign out')}
                      <span className="text-[11px] uppercase tracking-micro text-text-muted">⌘⇧Q</span>
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login?next=/app"
                className="hidden text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg md:inline-flex"
              >
                {login}
              </Link>
              <Link
                href="/app"
                prefetch={false}
                  className="inline-flex items-center rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-card transition transform-gpu hover:bg-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {cta}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-surface-glass-95 px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-sm items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-4 font-display text-base font-semibold text-text-primary"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Image
                src="/assets/branding/logo-mark.svg"
                alt="MaxVideoAI"
                width={28}
                height={28}
                className="h-7 w-7"
                priority
              />
              <span>{brand}</span>
            </Link>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-0 h-9 w-9 rounded-full border border-hairline bg-surface p-2 text-text-primary"
              aria-label={t('nav.mobileClose', 'Close menu')}
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </Button>
          </div>
          <div className="mx-auto mt-5 max-w-sm stack-gap-lg">
            <div className="flex justify-end">
              <LanguageToggle />
            </div>
            <nav className="flex flex-col gap-2 text-base font-semibold text-text-primary">
              {links.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={clsx(
                    'rounded-2xl border border-hairline px-4 py-3',
                    pathname === item.href ? 'bg-surface-2 text-text-primary' : 'bg-surface'
                  )}
                >
                  {t(`nav.linkLabels.${item.key}`, item.key)}
                </Link>
              ))}
            </nav>
            {isAuthenticated ? (
              <div className="stack-gap-sm">
                <div className="flex items-center justify-between rounded-2xl border border-hairline bg-surface px-4 py-3">
                  <span className="flex items-center gap-2 text-base font-semibold text-text-primary">
                    <WalletGlyph size={18} className="text-text-primary" />
                    {wallet ? `$${wallet.balance.toFixed(2)}` : '--'}
                  </span>
                </div>
                <Link
                  href="/app"
                  prefetch={false}
                  className="block rounded-2xl bg-brand px-4 py-3 text-center text-base font-semibold text-on-brand shadow-card"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {generateLabel}
                </Link>
                      <Button
                        type="button"
                        size="md"
                        variant="outline"
                        className="w-full rounded-2xl border-hairline px-4 py-3 text-base font-semibold text-text-primary shadow-card"
                        onClick={() => signOut({ closeMobileMenu: true })}
                      >
                        {t('workspace.header.signOut', 'Sign out')}
                      </Button>
              </div>
            ) : (
              <div className="stack-gap-sm">
                <Link
                  href="/login?next=/app"
                  className="block rounded-2xl border border-hairline px-4 py-3 text-center text-base font-semibold text-text-primary shadow-card"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {login}
                </Link>
                <Link
                  href="/app"
                  prefetch={false}
                  className="block rounded-2xl bg-brand px-4 py-3 text-center text-base font-semibold text-on-brand shadow-card"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {cta}
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function WalletGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3.5 7.75c0-1.1.9-2 2-2h12.25a1.5 1.5 0 0 1 0 3H4.5a1 1 0 0 1-1-1Z" />
      <rect x="3.5" y="9.5" width="17" height="8.5" rx="2.25" />
      <circle cx="16.25" cy="13.75" r="1" />
    </svg>
  );
}
