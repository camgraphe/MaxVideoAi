import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const ABOUT_SLUG_MAP = buildSlugMap('about');
const ABOUT_META: Record<AppLocale, { title: string; description: string }> = {
  en: {
    title: 'About — MaxVideoAI',
    description: 'Quiet, premium, precise. Independent AI video hub that routes the right engine for every shot.',
  },
  fr: {
    title: 'À propos — MaxVideoAI',
    description:
      'Hub vidéo IA indépendant : précision, sobriété et transparence pour router le bon moteur à chaque plan.',
  },
  es: {
    title: 'Acerca de — MaxVideoAI',
    description:
      'Hub independiente de video con IA que dirige el motor adecuado para cada plano con precio antes de generar.',
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
      { href: '/company', label: 'Company & Trust' },
      { href: '/workflows', label: 'Workflows' },
      { href: '/docs', label: 'Docs' },
    ],
  },
  fr: {
    prefix: 'Pages liées :',
    links: [
      { href: '/company', label: 'Entreprise & confiance' },
      { href: '/workflows', label: 'Flux de travail' },
      { href: '/docs', label: 'Docs' },
    ],
  },
  es: {
    prefix: 'Páginas relacionadas:',
    links: [
      { href: '/company', label: 'Empresa y confianza' },
      { href: '/workflows', label: 'Flujos de trabajo' },
      { href: '/docs', label: 'Docs' },
    ],
  },
};

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
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

export default async function AboutPage({ params }: { params: { locale: AppLocale } }) {
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.about;
  const related = ABOUT_LINKS[params.locale] ?? ABOUT_LINKS.en;

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
          {related.links.map((item, index) => (
            <span key={item.href}>
              <Link href={item.href} className="underline underline-offset-2 hover:text-text-primary">
                {item.label}
              </Link>
              {index < related.links.length - 1 ? ' · ' : null}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
