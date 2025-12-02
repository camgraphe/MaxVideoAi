import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getContentEntries } from '@/lib/content/markdown';
import { resolveDictionary } from '@/lib/i18n/server';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';
import { Callout } from '@/components/Callout';
import DocsTocActive from './components/DocsTocActive';

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
  const { dictionary } = await resolveDictionary();
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
    Brief: 'onboarding',
    'Price system': 'pricing',
    Refunds: 'refunds',
    'Brand-safe filters': 'safety',
    'API references': 'api',
  };

  const seeAlsoLinks: Record<string, Array<{ href: string; label: string }>> = {
    onboarding: [
      { href: '/workflows#express-vs-workflows', label: 'Workflows overview' },
      { href: '/examples', label: 'Examples gallery' },
    ],
    pricing: [
      { href: '/pricing#estimator', label: 'Pricing estimator' },
      { href: '/pricing#example-costs', label: 'Example costs' },
    ],
    refunds: [
      { href: '/pricing#refunds-protections', label: 'Refunds & protections' },
      { href: '/legal/terms', label: 'Terms' },
    ],
    safety: [
      { href: '/workflows#express-vs-workflows', label: 'Workflows overview' },
      { href: '/models', label: 'Models roster' },
    ],
    api: [
      { href: '/pricing#estimator', label: 'Estimator inputs' },
      { href: '/examples', label: 'Example payloads' },
    ],
    library: [
      { href: '/workflows', label: 'Workflows' },
      { href: '/models', label: 'Models' },
    ],
  };

  return (
    <main id="top" className="scroll-smooth">
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
          <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
        </header>

        <nav aria-label="On-page navigation" className="mt-4">
        <div className="rounded-xl border border-hairline bg-white p-3 text-sm text-text-secondary sm:hidden">
          <div className="flex flex-wrap gap-2 text-muted-foreground">
            {tocLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="underline underline-offset-2 text-muted-foreground transition-colors hover:text-text-primary"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-4 sm:grid sm:grid-cols-[220px_1fr] sm:gap-6">
          <aside className="hidden sm:block sm:sticky sm:top-24 sm:h-max sm:self-start sm:rounded-xl sm:border sm:border-hairline sm:bg-white sm:p-4 sm:text-sm sm:text-text-secondary">
            <div className="mb-2 text-sm font-semibold text-text-primary">On this page</div>
            <ul className="space-y-1">
              {tocLinks.map((link) => (
                <li key={link.href}>
                  <a
                      href={link.href}
                      className="text-muted-foreground transition-colors hover:underline hover:text-text-primary"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
            <div>
              <DocsTocActive />
              <section className="grid gap-6 lg:grid-cols-2">
                {sections.map((section) => {
                  const sectionId = sectionIdMap[section.title] ?? undefined;
                  return (
                    <article
                      key={section.title}
                      id={sectionId}
                      className="scroll-mt-28 rounded-card border border-hairline bg-white p-6 shadow-card"
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
                      {sectionId === 'onboarding' ? (
                        <section aria-labelledby="onboarding-checklist" className="mt-4">
                          <h3 id="onboarding-checklist" className="text-base font-semibold text-text-primary">
                            Onboarding checklist
                          </h3>
                          <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
                            <li>✅ Fill the brand brief (tone, goals, deliverables).</li>
                            <li>✅ Add 1–3 example prompts and reference assets.</li>
                            <li>✅ Set default aspect ratios and audio preference.</li>
                          </ul>
                          <p className="mt-2 text-xs text-text-muted">
                            You can edit the brief anytime; updates apply to everyone in the workspace.
                          </p>
                        </section>
                      ) : null}
                      {sectionId === 'pricing' ? (
                        <Callout tone="success">✅ You always see the price before you render.</Callout>
                      ) : null}
                      {sectionId === 'refunds' ? (
                        <section aria-labelledby="refunds-timeline" className="mt-4">
                          <h3 id="refunds-timeline" className="text-base font-semibold text-text-primary">
                            Refunds timeline
                          </h3>
                          <ol className="mt-2 space-y-1.5 text-sm text-text-secondary">
                            <li>1) Job fails → the system flags the incident.</li>
                            <li>2) Auto-refund → wallet credited within minutes.</li>
                            <li>3) Receipt → itemised record with a short incident note.</li>
                          </ol>
                          <p className="mt-2 text-xs text-text-muted">
                            You only pay for successful jobs. Refunds appear in the job feed and receipts.
                          </p>
                        </section>
                      ) : null}
                      {sectionId === 'refunds' ? (
                        <Callout tone="success">
                          ✅ Failed jobs are auto-refunded within minutes; receipts include a short incident note.
                        </Callout>
                      ) : null}
                      {sectionId === 'safety' ? (
                        <section aria-labelledby="safety-quick" className="mt-4">
                          <h3 id="safety-quick" className="text-base font-semibold text-text-primary">
                            Quick overview
                          </h3>
                          <ul className="mt-2 space-y-1.5 text-sm text-text-muted">
                            <li>• Default blocks: illegal content, explicit sexual content, hate/harassment, doxxing.</li>
                            <li>• Media checks: risky uploads/outputs are quarantined for review.</li>
                            <li>• Admin controls: request allowlists or restricted keywords per workspace.</li>
                          </ul>
                          <p className="mt-2 text-xs text-text-muted">
                            Sensitive cases route to human review with an audit trail and simple escalation options.
                          </p>
                        </section>
                      ) : null}
                      {sectionId === 'safety' ? (
                        <Callout tone="warn">⚠️ Sensitive use-cases may require an admin allowlist or human review.</Callout>
                      ) : null}
                      {sectionId && seeAlsoLinks[sectionId]?.length ? (
                        <p className="mt-3 text-sm">
                          <span className="text-muted-foreground">See also:</span>{' '}
                          {seeAlsoLinks[sectionId].map((link, linkIndex) => (
                            <span key={link.href}>
                              <a className="underline underline-offset-2" href={link.href}>
                                {link.label}
                              </a>
                              {linkIndex < seeAlsoLinks[sectionId].length - 1 ? ', ' : null}
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </section>

              <section id="library" className="mt-12 scroll-mt-28">
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
                        <Link href={{ pathname: '/docs/[slug]', params: { slug: doc.slug } }} className="font-semibold text-accent hover:text-accentSoft">
                          {doc.title}
                        </Link>
                        <p className="text-xs text-text-muted">{doc.description}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {seeAlsoLinks.library?.length ? (
                  <p className="mt-3 text-sm">
                    <span className="text-muted-foreground">See also:</span>{' '}
                    {seeAlsoLinks.library.map((link, linkIndex) => (
                      <span key={link.href}>
                        <a className="underline underline-offset-2" href={link.href}>
                          {link.label}
                        </a>
                        {linkIndex < seeAlsoLinks.library.length - 1 ? ', ' : null}
                      </span>
                    ))}
                  </p>
                ) : null}
              </section>
            </div>
          </div>
        </nav>
        <section aria-labelledby="docs-feedback" className="mt-10">
          <h3 id="docs-feedback" className="sr-only">
            Feedback
          </h3>
          <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-muted">Was this page helpful?</p>
            <div className="flex items-center gap-2">
              <Link href="/contact" className="rounded-md border border-hairline px-3 py-1.5 text-sm hover:shadow-sm">
                Yes
              </Link>
              <Link href="/contact" className="rounded-md border border-hairline px-3 py-1.5 text-sm hover:shadow-sm">
                No
              </Link>
              <a href="#top" className="ml-2 text-sm underline underline-offset-2">
                Back to top
              </a>
            </div>
          </div>
        </section>
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
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'Do Starter Credits expire?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'No. Credits roll forward month to month and sync across teammates with access.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How fast are failed renders refunded?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Refunds are processed automatically within minutes; each job includes a short incident note for finance.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Can we override brand-safety for specific projects?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes. Admins can request custom allowlists or restricted keywords per workspace; sensitive cases route to human review with an audit trail.',
                  },
                },
              ],
            }),
          }}
        />
      </div>
    </main>
  );
}
