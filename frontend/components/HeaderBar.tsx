'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { NAV_ITEMS } from '@/components/AppSidebar';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { ChevronDown, Moon, Sun, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { ReconsentPrompt } from '@/components/legal/ReconsentPrompt';
import { AppLanguageToggle } from '@/components/AppLanguageToggle';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { setLogoutIntent } from '@/lib/logout-intent';
import { usePathname } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import {
  clearLastKnownAccount,
  readLastKnownUserId,
  readLastKnownWallet,
  writeLastKnownUserId,
  writeLastKnownWallet,
} from '@/lib/last-known';
import { MARKETING_NAV_DROPDOWNS } from '@/config/navigation';
import type { LocalizedLinkHref } from '@/i18n/navigation';

function resolveLocalizedHref(href: LocalizedLinkHref): string {
  if (typeof href === 'string') {
    return href;
  }
  const pathname = typeof href.pathname === 'string' ? href.pathname : '';
  const params = 'params' in href ? href.params : undefined;
  let resolved = pathname;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      resolved = resolved.replace(`[${key}]`, encodeURIComponent(String(value)));
    });
  }
  const query = 'query' in href ? href.query : undefined;
  if (query) {
    const search = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        search.set(key, String(value));
      }
    });
    const suffix = search.toString();
    if (suffix) {
      resolved = `${resolved}?${suffix}`;
    }
  }
  return resolved;
}

