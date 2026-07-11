'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { ReconsentPrompt } from '@/components/legal/ReconsentPrompt';
import { AppLanguageToggle } from '@/components/AppLanguageToggle';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { MARKETING_NAV_DROPDOWNS, MARKETING_TOP_NAV_LINKS } from '@/config/navigation';
import { SERVICE_NOTICE_POLLING_INTERVAL_MS } from '@/lib/service-notice-polling';
import { HeaderAccountMenu } from '@/components/header/HeaderAccountMenu';
import { HeaderLogoMark } from '@/components/header/HeaderLogoMark';
import { HeaderMobileMenu } from '@/components/header/HeaderMobileMenu';
import { HeaderWalletStatus } from '@/components/header/HeaderWalletStatus';
import {
  getGuestMobileNavItems,
  normalizeMarketingLinks,
  resolveLocalizedHref,
} from '@/components/header/header-nav-helpers';
import { useHeaderAccountState } from '@/components/header/useHeaderAccountState';
import { buildAuthReturnTarget, buildLoginHref } from '@/lib/auth-entry-href';

export function HeaderBar() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { email, authResolved, wallet, isAdmin, signOut } = useHeaderAccountState();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<Record<string, boolean>>({});
  const [desktopDropdownOpen, setDesktopDropdownOpen] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const desktopDropdownCloseTimeout = useRef<number | null>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  const handleAdminNavigation = (event: React.MouseEvent<HTMLAnchorElement>) => {
    setAccountMenuOpen(false);
    event.preventDefault();
    window.location.assign('/admin');
  };
  const menuRef = useRef<HTMLDivElement>(null);
  const walletPromptCloseTimeout = useRef<number | null>(null);
  const walletPromptId = useId();
  const themeStorageKey = 'mv-theme';
  const loginLabel = t('nav.login', 'Log in');
  const ctaLabel = t('nav.cta', 'Generate');
  const createAccountMobile = locale === 'fr' ? 'Creer' : locale === 'es' ? 'Crear' : 'Create';
  const signInMobile = locale === 'fr' ? 'Connexion' : locale === 'es' ? 'Entrar' : 'Sign in';
  const themeToggleLabel =
    theme === 'dark'
      ? t('workspace.header.themeToggle.toLight', 'Switch to light theme')
      : t('workspace.header.themeToggle.toDark', 'Switch to dark theme');
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

  const handleSignOut = () => {
    setAccountMenuOpen(false);
    signOut();
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
        const response = await fetch('/api/service-notice');
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
    const interval = window.setInterval(fetchNotice, SERVICE_NOTICE_POLLING_INTERVAL_MS);
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

  const rawMarketingLinks = t('nav.links', MARKETING_TOP_NAV_LINKS);
  const marketingLinks = useMemo(() => normalizeMarketingLinks(rawMarketingLinks), [rawMarketingLinks]);
  const isAuthenticated = Boolean(email);
  const guestMobileNavItems = useMemo(() => getGuestMobileNavItems(), []);
  const authReturnTarget = buildAuthReturnTarget(pathname, searchParams);
  const signupHref = buildLoginHref({ mode: 'signup', nextPath: authReturnTarget });
  const signinHref = buildLoginHref({ mode: 'signin', nextPath: authReturnTarget });

  return (
    <>
      {showServiceNotice ? (
        <div className="relative z-40 border-b border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-2 text-center text-xs font-medium text-[var(--warning)] sm:text-sm" role="status" aria-live="polite">
          {bannerMessage}
        </div>
      ) : null}
      <header
        className={clsx(
          'sticky top-0 z-40 flex h-[var(--header-height)] items-center justify-between px-5 lg:px-8',
          'border-b border-hairline bg-surface'
        )}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-4 md:gap-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-0 h-9 w-9 shrink-0 rounded-full border border-hairline bg-surface p-2 text-text-primary hover:bg-surface-2 xl:hidden"
            aria-label={t('workspace.header.mobileToggle', 'Open menu')}
            onClick={() => setMobileMenuOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </Button>
          <HeaderLogoMark />
          <nav
            className="hidden items-center gap-7 text-sm font-medium text-text-secondary xl:flex"
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
                    className="transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    {label}
                  </Link>
                );
              }
              const isOpen = desktopDropdownOpen === item.key;
              const allLabel = t(dropdown.allLabelKey, dropdown.allLabelFallback);
              const hasSections = Boolean(dropdown.sections?.length);
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
                    className="inline-flex items-center gap-1 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
                    <div
                      className={clsx(
                        'rounded-card border border-hairline bg-surface p-2 shadow-float',
                        hasSections ? 'min-w-[520px] w-max' : item.key === 'compare' ? 'min-w-[280px] w-max' : 'min-w-[240px]'
                      )}
                    >
                      <div className={clsx('grid gap-3', hasSections ? 'grid-cols-[1fr_1fr]' : 'grid-cols-1')}>
                        <nav className="flex flex-col gap-1" role="menu" aria-label={label}>
                          <Link
                            href={resolveLocalizedHref(dropdown.allHref)}
                            className="rounded-input px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
                            role="menuitem"
                            onClick={() => closeDesktopDropdown(200)}
                          >
                            {allLabel}
                          </Link>
                          {dropdown.items.map((entry) => {
                            const href = resolveLocalizedHref(entry.href);
                            return (
                              <Link
                                key={entry.key}
                                href={href}
                                className="rounded-input px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
                                role="menuitem"
                                onClick={() => closeDesktopDropdown(200)}
                              >
                                {t(`nav.dropdown.${item.key}.items.${entry.key}`, entry.label)}
                              </Link>
                            );
                          })}
                        </nav>
                        {dropdown.sections?.map((section) => {
                          const sectionLabel = section.titleKey
                            ? t(section.titleKey, section.titleFallback ?? section.key)
                            : (section.titleFallback ?? label);

                          return (
                            <nav
                              key={section.key}
                              className="flex flex-col gap-1 border-l border-hairline pl-3"
                              role="menu"
                              aria-label={sectionLabel}
                            >
                              {!section.hideTitle && sectionLabel ? (
                                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
                                  {sectionLabel}
                                </p>
                              ) : null}
                              {section.items.map((entry) => {
                                const href = resolveLocalizedHref(entry.href);
                                return (
                                  <Link
                                    key={entry.key}
                                    href={href}
                                    className={clsx(
                                      'rounded-input px-3 py-2 text-sm transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap',
                                      entry.emphasized ? 'font-semibold text-text-primary' : 'text-text-secondary'
                                    )}
                                    role="menuitem"
                                    onClick={() => closeDesktopDropdown(200)}
                                  >
                                    {t(`nav.dropdown.${item.key}.sections.${section.key}.items.${entry.key}`, entry.label)}
                                  </Link>
                                );
                              })}
                            </nav>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 text-xs text-text-muted sm:gap-3">
          <HeaderWalletStatus
            authResolved={authResolved}
            promptId={walletPromptId}
            t={t}
            wallet={wallet}
            walletPromptOpen={walletPromptOpen}
            onOpenPrompt={openWalletPrompt}
            onSchedulePromptClose={scheduleWalletPromptClose}
          />
          <div className="hidden items-center gap-1 md:flex">
            <AppLanguageToggle />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 w-10 rounded-full border border-transparent p-0 text-text-secondary hover:border-hairline hover:bg-surface-2 hover:text-text-primary"
              aria-label={themeToggleLabel}
              onClick={toggleTheme}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">
                <UIIcon icon={theme === 'dark' ? Sun : Moon} size={16} strokeWidth={1.75} />
              </span>
            </Button>
          </div>
          {email ? (
            <HeaderAccountMenu
              accountMenuOpen={accountMenuOpen}
              avatarRef={avatarRef}
              email={email}
              initials={initials}
              isAdmin={isAdmin}
              menuRef={menuRef}
              t={t}
              onAdminNavigation={handleAdminNavigation}
              onCloseAccountMenu={() => setAccountMenuOpen(false)}
              onSignOut={handleSignOut}
              onToggleAccountMenu={() => setAccountMenuOpen((prev) => !prev)}
            />
          ) : authResolved ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ButtonLink
                href={signupHref}
                size="sm"
                className="h-9 px-2.5 text-[11px] shadow-card sm:h-10 sm:px-3 sm:text-sm"
              >
                <span className="sm:hidden">{createAccountMobile}</span>
                <span className="hidden sm:inline">{t('workspace.header.createAccount', 'Create account')}</span>
              </ButtonLink>
              <ButtonLink
                href={signinHref}
                variant="outline"
                size="sm"
                className="h-9 px-2.5 text-[11px] sm:h-10 sm:px-3 sm:text-sm"
              >
                <span className="sm:hidden">{signInMobile}</span>
                <span className="hidden sm:inline">{t('workspace.header.signIn', 'Sign in')}</span>
              </ButtonLink>
            </div>
          ) : (
            <div className="h-10 w-24 rounded-input bg-surface-2 shadow-sm sm:w-[180px]" aria-hidden />
          )}
        </div>
      </header>
      {mobileMenuOpen ? (
        <HeaderMobileMenu
          ctaLabel={ctaLabel}
          guestMobileNavItems={guestMobileNavItems}
          isAuthenticated={isAuthenticated}
          loginHref={signinHref}
          loginLabel={loginLabel}
          marketingLinks={marketingLinks}
          mobileDropdownOpen={mobileDropdownOpen}
          pathname={pathname}
          t={t}
          theme={theme}
          themeToggleLabel={themeToggleLabel}
          onClose={() => setMobileMenuOpen(false)}
          onToggleDropdown={(key) =>
            setMobileDropdownOpen((prev) => ({
              ...prev,
              [key]: !prev[key],
            }))
          }
          onToggleTheme={toggleTheme}
        />
      ) : null}
      <ReconsentPrompt enabled={authResolved && isAuthenticated} />
    </>
  );
}
