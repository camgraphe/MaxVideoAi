import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const CHANGELOG_SLUG_MAP = buildSlugMap('changelog');

const CHANGELOG_LINKS: Record<
  AppLocale,
  {
    prefix: string;
    links: Array<{ href: string; label: string }>;
  }
> = {
  en: {
    prefix: 'Related pages:',
    links: [
      { href: '/status', label: 'Status' },
      { href: '/docs', label: 'Docs' },
      { href: '/legal', label: 'Legal center' },
    ],
  },
  fr: {
    prefix: 'Pages liées :',
    links: [
      { href: '/status', label: 'Statut' },
      { href: '/docs', label: 'Docs' },
      { href: '/legal', label: 'Centre juridique' },
    ],
  },
  es: {
    prefix: 'Páginas relacionadas:',
    links: [
      { href: '/status', label: 'Estado' },
      { href: '/docs', label: 'Docs' },
      { href: '/legal', label: 'Centro legal' },
    ],
  },
};

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.changelog as {
    meta?: { title?: string; description?: string };
  };
  const title = content.meta?.title ?? 'Changelog — MaxVideo AI';
  const description = content.meta?.description ?? 'Transparent updates on engines, workflows, and queue performance.';

  return buildSeoMetadata({
    locale,
    title,
    description,
    hreflangGroup: 'changelog',
    slugMap: CHANGELOG_SLUG_MAP,
    keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
    imageAlt: 'Changelog timeline.',
  });
}

export default async function ChangelogPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.changelog;
  const related = CHANGELOG_LINKS[params.locale] ?? CHANGELOG_LINKS.en;
  const relatedLinks = related.links.map((item) => ({
    ...item,
    href: item.href === '/legal' ? localizePathFromEnglish(params.locale, item.href) : item.href,
  }));
  const intro = (content as {
    intro?: {
      paragraphs?: string[];
      releaseTagsTitle?: string;
      releaseTags?: Array<{ label?: string; body?: string }>;
    };
  }).intro;

  return (
    <div className="container-page max-w-4xl section">
      <div className="stack-gap-lg">
        <header className="stack-gap-sm">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{content.hero.subtitle}</p>
        </header>
        <section className="rounded-card border border-hairline bg-surface/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
          {(intro?.paragraphs ?? []).map((paragraph) => (
            <p key={paragraph} className="mt-4 first:mt-0">
              {paragraph}
            </p>
          ))}
          <div className="mt-6 rounded-card border border-dashed border-hairline bg-bg/70 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{intro?.releaseTagsTitle}</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {(intro?.releaseTags ?? []).map((item) => (
                <li key={item.label}>
                  <span className="font-semibold text-text-primary">{item.label}</span> — {item.body}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="stack-gap-lg">
          {content.entries.map((entry) => (
            <article key={entry.date} className="rounded-card border border-hairline bg-surface p-6 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{entry.date}</p>
              <h2 className="mt-2 text-lg font-semibold text-text-primary">{entry.title}</h2>
              <p className="mt-2 text-sm text-text-secondary">{entry.body}</p>
            </article>
          ))}
        </section>

        <p className="text-sm text-text-muted">
          <span className="font-medium text-text-secondary">{related.prefix}</span>{' '}
          {relatedLinks.map((item, index) => (
            <span key={item.href}>
              <Link href={item.href} className="underline underline-offset-2 hover:text-text-primary">
                {item.label}
              </Link>
              {index < relatedLinks.length - 1 ? ' · ' : null}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
