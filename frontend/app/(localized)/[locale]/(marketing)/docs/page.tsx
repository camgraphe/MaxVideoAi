import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getContentEntries } from '@/lib/content/markdown';
import { resolveDictionary } from '@/lib/i18n/server';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';
import { Callout } from '@/components/Callout';
import DocsTocActive from './components/DocsTocActive';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';
const DOCS_SLUG_MAP = buildSlugMap('docs');

export const revalidate = 60 * 10;

async function getDocsEntries(locale: AppLocale) {
  const localized = await getContentEntries(`content/${locale}/docs`);
  if (localized.length > 0) {
    return localized;
  }
  return getContentEntries('content/docs');
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const metaCopy = dictionary.docs?.meta ?? {};
  const title = metaCopy.title ?? 'Docs — Onboarding, Brand Safety, Refunds & API Webhooks';
  const description =
    metaCopy.description ??
    'Start here for onboarding, price system and refunds. Learn about brand-safe filters and see webhook/API references. Deeper guides live in the authenticated workspace.';
  const ogImage = `${SITE}/og/price-before.png`;

  return buildSeoMetadata({
    locale,
    title: `${title} — MaxVideoAI`,
    description,
    hreflangGroup: 'docs',
    slugMap: DOCS_SLUG_MAP,
    image: ogImage,
    imageAlt: 'Docs — MaxVideoAI',
    robots: {
      index: true,
      follow: true,
    },
  });
}

