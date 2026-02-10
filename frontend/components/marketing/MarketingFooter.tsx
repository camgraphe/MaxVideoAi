'use client';

import Image from 'next/image';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/marketing/LanguageToggle';
import engineCatalog from '@/config/engine-catalog.json';
import { MARKETING_EXAMPLE_SLUGS } from '@/config/navigation';

type FooterLink = { key: string; label: string; href: LocalizedLinkHref };
type PolicyLink = { label: string; href: string; locale?: boolean };

const canonicalCompareSlug = (left: string, right: string) => [left, right].sort().join('-vs-');

export function MarketingFooter() {
  const { t } = useI18n();
  const labelFor = (key: string, fallback: string) => t(key, fallback) ?? fallback;

  const modelSlugSet = new Set(engineCatalog.map((entry) => entry.modelSlug));
  const exampleSlugSet = new Set(MARKETING_EXAMPLE_SLUGS);

  const defaultPolicyLinks: PolicyLink[] = [
    { label: 'Blog', href: '/blog', locale: true },
    { label: 'Terms', href: '/legal/terms', locale: false },
    { label: 'Privacy', href: '/legal/privacy', locale: false },
    { label: 'Acceptable Use', href: '/legal/acceptable-use', locale: false },
    { label: 'Notice & Takedown', href: '/legal/takedown', locale: false },
  ];
  const maybeLinks = t('footer.links', defaultPolicyLinks);
  const links = Array.isArray(maybeLinks) && maybeLinks.length ? maybeLinks : defaultPolicyLinks;
  const isPolicyLink = (item: PolicyLink) => typeof item.href === 'string' && item.href.startsWith('/legal');
  const policyLinks = links.filter(isPolicyLink);
  const renderedPolicyLinks = policyLinks.length ? policyLinks : defaultPolicyLinks.filter(isPolicyLink);

  const engineItems = [
    { slug: 'sora-2', labelKey: 'footer.sections.engines.items.sora2', fallback: 'Sora 2' },
    { slug: 'kling-3-pro', labelKey: 'footer.sections.engines.items.kling3pro', fallback: 'Kling 3 Pro' },
    { slug: 'wan-2-6', labelKey: 'footer.sections.engines.items.wan2_6', fallback: 'Wan 2.6' },
    { slug: 'veo-3-1', labelKey: 'footer.sections.engines.items.veo3_1', fallback: 'Veo 3.1' },
    { slug: 'ltx-2', labelKey: 'footer.sections.engines.items.ltx2', fallback: 'LTX-2' },
    { slug: 'seedance-1-5-pro', labelKey: 'footer.sections.engines.items.seedance1_5pro', fallback: 'Seedance 1.5 Pro' },
  ];
  const engineLinks: FooterLink[] = engineItems
    .filter((item) => modelSlugSet.has(item.slug))
    .map((item) => ({
      key: item.slug,
      label: labelFor(item.labelKey, item.fallback),
      href: { pathname: '/models/[slug]', params: { slug: item.slug } },
    }));

  const comparisonItems = [
    {
      left: 'kling-3-pro',
      right: 'sora-2',
      labelKey: 'footer.sections.comparisons.items.kling3pro_vs_sora2',
      fallback: 'Kling 3 Pro vs Sora 2',
    },
    {
      left: 'sora-2',
      right: 'veo-3-1',
      labelKey: 'footer.sections.comparisons.items.sora2_vs_veo3_1',
      fallback: 'Sora 2 vs Veo 3.1',
    },
    {
      left: 'kling-3-pro',
      right: 'wan-2-6',
      labelKey: 'footer.sections.comparisons.items.kling3pro_vs_wan2_6',
      fallback: 'Kling 3 Pro vs Wan 2.6',
    },
    {
      left: 'ltx-2',
      right: 'veo-3-1',
      labelKey: 'footer.sections.comparisons.items.ltx2_vs_veo3_1',
      fallback: 'LTX-2 vs Veo 3.1',
    },
    {
      left: 'sora-2',
      right: 'wan-2-6',
      labelKey: 'footer.sections.comparisons.items.sora2_vs_wan2_6',
      fallback: 'Sora 2 vs Wan 2.6',
    },
    {
      left: 'seedance-1-5-pro',
      right: 'sora-2',
      labelKey: 'footer.sections.comparisons.items.seedance1_5pro_vs_sora2',
      fallback: 'Seedance 1.5 Pro vs Sora 2',
    },
  ];
  const comparisonLinks: FooterLink[] = comparisonItems
    .filter((item) => modelSlugSet.has(item.left) && modelSlugSet.has(item.right))
    .map((item) => ({
      key: `${item.left}-vs-${item.right}`,
      label: labelFor(item.labelKey, item.fallback),
      href: { pathname: '/ai-video-engines/[slug]', params: { slug: canonicalCompareSlug(item.left, item.right) } },
    }));

  const exampleItems = [
    { slug: 'sora-2', labelKey: 'footer.sections.examples.items.sora2', fallback: 'Sora 2 examples' },
    { slug: 'kling', labelKey: 'footer.sections.examples.items.kling', fallback: 'Kling examples' },
    { slug: 'veo-3-1', labelKey: 'footer.sections.examples.items.veo3_1', fallback: 'Veo 3.1 examples' },
    { slug: null, labelKey: 'footer.sections.examples.items.all', fallback: 'All examples' },
  ];
  const exampleLinks: FooterLink[] = exampleItems
    .filter((item) => !item.slug || exampleSlugSet.has(item.slug))
    .map((item) => ({
      key: item.slug ?? 'all',
      label: labelFor(item.labelKey, item.fallback),
      href: item.slug ? { pathname: '/examples/[model]', params: { model: item.slug } } : { pathname: '/examples' },
    }));

  const productLinks: FooterLink[] = [
    { key: 'generate', label: labelFor('footer.sections.product.items.generate', 'Generate'), href: '/app' },
    { key: 'pricing', label: labelFor('footer.sections.product.items.pricing', 'Pricing'), href: { pathname: '/pricing' } },
    { key: 'workflows', label: labelFor('footer.sections.product.items.workflows', 'Workflows'), href: { pathname: '/workflows' } },
    { key: 'docs', label: labelFor('footer.sections.product.items.docs', 'Docs'), href: { pathname: '/docs' } },
    { key: 'models', label: labelFor('footer.sections.product.items.models', 'All models'), href: { pathname: '/models' } },
  ];

  const companyLinks: FooterLink[] = [
    { key: 'blog', label: labelFor('footer.sections.company.items.blog', 'Blog'), href: { pathname: '/blog' } },
    { key: 'about', label: labelFor('footer.sections.company.items.about', 'About'), href: { pathname: '/about' } },
    { key: 'contact', label: labelFor('footer.sections.company.items.contact', 'Contact'), href: { pathname: '/contact' } },
    { key: 'status', label: labelFor('footer.sections.company.items.status', 'Status'), href: { pathname: '/status' } },
  ];

  const brandLabel = t('nav.brand', 'MaxVideo AI') ?? 'MaxVideo AI';
  const enginesTitle = labelFor('footer.sections.engines.title', 'AI Video Engines');
  const comparisonsTitle = labelFor('footer.sections.comparisons.title', 'Popular comparisons');
  const examplesTitle = labelFor('footer.sections.examples.title', 'Real examples');
  const productTitle = labelFor('footer.sections.product.title', 'Product');
  const companyTitle = labelFor('footer.sections.company.title', 'Company');
  const policiesTitle = labelFor('footer.sections.policies.title', 'Policies');
  const sectionTitleClass = 'text-xs font-semibold uppercase tracking-micro text-text-muted';
  const linkClass =
    'text-sm text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 text-sm text-text-muted md:flex-row md:items-center md:justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-4 font-display text-lg font-semibold tracking-tight text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Image src="/assets/branding/logo-mark.svg" alt="MaxVideoAI" width={32} height={32} className="h-8 w-8" />
            <span>{brandLabel}</span>
          </Link>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <div className="flex items-center gap-1">
              <LanguageToggle variant="icon" />
            </div>
          </div>
        </div>

        <div className="grid gap-8 text-text-secondary sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className={sectionTitleClass}>{enginesTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={enginesTitle}>
              {engineLinks.map((item) => (
                <Link key={item.key} href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <p className={sectionTitleClass}>{comparisonsTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={comparisonsTitle}>
              {comparisonLinks.map((item) => (
                <Link key={item.key} href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <p className={sectionTitleClass}>{examplesTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={examplesTitle}>
              {exampleLinks.map((item) => (
                <Link key={item.key} href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <p className={sectionTitleClass}>{productTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={productTitle}>
              {productLinks.map((item) => (
                <Link key={item.key} href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <p className={sectionTitleClass}>{companyTitle}</p>
            <nav className="mt-3 flex flex-col gap-2" aria-label={companyTitle}>
              {companyLinks.map((item) => (
                <Link key={item.key} href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="border-t border-hairline pt-6">
          <p className={sectionTitleClass}>{policiesTitle}</p>
          <nav className="mt-3 flex flex-wrap gap-4" aria-label={policiesTitle}>
            {renderedPolicyLinks.map((item) => (
              <Link
                key={`policy-${item.href}`}
                href={item.href}
                locale={item.locale === true ? undefined : false}
                className={linkClass}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
