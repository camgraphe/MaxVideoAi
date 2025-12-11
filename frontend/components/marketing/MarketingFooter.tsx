'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/marketing/LanguageToggle';

export function MarketingFooter() {
  const { t } = useI18n();
  type FooterLink = { label: string; href: string; locale?: boolean };

  const dedupeLinks = (...lists: FooterLink[][]): FooterLink[] => {
    const seen = new Set<string>();
    const result: FooterLink[] = [];
    lists.forEach((list) => {
      list.forEach((item) => {
        if (!item || seen.has(item.href)) {
          return;
        }
        seen.add(item.href);
        result.push(item);
      });
    });
    return result;
  };
  const defaultLinks: FooterLink[] = [
    { label: 'Blog', href: '/blog', locale: true },
    { label: 'Terms', href: '/legal/terms', locale: false },
    { label: 'Privacy', href: '/legal/privacy', locale: false },
    { label: 'Acceptable Use', href: '/legal/acceptable-use', locale: false },
    { label: 'Notice & Takedown', href: '/legal/takedown', locale: false },
  ];
  const maybeLinks = t('footer.links', defaultLinks);
  const links = Array.isArray(maybeLinks) && maybeLinks.length ? maybeLinks : defaultLinks;
  const normalizedLinks = links.map((item) => {
    const shouldBypassLocale =
      item.locale === false || (item.locale === undefined && typeof item.href === 'string' && item.href.startsWith('/legal'));
    return shouldBypassLocale ? { ...item, locale: false } : item;
  });
  const isPolicyLink = (item: FooterLink) => typeof item.href === 'string' && item.href.startsWith('/legal');
  const policyLinks = normalizedLinks.filter(isPolicyLink);
  const headerLinks = normalizedLinks.filter((item) => !isPolicyLink(item));
  const discoveryLinks: FooterLink[] = [
    { label: 'Models', href: '/models', locale: true },
    { label: 'Examples', href: '/examples', locale: true },
    { label: 'Pricing', href: '/pricing', locale: true },
    { label: 'About', href: '/about', locale: true },
    { label: 'Contact', href: '/contact', locale: true },
    { label: 'Blog', href: '/blog', locale: true },
  ];
  const exploreLinks = headerLinks.length ? dedupeLinks(headerLinks, discoveryLinks) : discoveryLinks;
  const renderedPolicyLinks = policyLinks.length ? policyLinks : normalizedLinks;
  const brandNote = t('footer.brandNote', 'Independent hub for professional AI video.');
  const crawlerNote =
    t(
      'footer.crawlerNote',
      'MaxVideoAI allows AI crawlers (GPTBot, OAI-SearchBot, Google-Extended, and CCBot) to index public model pages and documentation for educational and research visibility.'
    ) ??
    'MaxVideoAI allows AI crawlers (GPTBot, OAI-SearchBot, Google-Extended, and CCBot) to index public model pages and documentation for educational and research visibility.';
  const brandLabel = t('nav.brand', 'MaxVideo AI') ?? 'MaxVideo AI';
  const languageLabel = t('footer.languageLabel', 'Language') ?? 'Language';
  return (
    <footer className="border-t border-hairline bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 text-sm text-text-muted md:flex-row md:items-center md:justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-3 font-display text-lg font-semibold tracking-tight text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Image
              src="/assets/branding/logo-mark.svg"
              alt="MaxVideoAI"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span>{brandLabel}</span>
          </Link>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-[11px] font-semibold uppercase tracking-micro text-text-muted shadow-sm">
              <span>{languageLabel}</span>
              <LanguageToggle />
            </div>
          </div>
        </div>
        <div className="grid gap-4 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Explore MaxVideoAI</p>
            <nav className="mt-3 flex flex-wrap gap-3" aria-label="Key pages">
              {exploreLinks.map((item) => {
                const linkLocale = item.locale === true ? undefined : false;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    locale={linkLocale}
                    className="text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Policies</p>
            <nav className="mt-3 flex flex-wrap gap-3" aria-label="Policies">
              {renderedPolicyLinks.map((item) => (
                <Link
                  key={`policy-${item.href}`}
                  href={item.href}
                  locale={item.locale === true ? undefined : false}
                  className="text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
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
