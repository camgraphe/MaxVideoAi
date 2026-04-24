import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';

const STATUS_SLUG_MAP = buildSlugMap('status');
const STATUS_META: Record<AppLocale, { title: string; description: string }> = {
  en: {
    title: 'Status — MaxVideoAI',
    description: 'Live status for engines, queue health, and incidents.',
  },
  fr: {
    title: 'Statut des moteurs — MaxVideoAI',
    description: 'Statut en direct des moteurs, santé des files d’attente et incidents récents.',
  },
  es: {
    title: 'Estado de motores — MaxVideoAI',
    description: 'Estado en vivo de los motores, salud de las colas y registro de incidentes.',
  },
};

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const metaCopy = STATUS_META[locale] ?? STATUS_META.en;
  return buildSeoMetadata({
    locale,
    title: metaCopy.title,
    description: metaCopy.description,
    hreflangGroup: 'status',
    slugMap: STATUS_SLUG_MAP,
    keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
    imageAlt: 'Status indicators.',
  });
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  Operational: 'bg-[var(--success-bg)] text-[var(--success)]',
  Opérationnel: 'bg-[var(--success-bg)] text-[var(--success)]',
  Operativo: 'bg-[var(--success-bg)] text-[var(--success)]',
  Dégradé: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  Degraded: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  Degradado: 'bg-[var(--warning-bg)] text-[var(--warning)]',
};

const STATUS_LINKS: Record<
  AppLocale,
  {
    prefix: string;
    links: Array<{ href: string; label: string }>;
  }
> = {
  en: {
    prefix: 'See also:',
    links: [
      { href: '/docs', label: 'Docs' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/legal', label: 'Legal center' },
    ],
  },
  fr: {
    prefix: 'Voir aussi :',
    links: [
      { href: '/docs', label: 'Docs' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/legal', label: 'Centre juridique' },
    ],
  },
  es: {
    prefix: 'Ver también:',
    links: [
      { href: '/docs', label: 'Docs' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/legal', label: 'Centro legal' },
    ],
  },
};

export default async function StatusPage({ params }: { params: { locale: AppLocale } }) {
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const content = dictionary.status;
  const related = STATUS_LINKS[params.locale] ?? STATUS_LINKS.en;
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
        <section className="rounded-card border border-hairline bg-surface/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
          <p>{content.overview.paragraphs[0]}</p>
          <p className="mt-4">{content.overview.paragraphs[1]}</p>
          <div className="mt-5 rounded-card border border-dashed border-hairline bg-bg/70 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{content.overview.quickReferencesTitle}</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                <span className="font-semibold text-text-primary">{content.overview.quickReferences[0].label}</span> — {content.overview.quickReferences[0].body}
              </li>
              <li>
                <span className="font-semibold text-text-primary">{content.overview.quickReferences[1].label}</span> — {content.overview.quickReferences[1].body}
              </li>
              <li>
                <span className="font-semibold text-text-primary">{content.overview.quickReferences[2].label}</span> — {content.overview.quickReferences[2].prefix}{' '}
                <ObfuscatedEmailLink user="support" domain="maxvideo.ai" label="support@maxvideo.ai" />{' '}
                {content.overview.quickReferences[2].suffix}
              </li>
            </ul>
          </div>
        </section>
        <section className="stack-gap">
          {content.systems.map((system) => (
            <article key={system.name} className="flex items-start justify-between gap-4 rounded-card border border-hairline bg-surface p-4 shadow-card">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{system.name}</h2>
                <p className="text-xs text-text-secondary">{system.detail}</p>
              </div>
              <span
                className={`rounded-pill px-3 py-1 text-xs font-semibold uppercase tracking-micro ${
                  STATUS_BADGE_CLASSES[system.status] ?? 'bg-[var(--success-bg)] text-[var(--success)]'
                }`}
              >
                {system.status}
              </span>
            </article>
          ))}
        </section>
        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{content.incidentsHeading}</h2>
          {content.incidents.map((incident) => (
            <article key={incident.date} className="mt-4 border-t border-hairline pt-4 first:border-none first:pt-0">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{incident.date}</p>
              <h3 className="text-sm font-semibold text-text-primary">{incident.title}</h3>
              <p className="mt-1 text-sm text-text-secondary">{incident.summary}</p>
              <span className="mt-2 inline-flex rounded-pill bg-[var(--success-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-micro text-[var(--success)]">
                {incident.status}
              </span>
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
