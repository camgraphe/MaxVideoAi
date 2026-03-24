import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const COMPANY_SLUG_MAP = buildSlugMap('company');

const COMPANY_META: Record<AppLocale, { title: string; description: string }> = {
  en: {
    title: 'Company & Trust — MaxVideoAI',
    description: 'Find company, support, workflow, status, and legal resources in one place.',
  },
  fr: {
    title: 'Entreprise & confiance — MaxVideoAI',
    description: 'Retrouvez en un seul endroit les ressources entreprise, support, flux de travail, statut et légales.',
  },
  es: {
    title: 'Empresa y confianza — MaxVideoAI',
    description: 'Consulta en un solo lugar recursos de empresa, soporte, flujos de trabajo, estado y legales.',
  },
};

const COMPANY_COPY: Record<
  AppLocale,
  {
    title: string;
    subtitle: string;
    links: Array<{ href: string; label: string; description: string }>;
  }
> = {
  en: {
    title: 'Company & Trust',
    subtitle: 'Core trust and support pages, grouped in one index.',
    links: [
      { href: '/about', label: 'About', description: 'Who we are and what we build.' },
      { href: '/contact', label: 'Contact', description: 'Support, partnerships, and press requests.' },
      { href: '/workflows', label: 'Workflows', description: 'How MaxVideoAI production flows are structured.' },
      { href: '/status', label: 'Status', description: 'Live service health and incident history.' },
      { href: '/legal', label: 'Legal center', description: 'Policies, notices, and compliance resources.' },
    ],
  },
  fr: {
    title: 'Entreprise & confiance',
    subtitle: 'Les pages de confiance et de support, regroupées dans un seul index.',
    links: [
      { href: '/about', label: 'À propos', description: 'Qui nous sommes et ce que nous construisons.' },
      { href: '/contact', label: 'Contact', description: 'Support, partenariats et demandes presse.' },
      { href: '/workflows', label: 'Flux de travail', description: 'Comment les flux de production MaxVideoAI sont structurés.' },
      { href: '/status', label: 'Statut', description: 'État du service en direct et historique des incidents.' },
      { href: '/legal', label: 'Centre juridique', description: 'Politiques, notifications et ressources conformité.' },
    ],
  },
  es: {
    title: 'Empresa y confianza',
    subtitle: 'Páginas clave de confianza y soporte agrupadas en un único índice.',
    links: [
      { href: '/about', label: 'Acerca de', description: 'Quiénes somos y qué construimos.' },
      { href: '/contact', label: 'Contacto', description: 'Soporte, alianzas y solicitudes de prensa.' },
      { href: '/workflows', label: 'Flujos de trabajo', description: 'Cómo se estructuran los flujos de producción de MaxVideoAI.' },
      { href: '/status', label: 'Estado', description: 'Salud del servicio en vivo e historial de incidentes.' },
      { href: '/legal', label: 'Centro legal', description: 'Políticas, avisos y recursos de cumplimiento.' },
    ],
  },
};

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const meta = COMPANY_META[locale] ?? COMPANY_META.en;
  return buildSeoMetadata({
    locale,
    title: meta.title,
    description: meta.description,
    hreflangGroup: 'company',
    slugMap: COMPANY_SLUG_MAP,
    imageAlt: 'Company and trust resources.',
  });
}

export default function CompanyPage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale;
  const copy = COMPANY_COPY[locale] ?? COMPANY_COPY.en;
  const links = copy.links.map((entry) => ({
    ...entry,
    href: entry.href === '/legal' ? localizePathFromEnglish(locale, entry.href) : entry.href,
  }));

  return (
    <div className="container-page max-w-4xl section">
      <div className="stack-gap-lg">
        <header className="stack-gap-sm">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{copy.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{copy.subtitle}</p>
        </header>
        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card sm:p-8">
          <ul className="space-y-4">
            {links.map((entry) => (
              <li key={entry.href} className="rounded-card border border-border bg-surface-glass-90 p-5">
                <Link href={entry.href} className="text-lg font-semibold text-brand transition hover:text-brandHover">
                  {entry.label}
                </Link>
                <p className="mt-2 text-sm text-text-secondary">{entry.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