export function HeaderBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<Record<string, boolean>>({});
  const [desktopDropdownOpen, setDesktopDropdownOpen] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const desktopDropdownCloseTimeout = useRef<number | null>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const walletPromptCloseTimeout = useRef<number | null>(null);
  const walletPromptId = useId();
  const themeStorageKey = 'mv-theme';
  const loginLabel = t('nav.login', 'Log in');
  const ctaLabel = t('nav.cta', 'Start a render');
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
    const storedWallet = readLastKnownWallet();
    if (storedWallet) {
      setWallet((current) => current ?? { balance: storedWallet.balance });
    }
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(themeStorageKey);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const resolved = stored === 'dark' || stored === 'light' ? stored : prefersDark ? 'dark' : 'light';
    setTheme(resolved);
    if (resolved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    window.localStorage.setItem(themeStorageKey, nextTheme);
  };
  useEffect(() => {
    let mounted = true;
    const fetchAccountState = async (token?: string | null, userId?: string | null) => {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try {
        const [walletRes, adminRes] = await Promise.all([
          fetch('/api/wallet', { headers, cache: 'no-store' }),
          fetch('/api/admin/access', { headers, cache: 'no-store' }),
        ]);
        const walletJson = await walletRes.json().catch(() => null);
        const adminJson = await adminRes.json().catch(() => null);
        if (!mounted) return;
        const nextAdmin = Boolean(adminRes.ok && adminJson?.ok);
        setIsAdmin(nextAdmin);
        if (walletRes.ok) {
          const nextBalance = typeof walletJson?.balance === 'number' ? walletJson.balance : null;
          if (nextBalance !== null) {
            setWallet({ balance: nextBalance });
            const nextCurrency = typeof walletJson?.currency === 'string' ? walletJson.currency : undefined;
            writeLastKnownWallet(
              { balance: nextBalance, currency: nextCurrency },
              userId ?? readLastKnownUserId()
            );
          }
        }
      } catch {
        // Keep last known values on transient failures.
      }
    };
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const session = data.session ?? null;
        const userId = session?.user?.id ?? null;
        if (userId) {
          writeLastKnownUserId(userId);
        }
        setEmail(session?.user?.email ?? null);
        setAuthResolved(true);
        void fetchAccountState(session?.access_token, userId);
      })
      .catch(() => {
        if (mounted) {
          setEmail(null);
          setAuthResolved(true);
        }
      });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      const eventType = event as string;
      if (eventType === 'SIGNED_OUT' || eventType === 'USER_DELETED') {
        clearLastKnownAccount();
        writeLastKnownUserId(null);
        setEmail(null);
        setWallet(null);
        setIsAdmin(false);
        setAuthResolved(true);
        return;
      }
      const userId = session?.user?.id ?? null;
      if (userId) {
        writeLastKnownUserId(userId);
      }
      setEmail(session?.user?.email ?? null);
      setAuthResolved(true);
      void fetchAccountState(session?.access_token, userId);
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
      sub.subscription.unsubscribe();
      window.removeEventListener('wallet:invalidate', handleInvalidate);
    };
  }, []);

  const sendSignOutRequest = () => {
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
  };

  const handleSignOut = () => {
    setAccountMenuOpen(false);
    setLogoutIntent();
    setEmail(null);
    setWallet(null);
    setIsAdmin(false);
    clearLastKnownAccount();
    writeLastKnownUserId(null);
    sendSignOutRequest();
    window.location.href = '/';
  };

  const openWalletPrompt = () => {
    if (walletPromptCloseTimeout.current) {
      window.clearTimeout(walletPromptCloseTimeout.current);
      walletPromptCloseTimeout.current = null;
    }
    setWalletPromptOpen(true);
  };

  const scheduleWalletPromptClose = () => {
    if (walletPromptCloseTimeout.current) {
      window.clearTimeout(walletPromptCloseTimeout.current);
    }
    walletPromptCloseTimeout.current = window.setTimeout(() => {
      setWalletPromptOpen(false);
      walletPromptCloseTimeout.current = null;
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (walletPromptCloseTimeout.current) {
        window.clearTimeout(walletPromptCloseTimeout.current);
      }
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

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.removeProperty('overflow');
      setMobileDropdownOpen({});
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
    setMobileDropdownOpen({});
    setDesktopDropdownOpen(null);
    if (desktopDropdownCloseTimeout.current) {
      window.clearTimeout(desktopDropdownCloseTimeout.current);
      desktopDropdownCloseTimeout.current = null;
    }
  }, [pathname]);

  const closeDesktopDropdown = (delay = 0) => {
    if (desktopDropdownCloseTimeout.current) {
      window.clearTimeout(desktopDropdownCloseTimeout.current);
      desktopDropdownCloseTimeout.current = null;
    }
    if (delay <= 0) {
      setDesktopDropdownOpen(null);
      return;
    }
    desktopDropdownCloseTimeout.current = window.setTimeout(() => {
      setDesktopDropdownOpen(null);
      desktopDropdownCloseTimeout.current = null;
    }, delay);
  };

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
  const isAuthenticated = Boolean(email);

  return (
    <>
      {showServiceNotice ? (
        <div className="relative z-40 border-b border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-2 text-center text-xs font-medium text-[var(--warning)] sm:text-sm" role="status" aria-live="polite">
          {bannerMessage}
        </div>
      ) : null}
      <header
        className={clsx(
          'sticky top-0 z-40 flex h-[var(--header-height)] items-center justify-between px-6 lg:px-8',
          'border-b border-border bg-surface'
        )}
      >
        <div className="flex items-center gap-4 md:gap-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-0 h-9 w-9 rounded-full border border-hairline bg-surface-glass-80 p-2 text-text-primary hover:bg-surface-2 md:hidden"
            aria-label={t('workspace.header.mobileToggle', 'Open menu')}
            onClick={() => setMobileMenuOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </Button>
          <LogoMark />
          <nav
            className="hidden items-center gap-6 text-sm font-medium text-text-muted md:flex"
            aria-label={t('workspace.header.marketingNav', 'Marketing navigation')}
          >
            {marketingLinks.map((item) => {
              const dropdown = MARKETING_NAV_DROPDOWNS[item.key];
              const label = t(`nav.linkLabels.${item.key}`, item.key);
              if (!dropdown) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    {label}
                  </Link>
                );
              }
              const isOpen = desktopDropdownOpen === item.key;
              const allLabel = t(dropdown.allLabelKey, dropdown.allLabelFallback);
              return (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => setDesktopDropdownOpen(item.key)}
                  onMouseLeave={() => closeDesktopDropdown()}
                  onFocus={() => setDesktopDropdownOpen(item.key)}
                  onBlur={(event) => {
                    const next = event.relatedTarget as Node | null;
                    if (!event.currentTarget.contains(next)) {
                      closeDesktopDropdown();
                    }
                  }}
                >
                  <Link
                    href={item.href}
                    aria-haspopup="menu"
                    className="inline-flex items-center gap-1 transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    onClick={() => closeDesktopDropdown(200)}
                  >
                    <span>{label}</span>
                    <UIIcon icon={ChevronDown} size={14} strokeWidth={1.6} className="text-text-muted" />
                  </Link>
                  <div
                    className={clsx(
                      'absolute left-0 top-full z-20 pt-2 transition duration-150',
                      isOpen ? 'visible opacity-100' : 'invisible opacity-0'
                    )}
                  >
                    <div className="min-w-[240px] rounded-card border border-hairline bg-surface p-3 shadow-card">
                      <nav className="flex flex-col gap-1" role="menu" aria-label={label}>
                        {dropdown.items.map((entry) => {
                          const href = resolveLocalizedHref(entry.href);
                          return (
                            <Link
                              key={entry.key}
                              href={href}
                              className="rounded-input px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              role="menuitem"
                              onClick={() => closeDesktopDropdown(200)}
                            >
                              {t(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label)}
                            </Link>
                          );
                        })}
                      </nav>
                      <div className="mt-2 border-t border-hairline pt-2">
                        <Link
                          href={resolveLocalizedHref(dropdown.allHref)}
                          className="flex items-center gap-2 rounded-input px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => closeDesktopDropdown(200)}
                        >
                          {allLabel}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 text-xs text-text-muted">
          <div className="relative" onMouseEnter={openWalletPrompt} onMouseLeave={scheduleWalletPromptClose}>
            <Link
              href="/billing"
              prefetch={false}
              className="flex items-center gap-2 rounded-input border border-hairline bg-surface/80 px-3 py-1 uppercase tracking-micro transition-colors hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-describedby={walletPromptOpen ? walletPromptId : undefined}
              onFocus={openWalletPrompt}
              onBlur={scheduleWalletPromptClose}
            >
              <UIIcon icon={Wallet} size={16} className="text-text-primary" />
              <span className="text-sm font-semibold tracking-normal text-text-primary">
                {wallet ? `$${wallet.balance.toFixed(2)}` : authResolved ? '--' : '...'}
              </span>
            </Link>
            {walletPromptOpen ? (
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
                  {t('workspace.header.walletTopUp.copy', 'Click to add funds and keep generating without interruption.')}
                </p>
                <ButtonLink
                  href="/billing"
                  prefetch={false}
                  size="sm"
                  className="mt-3 w-full shadow-card"
                  onFocus={openWalletPrompt}
                  onBlur={scheduleWalletPromptClose}
                >
                  {t('workspace.header.walletTopUp.cta', 'Top up now')}
                </ButtonLink>
              </div>
            ) : null}
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <AppLanguageToggle />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-text-primary hover:bg-surface-2"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">
                <UIIcon icon={theme === 'dark' ? Sun : Moon} size={16} strokeWidth={1.75} />
              </span>
            </Button>
          </div>
          {email ? (
            <div className="relative">
              <Button
                ref={avatarRef}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="h-10 w-10 min-h-0 rounded-full border border-border bg-surface-2 p-0 text-sm font-semibold text-text-primary shadow-card hover:bg-surface-3"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
              >
                {initials}
                <span className="absolute -bottom-0.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center text-[10px] text-text-muted opacity-40">
                  <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5">
                    <path d="m2.2 4.6 3.8 3.8 3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
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
                        role="menuitem"
                        className="flex items-center justify-between rounded-input px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setAccountMenuOpen(false)}
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
                    onClick={handleSignOut}
                  >
                    {t('workspace.header.signOut', 'Sign out')}
                    <span className="text-[11px] uppercase tracking-micro text-text-muted">⌘⇧Q</span>
                  </Button>
                </div>
              )}
            </div>
          ) : authResolved ? (
            <div className="flex items-center gap-2">
              <ButtonLink
                href="/login"
                size="sm"
                className="h-10 px-3 shadow-card"
              >
                {t('workspace.header.createAccount', 'Create account')}
              </ButtonLink>
              <ButtonLink
                href="/login?mode=signin"
                variant="outline"
                size="sm"
                className="h-10 px-3"
              >
                {t('workspace.header.signIn', 'Sign in')}
              </ButtonLink>
            </div>
          ) : (
            <div className="h-10 w-[180px] rounded-input bg-surface-2 shadow-sm" aria-hidden />
          )}
        </div>
      </header>
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-surface-glass-95 px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-sm items-center justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-0 h-9 w-9 rounded-full border border-hairline bg-surface p-2 text-text-primary"
              aria-label={t('workspace.header.mobileClose', 'Close menu')}
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </Button>
          </div>
          <div className="mx-auto mt-5 max-w-sm stack-gap-lg">
            <div className="flex justify-end gap-2">
              <AppLanguageToggle />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-text-primary hover:bg-surface-2"
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={toggleTheme}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  <UIIcon icon={theme === 'dark' ? Sun : Moon} size={16} strokeWidth={1.75} />
                </span>
              </Button>
            </div>
            <nav className="flex flex-col gap-3 text-base font-semibold text-text-primary">
              {marketingLinks.map((item) => {
                const dropdown = MARKETING_NAV_DROPDOWNS[item.key];
                const label = t(`nav.linkLabels.${item.key}`, item.key);
                if (!dropdown) {
                  const href = item.href;
                  const currentPath = pathname ?? '';
                  const isActive = currentPath === href || currentPath.startsWith(`${href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      className={clsx(
                        'rounded-2xl border border-hairline px-4 py-3',
                        isActive ? 'bg-surface-2 text-text-primary' : 'bg-surface'
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {label}
                    </Link>
                  );
                }
                const panelId = `mobile-${item.key}-panel`;
                const isOpen = Boolean(mobileDropdownOpen[item.key]);
                const allLabel = t(dropdown.allLabelKey, dropdown.allLabelFallback);
                return (
                  <div key={item.href} className="rounded-2xl border border-hairline bg-surface px-4 py-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() =>
                        setMobileDropdownOpen((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key],
                        }))
                      }
                    >
                      <span>{label}</span>
                      <UIIcon
                        icon={ChevronDown}
                        size={14}
                        strokeWidth={1.6}
                        className={clsx('text-text-muted transition-transform', isOpen ? 'rotate-180' : undefined)}
                      />
                    </button>
                    {isOpen ? (
                      <div id={panelId} className="mt-2 flex flex-col gap-1 text-sm font-medium text-text-secondary">
                        {dropdown.items.map((entry) => {
                          const href = resolveLocalizedHref(entry.href);
                          return (
                            <Link
                              key={entry.key}
                              href={href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="rounded-input px-2 py-2 transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {t(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label)}
                            </Link>
                          );
                        })}
                        <Link
                          href={resolveLocalizedHref(dropdown.allHref)}
                          onClick={() => setMobileMenuOpen(false)}
                          className="mt-1 rounded-input px-2 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {allLabel}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
            {isAuthenticated ? null : (
              <div className="stack-gap-sm">
                <Link
                  href="/login?next=/app"
                  className="block rounded-2xl border border-hairline px-4 py-3 text-center text-base font-semibold text-text-primary shadow-card"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {loginLabel}
                </Link>
                <Link
                  href="/app"
                  prefetch={false}
                  className="block rounded-2xl bg-brand px-4 py-3 text-center text-base font-semibold text-on-brand shadow-card"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {ctaLabel}
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
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
