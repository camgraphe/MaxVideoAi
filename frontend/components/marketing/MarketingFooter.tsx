'use client';

import Image from 'next/image';
import { Link, usePathname, type LocalizedLinkHref } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { MarketingFooterAssistants } from '@/components/marketing/MarketingFooterAssistants';
import { LanguageToggle } from '@/components/marketing/LanguageToggle';
import { MARKETING_NAV_BEST_FOR_HUB } from '@/config/navigation';
import { FOOTER_MODELS, FOOTER_COMPARISONS, FOOTER_EXAMPLES } from '@/config/marketing-footer';

type FooterLink = { key: string; label: string; href: LocalizedLinkHref };
type PolicyLink = { label: string; href: string; locale?: boolean };
type SupportedLocale = 'en' | 'fr' | 'es';

const OPEN_COOKIE_PREFERENCES_EVENT = 'consent:open-preferences';

function localizeFooterPath(locale: SupportedLocale, englishPath: string) {
  if (locale === 'en' || englishPath === '/') {
    return locale === 'en' ? englishPath : `/${locale}`;
  }
  return `/${locale}${englishPath}`;
}

export function MarketingFooter() {
  const pathname = usePathname();
  const isCompanyTrustHub = /^\/(?:fr\/|es\/)?company\/?$/.test(pathname ?? '');
  const { locale, t } = useI18n();
  if (isCompanyTrustHub) {
    return null;
  }

  const labelFor = (key: string, fallback: string) => t(key, fallback) ?? fallback;
  const openCookiePreferences = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT));
  };

  const defaultPolicyLinks: PolicyLink[] = [
    { label: 'Legal Center', href: '/legal', locale: false },
    { label: 'Refund & Return Policy', href: '/return-policy', locale: false },
  ];
  const maybeLinks = t('footer.links', defaultPolicyLinks);
  const links = Array.isArray(maybeLinks) && maybeLinks.length ? maybeLinks : defaultPolicyLinks;
  const isPolicyLink = (item: PolicyLink) =>
    typeof item.href === 'string' && (item.href.startsWith('/legal') || item.href === '/return-policy');
  const policyLinks = links.filter(isPolicyLink);
  const renderedPolicyLinks = policyLinks.length ? policyLinks : defaultPolicyLinks.filter(isPolicyLink);
  const localizedPolicyLinks = renderedPolicyLinks.map((item) => ({
    ...item,
    href: item.href.startsWith('/legal') ? localizeFooterPath(locale, item.href) : item.href,
  }));

  const engineLinks: FooterLink[] = [...FOOTER_MODELS.map((item) => ({
    key: item.key,
    label: labelFor(`nav.dropdown.models.items.${item.key}`, item.label),
    href: item.href,
  })), { key: 'all-models', label: labelFor('nav.dropdown.allModels', 'All models'), href: '/models' }];

  const comparisonLinks: FooterLink[] = [
    ...FOOTER_COMPARISONS.map(item => ({ ...item, label: labelFor(`nav.dropdown.compare.items.${item.key}`, item.label) })),
    { key: 'all-comparisons', label: labelFor('nav.dropdown.allComparisons', 'All comparisons'), href: '/ai-video-engines' },
  ];

  const useCaseLinks: FooterLink[] = [
    {
      key: MARKETING_NAV_BEST_FOR_HUB.key,
      label: labelFor('footer.sections.useCases.items.bestFor', MARKETING_NAV_BEST_FOR_HUB.label),
      href: MARKETING_NAV_BEST_FOR_HUB.href,
    },
  ];

  const exampleLinks: FooterLink[] = [
    ...FOOTER_EXAMPLES.map((item) => ({
      key: item.key,
      label: labelFor(`footer.sections.examples.items.${item.key}`, `${item.label} examples`),
      href: item.href,
    })),
    {
      key: 'all',
      label: labelFor('footer.sections.examples.items.all', 'All examples'),
      href: { pathname: '/examples' },
    },
  ];

  const productLinks: FooterLink[] = [
    {
      key: 'angle',
      label: labelFor('footer.sections.product.items.angle', 'Change Camera Angle'),
      href: { pathname: '/tools/angle' },
    },
    {
      key: 'characterBuilder',
      label: labelFor('footer.sections.product.items.characterBuilder', 'Character Builder'),
      href: { pathname: '/tools/character-builder' },
    },
    { key: 'pricing', label: labelFor('footer.sections.product.items.pricing', 'Pricing'), href: { pathname: '/pricing' } },
    {
      key: 'paygVideo',
      label: labelFor('footer.sections.product.items.paygVideo', 'Pay-as-you-go AI video'),
      href: { pathname: '/pay-as-you-go-ai-video-generator' },
    },
    { key: 'all-tools', label: labelFor('nav.dropdown.allTools', 'All tools'), href: '/tools' },
  ];

  const companyLinks: FooterLink[] = [
    { key: 'getting-started', label: labelFor('nav.dropdown.tools.sections.resources.items.get-started', 'Getting started'), href: { pathname: '/docs/[slug]', params: { slug: 'get-started' } } },
    { key: 'contact', label: labelFor('footer.sections.company.items.contact', 'Contact'), href: '/contact' },
    { key: 'blog', label: labelFor('footer.sections.company.items.blog', 'Blog'), href: { pathname: '/blog' } },
    {
      key: 'companyHub',
      label: labelFor('footer.sections.company.items.companyHub', 'Company & Trust'),
      href: { pathname: '/company' },
    },
    { key: 'status', label: labelFor('footer.sections.company.items.status', 'Status'), href: { pathname: '/status' } },
  ];

  const brandLabel = t('nav.brand', 'MaxVideo AI') ?? 'MaxVideo AI';
  const enginesTitle = labelFor('footer.sections.engines.title', 'AI Video Engines');
  const comparisonsTitle = labelFor('footer.sections.comparisons.title', 'Popular comparisons');
  const useCasesTitle = labelFor('footer.sections.useCases.title', 'Use cases');
  const examplesTitle = labelFor('footer.sections.examples.title', 'Real examples');
  const productTitle = labelFor('footer.sections.product.title', 'Product');
  const companyTitle = labelFor('footer.sections.company.title', 'Resources');
  const policiesTitle = labelFor('footer.sections.policies.title', 'Policies');
  const manageCookiesLabel = labelFor('footer.sections.policies.manageCookies', 'Cookie settings');
  const sectionTitleClass = 'text-xs font-semibold uppercase tracking-micro text-text-primary';
  const linkClass =
    'text-sm text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

  return (
    <footer className="marketing-editorial-footer border-t border-hairline bg-surface">
      <div className="container-page flex flex-col gap-8 py-10">
        <div className="flex items-center justify-between gap-4 text-sm text-text-muted">
          <Link
            href="/"
            prefetch={false}
            className="inline-flex items-center gap-4 font-display text-lg font-semibold tracking-tight text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Image src="/assets/branding/logo-mark.svg" alt="" aria-hidden="true" width={32} height={32} className="h-8 w-8" />
            <span>{brandLabel}</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-1">
              <LanguageToggle variant="icon" />
            </div>
          </div>
        </div>

        <MarketingFooterAssistants copy={{
          title: labelFor('footer.mcpFeature.title', 'Create with your AI assistant.'),
          body: labelFor('footer.mcpFeature.body', 'Your models and credits, from your conversation.'),
          cta: labelFor('footer.mcpFeature.cta', 'Discover MaxVideoAI MCP'),
          docs: labelFor('footer.mcpFeature.docs', 'MCP documentation'),
          anchors: Object.fromEntries(['claude', 'chatgpt', 'codex', 'openclaw', 'n8n'].map(id => [id, labelFor(`footer.mcpFeature.anchors.${id}`, id)])),
        }} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 text-text-secondary sm:gap-x-6 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-5 lg:gap-x-8">
          <div>
            <p className={sectionTitleClass}>{enginesTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={enginesTitle}>
              {engineLinks.map((item) => (
                <Link key={item.key} href={item.href} prefetch={false} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <p className={sectionTitleClass}>{comparisonsTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={comparisonsTitle}>
              {comparisonLinks.map((item) => (
                <Link key={item.key} href={item.href} prefetch={false} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <p className={`${sectionTitleClass} mt-6`}>{useCasesTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={useCasesTitle}>
              {useCaseLinks.map(item => <Link key={item.key} href={item.href} prefetch={false} className={linkClass}>{item.label}</Link>)}
            </nav>
          </div>
          <div>
            <p className={sectionTitleClass}>{examplesTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={examplesTitle}>
              {exampleLinks.map((item) => (
                <Link key={item.key} href={item.href} prefetch={false} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <p className={sectionTitleClass}>{productTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={productTitle}>
              {productLinks.map((item) => (
                <Link key={item.key} href={item.href} prefetch={false} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <p className={sectionTitleClass}>{companyTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={companyTitle}>
              {companyLinks.map((item) => (
                <Link key={item.key} href={item.href} prefetch={false} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="border-t border-hairline pt-6">
          <p className={sectionTitleClass}>{policiesTitle}</p>
          <nav className="mt-3 flex flex-wrap gap-4" aria-label={policiesTitle}>
            {localizedPolicyLinks.map((item) => (
              <Link
                key={`policy-${item.href}`}
                href={item.href}
                prefetch={false}
                locale={item.locale === true ? undefined : false}
                className={linkClass}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={openCookiePreferences}
              className={linkClass}
            >
              {manageCookiesLabel}
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
