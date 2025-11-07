"use client";

import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/marketing/LanguageToggle';

export function MarketingFooter() {
  const { t } = useI18n();
  const defaultLinks: Array<{ label: string; href: string }> = [
    { label: 'Blog', href: '/blog' },
    { label: 'Terms', href: '/legal/terms' },
    { label: 'Privacy', href: '/legal/privacy' },
    { label: 'Acceptable Use', href: '/legal/acceptable-use' },
    { label: 'Notice & Takedown', href: '/legal/takedown' },
  ];
  const maybeLinks = t('footer.links', defaultLinks);
  const links = Array.isArray(maybeLinks) && maybeLinks.length ? maybeLinks : defaultLinks;
  const brandNote = t('footer.brandNote', 'Independent hub for professional AI video.');
  const crawlerNote =
    t(
      'footer.crawlerNote',
      'MaxVideoAI allows AI crawlers (GPTBot, OAI-SearchBot, Google-Extended, and CCBot) to index public model pages and documentation for educational and research visibility.'
    ) ??
    'MaxVideoAI allows AI crawlers (GPTBot, OAI-SearchBot, Google-Extended, and CCBot) to index public model pages and documentation for educational and research visibility.';
  const brandLabel = t('nav.brand', 'MaxVideo AI') ?? 'MaxVideo AI';
  return (
    <footer className="border-t border-hairline bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 text-sm text-text-muted md:flex-row md:items-center md:justify-between">
          <span className="inline-flex items-center gap-2 font-semibold text-text-primary">
            <Image src="/assets/branding/logo-wordmark.svg" alt={brandLabel} width={120} height={24} />
          </span>
          <div className="flex items-center gap-4">
            <nav className="flex flex-wrap gap-4" aria-label="Footer">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <LanguageToggle />
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <p className="max-w-3xl text-sm leading-relaxed text-text-muted">{brandNote}</p>
          <p className="max-w-3xl text-xs leading-relaxed text-text-muted">{crawlerNote}</p>
        </div>
      </div>
    </footer>
  );
}
