import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentEntries } from '@/lib/content/markdown';
import { resolveDictionary } from '@/lib/i18n/server';

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

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="rounded-card border border-hairline bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-text-primary">{section.title}</h2>
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
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-text-primary">{content.libraryHeading ?? 'Library'}</h2>
        {docs.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">{content.empty}</p>
        ) : (
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
        )}
      </section>
    </div>
  );
}
