import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { getServiceNoticeSetting } from '@/server/app-settings';
import { buildStatusNoticeState } from './_lib/status-page-state';

export const revalidate = 30;

const STATUS_SLUG_MAP = buildSlugMap('status');
const STATUS_META: Record<AppLocale, { title: string; description: string }> = {
  en: {
    title: 'Service status — MaxVideoAI',
    description: 'Read current MaxVideoAI service notices and get help with an affected AI video generation.',
  },
  fr: {
    title: 'État du service — MaxVideoAI',
    description: 'Consultez les avis de service MaxVideoAI et obtenez de l’aide pour une génération vidéo IA affectée.',
  },
  es: {
    title: 'Estado del servicio — MaxVideoAI',
    description: 'Consulta los avisos de servicio de MaxVideoAI y obtén ayuda con una generación de video IA afectada.',
  },
};

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale;
  const metaCopy = STATUS_META[locale] ?? STATUS_META.en;
  return buildSeoMetadata({
    locale,
    title: metaCopy.title,
    description: metaCopy.description,
    hreflangGroup: 'status',
    slugMap: STATUS_SLUG_MAP,
    keywords: ['AI video service status', 'MaxVideoAI service notice', 'generation support'],
    imageAlt: 'MaxVideoAI service status.',
  });
}

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

export default async function StatusPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const [{ dictionary }, serviceNotice] = await Promise.all([
    resolveDictionary({ locale: params.locale }),
    getServiceNoticeSetting(),
  ]);
  const content = dictionary.status;
  const notice = buildStatusNoticeState(serviceNotice, content.currentNotice);
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
        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
            {content.currentNotice.title}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={
                notice.isActive
                  ? 'rounded-pill bg-[var(--warning-bg)] px-3 py-1 text-xs font-semibold text-[var(--warning)]'
                  : 'rounded-pill bg-surface-subtle px-3 py-1 text-xs font-semibold text-text-secondary'
              }
            >
              {notice.label}
            </span>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
            {notice.message}
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold text-text-primary">{content.affected.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{content.affected.body}</p>
          </section>
          <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold text-text-primary">{content.support.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {content.support.prefix}{' '}
              <ObfuscatedEmailLink user="support" domain="maxvideoai.com" label="support@maxvideoai.com" />{' '}
              {content.support.suffix}
            </p>
          </section>
        </div>

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
