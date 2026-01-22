'use client';

import Image from 'next/image';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/marketing/LanguageToggle';
import { supabase } from '@/lib/supabaseClient';
import { NAV_ITEMS } from '@/components/AppSidebar';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { setLogoutIntent } from '@/lib/logout-intent';
import { clearLastKnownAccount, writeLastKnownUserId } from '@/lib/last-known';
import { MARKETING_NAV_DROPDOWNS } from '@/config/navigation';

export function MarketingNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopDropdownOpen, setDesktopDropdownOpen] = useState<string | null>(null);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const desktopDropdownCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const themeStorageKey = 'mv-theme';

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
      if (!token) {
        setIsAdmin(false);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [adminRes] = await Promise.all([fetch('/api/admin/access', { headers, cache: 'no-store' })]);
        const adminJson = await adminRes.json().catch(() => null);
        if (!mounted) return;
        const nextAdmin = Boolean(adminRes.ok && adminJson?.ok);
        setIsAdmin(nextAdmin);
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
        setIsAdmin(false);
        return;
      }
      const userId = applySession(session ?? null);
      void fetchAccountState(session?.access_token, userId ?? session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
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
        <div className="flex items-center gap-6">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-0 h-9 w-9 rounded-full border border-hairline bg-surface-glass-80 p-2 text-text-primary hover:bg-surface-2 lg:hidden"
            aria-label={t('nav.mobileToggle', 'Open menu')}
            onClick={() => setMobileMenuOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </Button>
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-primary whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
          <nav aria-label="Primary" className="hidden items-center gap-6 text-sm font-medium text-text-secondary lg:flex">
            {links.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href + '/'));
              const dropdown = MARKETING_NAV_DROPDOWNS[item.key];
              const label = t(`nav.linkLabels.${item.key}`, item.key);
              if (!dropdown) {
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={clsx(
                      'whitespace-nowrap transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                      isActive ? 'text-text-primary' : undefined
                    )}
                  >
                    {label}
                  </Link>
                );
              }
              const allLabel = t(dropdown.allLabelKey, dropdown.allLabelFallback);
              const isOpen = desktopDropdownOpen === item.key;
              return (
                <div
                  key={item.key}
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
                    className={clsx(
                      'inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                      isActive ? 'text-text-primary' : undefined
                    )}
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
                        {dropdown.items.map((entry) => (
                          <Link
                            key={entry.key}
                            href={entry.href}
                            className="rounded-input px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            role="menuitem"
                            onClick={() => closeDesktopDropdown(200)}
                          >
                            {t(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label)}
                          </Link>
                        ))}
                      </nav>
                      <div className="mt-2 border-t border-hairline pt-2">
                        <Link
                          href={dropdown.allHref}
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
        <div className="flex items-center gap-3 whitespace-nowrap">
          <div className="hidden items-center gap-1 md:flex">
            <LanguageToggle variant="icon" />
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
          {isAuthenticated ? (
            <>
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
                className="inline-flex whitespace-nowrap text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {login}
              </Link>
              <Link
                href="/app"
                prefetch={false}
                  className="inline-flex items-center whitespace-nowrap rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-card transition transform-gpu hover:bg-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
          <div className="mx-auto flex max-w-sm items-center justify-end">
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
            <div className="flex justify-end gap-2">
              <LanguageToggle variant="icon" />
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
              {links.map((item) => {
                const dropdown = MARKETING_NAV_DROPDOWNS[item.key];
                const label = t(`nav.linkLabels.${item.key}`, item.key);
                if (!dropdown) {
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={clsx(
                        'rounded-2xl border border-hairline px-4 py-3',
                        pathname === item.href ? 'bg-surface-2 text-text-primary' : 'bg-surface'
                      )}
                    >
                      {label}
                    </Link>
                  );
                }
                const allLabel = t(dropdown.allLabelKey, dropdown.allLabelFallback);
                const panelId = `mobile-${item.key}-panel`;
                const isOpen = Boolean(mobileDropdownOpen[item.key]);
                return (
                  <div key={item.key} className="rounded-2xl border border-hairline bg-surface px-4 py-3">
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
                        {dropdown.items.map((entry) => (
                          <Link
                            key={entry.key}
                            href={entry.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="rounded-input px-2 py-2 transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {t(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label)}
                          </Link>
                        ))}
                        <Link
                          href={dropdown.allHref}
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
            {isAuthenticated ? (
              <div className="stack-gap-sm">
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
