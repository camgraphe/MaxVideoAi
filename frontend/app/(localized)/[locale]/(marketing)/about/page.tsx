import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const ABOUT_SLUG_MAP = buildSlugMap('about');
const ABOUT_META: Record<AppLocale, { title: string; description: string }> = {
  en: {
    title: 'About MaxVideoAI: AI Video Model Routing',
    description:
      'Learn how MaxVideoAI routes prompts across AI video engines with price clarity, model-agnostic workflows, and production-focused controls.',
  },
  fr: {
    title: 'À propos de MaxVideoAI : hub vidéo IA indépendant',
    description:
      'Découvrez comment MaxVideoAI route les prompts vers les bons moteurs vidéo IA avec prix clair, workflows indépendants et contrôles de production.',
  },
  es: {
    title: 'Acerca de MaxVideoAI: hub de modelos de video IA',
    description:
      'Descubre cómo MaxVideoAI enruta prompts hacia motores de video con IA con precios claros, flujos independientes y controles de producción.',
  },
};

const ABOUT_LINKS: Record<
  AppLocale,
  {
    prefix: string;
    links: Array<{ href: string; label: string }>;
  }
> = {
  en: {
    prefix: 'Related pages:',
    links: [
      { href: '/legal', label: 'Legal center' },
      { href: '/workflows', label: 'Workflows' },
      { href: '/docs', label: 'Docs' },
    ],
  },
  fr: {
    prefix: 'Pages liées :',
    links: [
      { href: '/legal', label: 'Centre juridique' },
      { href: '/workflows', label: 'Flux de travail' },
      { href: '/docs', label: 'Docs' },
    ],
  },
  es: {
    prefix: 'Páginas relacionadas:',
    links: [
      { href: '/legal', label: 'Centro legal' },
      { href: '/workflows', label: 'Flujos de trabajo' },
      { href: '/docs', label: 'Docs' },
    ],
  },
};

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale;
  const metaCopy = ABOUT_META[locale] ?? ABOUT_META.en;

  return buildSeoMetadata({
    locale,
    title: metaCopy.title,
    description: metaCopy.description,
    hreflangGroup: 'about',
    slugMap: ABOUT_SLUG_MAP,
    keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
    imageAlt: 'About MaxVideo AI.',
  });
}

export default async function AboutPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.about;
  const related = ABOUT_LINKS[params.locale] ?? ABOUT_LINKS.en;
  const relatedLinks = related.links.map((item) => ({
    ...item,
    href: item.href === '/legal' ? localizePathFromEnglish(params.locale, item.href) : item.href,
  }));

  return (
    <div className="container-page max-w-4xl section">
      <div className="stack-gap-lg">
        <header className="stack-gap-sm">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{content.hero.subtitle}</p>
        </header>

        <section className="stack-gap-lg text-sm text-text-secondary">
          {content.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>

        <aside className="rounded-card border border-hairline bg-surface p-6 shadow-card text-sm text-text-muted">
          {content.note}
        </aside>

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