export default async function DocsIndexPage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.docs;
  const sections = content.sections;
  const metadataUrls = buildMetadataUrls(locale, DOCS_SLUG_MAP, { englishPath: '/docs' });
  const docs = await getDocsEntries(locale);
  const toc = content.toc ?? {};
  const sectionOrder = ['onboarding', 'pricing', 'refunds', 'safety', 'api'] as const;
  const tocLinks = [
    { id: 'onboarding', label: toc.onboarding ?? sections?.[0]?.title ?? 'Onboarding' },
    { id: 'pricing', label: toc.pricing ?? sections?.[1]?.title ?? 'Price system' },
    { id: 'refunds', label: toc.refunds ?? sections?.[2]?.title ?? 'Refunds' },
    { id: 'safety', label: toc.safety ?? sections?.[3]?.title ?? 'Brand safety' },
    { id: 'api', label: toc.api ?? sections?.[4]?.title ?? 'API references' },
    { id: 'library', label: toc.library ?? content.libraryHeading ?? 'Library' },
  ];
  const seeAlsoLinks = (content.seeAlso ?? {}) as Record<string, Array<{ href: string; label: string }>>;
  const onboardingChecklist = content.onboardingChecklist ?? {};
  const refundsTimeline = content.refundsTimeline ?? {};
  const safetyQuick = content.safetyQuick ?? {};
  const apiNotice = content.apiNotice ?? {};
  const libraryCopy = content.library ?? {};
  const feedbackCopy = content.feedback ?? {};
  const jsonLdCopy = content.jsonLd ?? {};
  const lastUpdatedLabel = content.lastUpdatedLabel ?? 'Last updated:';
  const apiNoticeLabel = FEATURES.docs.apiPublicRefs ? apiNotice.public : apiNotice.private;

  return (
    <main id="top" className="scroll-smooth">
      <div className="container-page max-w-5xl section">
        <div className="stack-gap-lg">
          <header className="stack-gap-sm">
            <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
            <p className="sm:max-w-[62ch] text-base leading-relaxed text-text-secondary">{content.hero.subtitle}</p>
          </header>

          <nav aria-label="On-page navigation">
            <div className="rounded-xl border border-hairline bg-surface p-3 text-sm text-text-secondary sm:hidden">
              <div className="flex flex-wrap gap-2 text-muted-foreground">
                {tocLinks.map((link) => (
                  <a
                    key={link.id}
                    href={`#${link.id}`}
                    className="underline underline-offset-2 text-muted-foreground transition-colors hover:text-text-primary"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="mt-4 sm:grid sm:grid-cols-[220px_1fr] sm:gap-6">
              <aside className="hidden sm:block sm:sticky sm:top-24 sm:h-max sm:self-start sm:rounded-xl sm:border sm:border-hairline sm:bg-surface sm:p-4 sm:text-sm sm:text-text-secondary">
                <div className="mb-2 text-sm font-semibold text-text-primary">
                  {toc.title ?? 'On this page'}
                </div>
                <ul className="space-y-1">
                  {tocLinks.map((link) => (
                    <li key={link.id}>
                      <a
                        href={`#${link.id}`}
                        className="text-muted-foreground transition-colors hover:underline hover:text-text-primary"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>
              <div className="stack-gap-lg">
                <DocsTocActive />
                <section className="grid grid-gap lg:grid-cols-2">
                  {sections.map((section, index) => {
                    const sectionId = sectionOrder[index] ?? undefined;
                    return (
                      <article
                        key={section.title}
                        id={sectionId}
                        className="scroll-mt-28 rounded-card border border-hairline bg-surface p-6 shadow-card"
                      >
                        <h2 className="text-lg font-semibold text-text-primary">{section.title}</h2>
                        {sectionId === 'api' ? (
                          <p className="mt-1 text-xs text-text-muted">
                            {apiNoticeLabel ?? ''}
                          </p>
                        ) : null}
                        <ul className="mt-4 stack-gap-sm text-sm text-text-secondary">
                          {section.items.map((item, index) => {
                            if (typeof item === 'string') {
                              return (
                                <li key={index} className="flex items-start gap-2">
                                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-text-muted" />
                                  <span>{item}</span>
                                </li>
                              );
                            }
                            if (typeof item === 'object' && item?.type === 'link') {
                              return (
                                <li key={index} className="flex items-start gap-2">
                                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-text-muted" />
                                  <span>
                                    {item.before}
                                    <Link href="/legal/terms" className="text-brand hover:text-brandHover">
                                      {item.terms}
                                    </Link>
                                    {item.and}
                                    <Link href="/legal/privacy" className="text-brand hover:text-brandHover">
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
                              {onboardingChecklist.title ?? 'Onboarding checklist'}
                            </h3>
                            <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
                              {(onboardingChecklist.items ?? []).map((item: string) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                            <p className="mt-2 text-xs text-text-muted">
                              {onboardingChecklist.note ?? ''}
                            </p>
                          </section>
                        ) : null}
                        {sectionId === 'pricing' ? (
                          <Callout tone="success">{content.pricingCallout ?? '✅ You always see the price before you render.'}</Callout>
                        ) : null}
                        {sectionId === 'refunds' ? (
                          <section aria-labelledby="refunds-timeline" className="mt-4">
                            <h3 id="refunds-timeline" className="text-base font-semibold text-text-primary">
                              {refundsTimeline.title ?? 'Refunds timeline'}
                            </h3>
                            <ol className="mt-2 space-y-1.5 text-sm text-text-secondary">
                              {(refundsTimeline.steps ?? []).map((item: string) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ol>
                            <p className="mt-2 text-xs text-text-muted">
                              {refundsTimeline.note ?? ''}
                            </p>
                          </section>
                        ) : null}
                        {sectionId === 'refunds' ? (
                          <Callout tone="success">
                            {content.refundsCallout ?? '✅ Failed jobs are auto-refunded within minutes; receipts include a short incident note.'}
                          </Callout>
                        ) : null}
                        {sectionId === 'safety' ? (
                          <section aria-labelledby="safety-quick" className="mt-4">
                            <h3 id="safety-quick" className="text-base font-semibold text-text-primary">
                              {safetyQuick.title ?? 'Quick overview'}
                            </h3>
                            <ul className="mt-2 space-y-1.5 text-sm text-text-muted">
                              {(safetyQuick.items ?? []).map((item: string) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                            <p className="mt-2 text-xs text-text-muted">
                              {safetyQuick.note ?? ''}
                            </p>
                          </section>
                        ) : null}
                        {sectionId === 'safety' ? (
                          <Callout tone="warn">
                            {content.safetyCallout ?? '⚠️ Sensitive use-cases may require an admin allowlist or human review.'}
                          </Callout>
                        ) : null}
                        {sectionId && seeAlsoLinks[sectionId]?.length ? (
                          <p className="mt-3 text-sm">
                            <span className="text-muted-foreground">
                              {content.seeAlsoLabel ?? 'See also:'}
                            </span>{' '}
                            {seeAlsoLinks[sectionId].map((link, linkIndex) => (
                              <span key={link.href}>
                                <Link className="underline underline-offset-2" href={link.href}>
                                  {link.label}
                                </Link>
                                {linkIndex < seeAlsoLinks[sectionId].length - 1 ? ', ' : null}
                              </span>
                            ))}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </section>

                <section id="library" className="scroll-mt-28">
                  <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
                    {libraryCopy.heading ?? content.libraryHeading ?? 'Library'}
                    <FlagPill live={FEATURES.docs.libraryDocs} />
                    <span className="sr-only">
                      {FEATURES.docs.libraryDocs
                        ? libraryCopy.liveLabel ?? 'Live'
                        : libraryCopy.comingSoonLabel ?? 'Coming soon'}
                    </span>
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    {FEATURES.docs.libraryDocs
                      ? libraryCopy.summaryLive ?? 'Browse reusable assets, presets, and reference prompts for your team.'
                      : libraryCopy.summarySoon ?? 'Documentation coming soon.'}
                  </p>
                  {FEATURES.docs.libraryDocs && docs.length > 0 ? (
                    <ul className="mt-4 stack-gap-sm text-sm text-text-secondary">
                      {docs.map((doc) => (
                        <li key={doc.slug}>
                          <Link href={{ pathname: '/docs/[slug]', params: { slug: doc.slug } }} className="font-semibold text-brand hover:text-brandHover">
                            {doc.title}
                          </Link>
                          <p className="text-xs text-text-muted">{doc.description}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {seeAlsoLinks.library?.length ? (
                    <p className="mt-3 text-sm">
                      <span className="text-muted-foreground">
                        {content.seeAlsoLabel ?? 'See also:'}
                      </span>{' '}
                      {seeAlsoLinks.library.map((link, linkIndex) => (
                        <span key={link.href}>
                          <Link className="underline underline-offset-2" href={link.href}>
                            {link.label}
                          </Link>
                          {linkIndex < seeAlsoLinks.library.length - 1 ? ', ' : null}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </section>
              </div>
            </div>
          </nav>
          <section aria-labelledby="docs-feedback">
            <h3 id="docs-feedback" className="sr-only">
              {feedbackCopy.srTitle ?? 'Feedback'}
            </h3>
            <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-text-muted">
                {feedbackCopy.prompt ?? 'Was this page helpful?'}
              </p>
              <div className="flex items-center gap-2">
                <Link href="/contact" className="rounded-md border border-hairline px-3 py-1.5 text-sm hover:shadow-sm">
                  {feedbackCopy.yes ?? 'Yes'}
                </Link>
                <Link href="/contact" className="rounded-md border border-hairline px-3 py-1.5 text-sm hover:shadow-sm">
                  {feedbackCopy.no ?? 'No'}
                </Link>
                <a href="#top" className="ml-2 text-sm underline underline-offset-2">
                  {feedbackCopy.backToTop ?? 'Back to top'}
                </a>
              </div>
            </div>
          </section>
          <p className="text-xs text-text-muted">
            {lastUpdatedLabel} {new Date().toISOString().slice(0, 10)}
          </p>
        </div>
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: jsonLdCopy.collectionName ?? content.meta?.title ?? 'Docs — Onboarding, Brand Safety, Refunds & API Webhooks',
              url: metadataUrls.canonical,
              hasPart: [
                {
                  '@type': 'WebPage',
                  name: jsonLdCopy.hasPart?.onboarding ?? toc.onboarding ?? 'Onboarding',
                  url: `${metadataUrls.canonical}#onboarding`,
                },
                {
                  '@type': 'WebPage',
                  name: jsonLdCopy.hasPart?.pricing ?? toc.pricing ?? 'Price system',
                  url: `${metadataUrls.canonical}#pricing`,
                },
                {
                  '@type': 'WebPage',
                  name: jsonLdCopy.hasPart?.refunds ?? toc.refunds ?? 'Refunds',
                  url: `${metadataUrls.canonical}#refunds`,
                },
                {
                  '@type': 'WebPage',
                  name: jsonLdCopy.hasPart?.safety ?? toc.safety ?? 'Brand safety',
                  url: `${metadataUrls.canonical}#safety`,
                },
                {
                  '@type': 'WebPage',
                  name: jsonLdCopy.hasPart?.api ?? toc.api ?? 'API references',
                  url: `${metadataUrls.canonical}#api`,
                },
                {
                  '@type': 'WebPage',
                  name: jsonLdCopy.hasPart?.library ?? toc.library ?? 'Library',
                  url: `${metadataUrls.canonical}#library`,
                },
              ],
              about:
                jsonLdCopy.about ?? ['onboarding', 'refund policy', 'brand safety', 'webhooks', 'api references'],
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
                { '@type': 'ListItem', position: 1, name: jsonLdCopy.breadcrumbHome ?? 'Home', item: `${SITE}/` },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: jsonLdCopy.breadcrumbDocs ?? 'Docs',
                  item: metadataUrls.canonical,
                },
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
              mainEntity: (jsonLdCopy.faq ?? []).map((entry: { question: string; answer: string }) => ({
                '@type': 'Question',
                name: entry.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: entry.answer,
                },
              })),
            }),
          }}
        />
      </div>
    </main>
  );
}
