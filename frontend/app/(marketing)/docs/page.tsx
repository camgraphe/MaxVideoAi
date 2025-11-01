import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentEntries } from '@/lib/content/markdown';
import { resolveDictionary } from '@/lib/i18n/server';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';

export async function generateMetadata(): Promise<Metadata> {
  const url = `${SITE}/docs`;
  const title = 'Docs — Onboarding, Brand Safety, Refunds & API Webhooks';
  const description =
    'Start here for onboarding, price system and refunds. Learn about brand-safe filters and see webhook/API references. Deeper guides live in the authenticated workspace.';
  const ogImage = `${SITE}/og/price-before.png`;

  return {
    title: `${title} — MaxVideo AI`,
    description,
    alternates: {
      canonical: url,
      languages: {
        en: url,
        fr: `${url}?lang=fr`,
      },
    },
    openGraph: {
      type: 'website',
      url,
      siteName: 'MaxVideo AI',
      title: `${title} — MaxVideo AI`,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: 'Docs — MaxVideo AI',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — MaxVideo AI`,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function DocsIndexPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.docs;
  const sections = content.sections;
  const docs = await getContentEntries('content/docs');

  const tocLinks = [
    { href: '#onboarding', label: 'Onboarding' },
    { href: '#pricing', label: 'Price system' },
    { href: '#refunds', label: 'Refunds' },
    { href: '#safety', label: 'Brand safety' },
    { href: '#api', label: 'API references' },
    { href: '#library', label: 'Library' },
  ];

  const sectionIdMap: Record<string, string> = {
    'Onboarding & accounts': 'onboarding',
    'Pricing system': 'pricing',
    'Refunds & billing': 'refunds',
    'Brand safety': 'safety',
    'API references': 'api',
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>

      <nav aria-label="On-page navigation" className="mt-4">
        <div className="rounded-xl border border-hairline bg-white p-3 text-sm text-text-secondary sm:hidden">
          <div className="flex flex-wrap gap-2">
            {tocLinks.map((link) => (
              <a key={link.href} href={link.href} className="underline underline-offset-2">
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="hidden sm:grid grid-cols-[220px_1fr] gap-6">
          <aside className="sticky top-24 h-max self-start rounded-xl border border-hairline bg-white p-4 text-sm text-text-secondary">
            <div className="mb-2 text-sm font-semibold text-text-primary">On this page</div>
            <ul className="space-y-1">
              {tocLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="hover:underline">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
          <div>
            <section className="grid gap-6 lg:grid-cols-2">
              {sections.map((section) => {
                const sectionId = sectionIdMap[section.title] ?? undefined;
                return (
                  <article
                    key={section.title}
                    id={sectionId}
                    className="rounded-card border border-hairline bg-white p-6 shadow-card"
                  >
                    <h2 className="text-lg font-semibold text-text-primary">{section.title}</h2>
                    {sectionId === 'api' ? (
                      <p className="mt-1 text-xs text-text-muted">
                        {FEATURES.docs.apiPublicRefs ? 'Public summary available below.' : 'Full API docs require authentication inside the workspace.'}
                      </p>
                    ) : null}
                    <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                      {section.items.map((item, index) => {
                        if (typeof item === 'string') {
                          return (
                            <li key={index} className="flex items-start gap-2">
                              <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                              <span>{item}</span>
                            </li>
                          );
                        }
                        if (typeof item === 'object' && item?.type === 'link') {
                          return (
                            <li key={index} className="flex items-start gap-2">
                              <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                              <span>
                                {item.before}
                                <Link href="/legal/terms" className="text-accent hover:text-accentSoft">
                                  {item.terms}
                                </Link>
                                {item.and}
                                <Link href="/legal/privacy" className="text-accent hover:text-accentSoft">
                                  {item.privacy}
                                </Link>
                                {item.after}
                              </span>
                            </li>
                          );
                        }
                        return null;
                      })}
                    </ul>
                  </article>
                );
              })}
            </section>

            <section id="library" className="mt-12">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
                {content.libraryHeading ?? 'Library'}
                <FlagPill live={FEATURES.docs.libraryDocs} />
                <span className="sr-only">{FEATURES.docs.libraryDocs ? 'Live' : 'Coming soon'}</span>
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                {FEATURES.docs.libraryDocs
                  ? 'Browse reusable assets, presets, and reference prompts for your team.'
                  : 'Documentation coming soon.'}
              </p>
              {FEATURES.docs.libraryDocs && docs.length > 0 ? (
                <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                  {docs.map((doc) => (
                    <li key={doc.slug}>
                      <Link href={`/docs/${doc.slug}`} className="font-semibold text-accent hover:text-accentSoft">
                        {doc.title}
                      </Link>
                      <p className="text-xs text-text-muted">{doc.description}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        </div>
      </nav>
      <p className="mt-8 text-xs text-text-muted">Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Docs — Onboarding, Brand Safety, Refunds & API Webhooks',
            url: `${SITE}/docs`,
            hasPart: [
              { '@type': 'WebPage', name: 'Onboarding', url: `${SITE}/docs#onboarding` },
              { '@type': 'WebPage', name: 'Price system', url: `${SITE}/docs#pricing` },
              { '@type': 'WebPage', name: 'Refunds', url: `${SITE}/docs#refunds` },
              { '@type': 'WebPage', name: 'Brand safety', url: `${SITE}/docs#safety` },
              { '@type': 'WebPage', name: 'API references', url: `${SITE}/docs#api` },
              { '@type': 'WebPage', name: 'Library', url: `${SITE}/docs#library` },
            ],
            about: ['onboarding', 'refund policy', 'brand safety', 'webhooks', 'api references'],
            publisher: {
              '@type': 'Organization',
              name: 'MaxVideo AI',
              url: SITE,
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
              { '@type': 'ListItem', position: 2, name: 'Docs', item: `${SITE}/docs` },
            ],
          }),
        }}
      />
    </div>
  );
}
