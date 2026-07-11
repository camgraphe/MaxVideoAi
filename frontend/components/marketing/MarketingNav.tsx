'use client';

import Image from 'next/image';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Moon, Sun } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/marketing/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { MarketingAccountMenu } from '@/components/marketing/MarketingAccountMenu';
import { MarketingDesktopNav } from '@/components/marketing/MarketingDesktopNav';
import { MarketingMobileMenu } from '@/components/marketing/MarketingMobileMenu';
import { consumeLogoutIntent, setLogoutIntent } from '@/lib/logout-intent';
import { clearLastKnownAccount, writeLastKnownUserId } from '@/lib/last-known';
import { MARKETING_TOP_NAV_LINKS } from '@/config/navigation';
import { buildLoginHref } from '@/lib/auth-entry-href';

type MarketingNavProps = {
  initialEmail?: string | null;
  initialIsAdmin?: boolean;
};

export function MarketingNav({ initialEmail = null, initialIsAdmin = false }: MarketingNavProps) {
  const pathname = usePathname();
  const isCompanyTrustHub = /^\/(?:fr\/|es\/)?company\/?$/.test(pathname ?? '');
  const isHomePage = /^\/(?:fr|es)?\/?$/.test(pathname ?? '');
  const { locale, t } = useI18n();
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [isAdmin, setIsAdmin] = useState(Boolean(initialIsAdmin));
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopDropdownOpen, setDesktopDropdownOpen] = useState<string | null>(null);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const desktopDropdownCloseTimeout = useRef<number | null>(null);
  const brand = t('nav.brand', 'MaxVideoAI') ?? 'MaxVideoAI';
  const compactBrand = brand.replace(/\s+/g, '');
  const maybeLinks = t('nav.links', MARKETING_TOP_NAV_LINKS);
  const links = Array.isArray(maybeLinks) && maybeLinks.length ? maybeLinks : MARKETING_TOP_NAV_LINKS;
  const login = t('nav.login', 'Log in');
  const cta = t('nav.cta', 'Generate');
  const generateLabel = t('nav.generate', 'Generate');
  const loginLabelMobile = locale === 'fr' ? 'Connexion' : locale === 'es' ? 'Entrar' : 'Log in';
  const generateLabelMobile = locale === 'fr' ? 'Generer' : locale === 'es' ? 'Generar' : 'Generate';
  const loginHref = buildLoginHref({ mode: 'signin', nextPath: '/app' });
  const isAuthenticated = Boolean(email);
  const themeStorageKey = 'mv-theme';

  const handleAdminNavigation = (event: React.MouseEvent<HTMLAnchorElement>) => {
    setAccountMenuOpen(false);
    event.preventDefault();
    window.location.assign('/admin');
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(themeStorageKey);
    const resolved = stored === 'dark' || stored === 'light' ? stored : 'light';
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
    const fetchAccountState = async (token?: string | null) => {
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

    const markLoggedOut = () => {
      clearLastKnownAccount();
      writeLastKnownUserId(null);
      setEmail(null);
      setIsAdmin(false);
      setAccountMenuOpen(false);
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

    const logoutIntentActive = consumeLogoutIntent();
    if (logoutIntentActive) {
      markLoggedOut();
    }

    let unsubscribeAuth: (() => void) | null = null;

    void import('@/lib/supabaseClient')
      .then(({ supabase }) => supabase.auth.getSession().then(({ data }) => ({ supabase, data })))
      .then(async ({ supabase, data }) => {
        if (logoutIntentActive) {
          await supabase.auth.signOut().catch(() => undefined);
          return;
        }
        const session = data.session ?? null;
        applySession(session);
        if (!mounted) return;
        void fetchAccountState(session?.access_token);

        const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
          const eventType = event as string;
          if (eventType === 'SIGNED_OUT' || eventType === 'USER_DELETED') {
            markLoggedOut();
            return;
          }
          if (logoutIntentActive) return;
          applySession(session ?? null);
          void fetchAccountState(session?.access_token);
        });
        unsubscribeAuth = () => subscription.subscription.unsubscribe();
      })
      .catch(() => {
        if (mounted) {
          setEmail(initialEmail);
          setIsAdmin(Boolean(initialIsAdmin));
        }
      });

    return () => {
      mounted = false;
      unsubscribeAuth?.();
    };
  }, [initialEmail, initialIsAdmin]);

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
    void import('@/lib/supabaseClient')
      .then(({ supabase }) => supabase.auth.signOut())
      .catch(() => undefined);
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

  if (isCompanyTrustHub) {
    return null;
  }

  return (
    <>
    <header className={clsx('sticky top-0 z-40 border-b border-hairline bg-surface dark:bg-surface-glass-90 dark:backdrop-blur-xl', isHomePage && 'home-monochrome')}>
      <div className="mx-auto flex h-16 max-w-[1460px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-6">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-0 h-9 w-9 shrink-0 rounded-full border border-hairline bg-surface p-2 text-text-primary hover:bg-surface-2 lg:hidden"
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
            prefetch={false}
            className="flex items-center gap-1.5 text-text-primary whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:gap-2"
          >
            <Image
              src="/assets/branding/logo-mark.svg"
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0"
              priority
            />
            <span className="text-sm font-semibold tracking-tight sm:text-lg">{compactBrand}</span>
          </Link>
          <MarketingDesktopNav
            desktopDropdownOpen={desktopDropdownOpen}
            links={links}
            pathname={pathname}
            t={t}
            onCloseDesktopDropdown={closeDesktopDropdown}
            onOpenDesktopDropdown={setDesktopDropdownOpen}
          />
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap sm:gap-3 lg:gap-4">
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
                className="inline-flex h-9 items-center rounded-pill border border-hairline px-3 text-xs font-semibold text-text-primary shadow-card transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:border-white dark:bg-white dark:text-[#030712] dark:shadow-[0_14px_32px_rgba(255,255,255,0.14)] dark:hover:border-white dark:hover:bg-slate-100 dark:hover:text-[#030712] sm:h-auto sm:px-4 sm:py-2 sm:text-sm"
              >
                <span className="sm:hidden">{generateLabelMobile}</span>
                <span className="hidden sm:inline">{generateLabel}</span>
              </Link>
              <MarketingAccountMenu
                accountMenuOpen={accountMenuOpen}
                avatarRef={avatarRef}
                email={email ?? ''}
                initials={initials}
                isAdmin={isAdmin}
                menuRef={menuRef}
                t={t}
                onAdminNavigation={handleAdminNavigation}
                onCloseAccountMenu={() => setAccountMenuOpen(false)}
                onSignOut={() => signOut({ closeAccountMenu: true })}
                onToggleAccountMenu={() => setAccountMenuOpen((prev) => !prev)}
              />
            </>
          ) : (
            <>
              <Link
                href={loginHref}
                prefetch={false}
                className="inline-flex text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:text-sm"
                data-analytics-event="cta_click"
                data-analytics-cta-name="marketing_nav_login"
                data-analytics-cta-location="marketing_nav_desktop"
                data-analytics-target-family="auth"
              >
                <span className="sm:hidden">{loginLabelMobile}</span>
                <span className="hidden sm:inline">{login}</span>
              </Link>
              <Link
                href="/app"
                prefetch={false}
                className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[image:var(--brand-gradient)] px-4 py-2 text-xs font-semibold text-on-brand shadow-[var(--shadow-brand-button)] transition hover:bg-[image:var(--brand-gradient-strong)] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:min-h-[48px] sm:rounded-input sm:px-6 sm:py-3 sm:text-sm"
                data-analytics-event="cta_click"
                data-analytics-cta-name="marketing_nav_start_app"
                data-analytics-cta-location="marketing_nav_desktop"
                data-analytics-target-family="workspace"
              >
                <span>{cta}</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
      {mobileMenuOpen ? (
        <MarketingMobileMenu
          cta={cta ?? 'Generate'}
          generateLabel={generateLabel ?? 'Generate'}
          isAuthenticated={isAuthenticated}
          isHomePage={isHomePage}
          links={links}
          login={login ?? 'Log in'}
          mobileDropdownOpen={mobileDropdownOpen}
          pathname={pathname}
          t={t}
          theme={theme}
          onClose={() => setMobileMenuOpen(false)}
          onSignOut={() => signOut({ closeMobileMenu: true })}
          onToggleDropdown={(key) =>
            setMobileDropdownOpen((prev) => ({
              ...prev,
              [key]: !prev[key],
            }))
          }
          onToggleTheme={toggleTheme}
        />
      ) : null}
    </>
  );
}
