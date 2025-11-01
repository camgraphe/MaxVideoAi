
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/I18nProvider';

export function MarketingNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const brand = t('nav.brand', 'MaxVideo AI') ?? 'MaxVideo AI';
  const links = t('nav.links', []) as Array<{ key: string; href: string }>;
  const login = t('nav.login', 'Log in');
  const cta = t('nav.cta', 'Start a render');

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          aria-label={brand}
        >
          <Image src="/assets/branding/logo-mark.svg" alt={brand} width={28} height={28} />
          <span>{brand}</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm font-medium text-text-secondary md:flex">
          {links.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href + '/'));
            return (
              <Link
                key={item.key}
                href={item.href}
                className={clsx(
                  'transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  isActive ? 'text-text-primary' : undefined
                )}
              >
                {t(`nav.linkLabels.${item.key}`, item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login?next=/app"
            className="hidden text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white md:inline-flex"
          >
            {login}
          </Link>
          <Link
            href="/app"
            className="inline-flex items-center rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition transform-gpu hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {cta}
          </Link>
        </div>
      </div>
    </header>
  );
}
