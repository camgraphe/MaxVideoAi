import Link from 'next/link';
import type { Metadata } from 'next';
import { getLegalDocuments } from '@/lib/legal';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { resolveLocale } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';

const LEGAL_INDEX_URL = `${SITE_BASE_URL}/legal`;

export const metadata: Metadata = {
  title: 'Legal Center',
  description: 'Access the latest MaxVideoAI legal documents and compliance resources.',
  alternates: {
    canonical: LEGAL_INDEX_URL,
  },
};

type LinkKey =
  | 'terms'
  | 'privacy'
  | 'cookies'
  | 'acceptableUse'
  | 'takedown'
  | 'mentions'
  | 'subprocessors';

const LINKS: Array<{ href: string; key: LinkKey; docKey?: 'terms' | 'privacy' | 'cookies' }> = [
  { href: '/legal/terms', key: 'terms', docKey: 'terms' },
  { href: '/legal/privacy', key: 'privacy', docKey: 'privacy' },
  { href: '/legal/cookies', key: 'cookies', docKey: 'cookies' },
  { href: '/legal/acceptable-use', key: 'acceptableUse' },
  { href: '/legal/takedown', key: 'takedown' },
  { href: '/legal/mentions', key: 'mentions' },
  { href: '/legal/subprocessors', key: 'subprocessors' },
];

type HeroCopy = {
  title: string;
  description: string;
  intro: string;
  columns: Array<{ title: string; body: string }>;
  versionLabel: string;
  links: Record<LinkKey, string>;
};

const EMAIL_TOKEN = '{{email}}';

const HERO_COPY: Record<AppLocale, HeroCopy> = {
  en: {
    title: 'Legal center',
    description: 'The definitive source for our legal agreements, privacy commitments, and compliance resources.',
    intro:
      'Every document here reflects the current production terms for MaxVideoAI. We update policies whenever routing infrastructure, data retention, or partner requirements change, and the most recent version id is referenced directly in the workspace. Use this hub to confirm contractual language, review subprocessors, or download artefacts for your compliance team.',
    columns: [
      {
        title: 'Staying informed',
        body:
          'Subscribe to the changelog for release-level updates and check the status page when you need live incident context. Legal updates are timestamped and summarized at the top of each article.',
      },
      {
        title: 'Need agreements?',
        body:
          'Enterprise customers can request signed DPAs, security questionnaires, or SOC documentation by emailing {{email}} with their company details and required forms.',
      },
    ],
    versionLabel: 'Version',
    links: {
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      cookies: 'Cookie Policy',
      acceptableUse: 'Acceptable Use Policy',
      takedown: 'Notice & Takedown',
      mentions: 'Mentions légales',
      subprocessors: 'Sub-processors',
    },
  },
  fr: {
    title: 'Centre juridique',
    description: 'Le référentiel officiel de nos accords, engagements de confidentialité et documents de conformité.',
    intro:
      'Chaque document publié ici reflète les conditions applicables en production. Nous mettons à jour ces politiques lorsque l’infrastructure de routage, la conservation des données ou les exigences de nos partenaires évoluent, et la version active est indiquée directement dans l’espace de travail. Utilisez ce hub pour vérifier le langage contractuel, examiner les sous-traitants ou fournir des pièces à votre équipe conformité.',
    columns: [
      {
        title: 'Rester informé',
        body:
          'Abonnez-vous au changelog pour suivre les nouveautés produit et consultez la page statut pour obtenir le contexte en cas d’incident. Chaque mise à jour juridique est datée et résumée en tête d’article.',
      },
      {
        title: 'Besoin d’accords ?',
        body:
          'Les clients Enterprise peuvent demander des DPA signés, questionnaires sécurité ou documents SOC en écrivant à {{email}} avec le nom de leur société et les formulaires requis.',
      },
    ],
    versionLabel: 'Version',
    links: {
      terms: "Conditions d’utilisation",
      privacy: 'Politique de confidentialité',
      cookies: 'Politique cookies',
      acceptableUse: 'Politique d’utilisation acceptable',
      takedown: 'Notification & retrait',
      mentions: 'Mentions légales',
      subprocessors: 'Sous-traitants',
    },
  },
  es: {
    title: 'Centro legal',
    description: 'El repositorio oficial de nuestros acuerdos, compromisos de privacidad y recursos de cumplimiento.',
    intro:
      'Cada documento refleja los términos vigentes en MaxVideoAI. Actualizamos las políticas cuando cambian el enrutamiento, la retención de datos o los requisitos de nuestros socios, y la versión activa aparece directamente en el espacio de trabajo. Usa este hub para revisar el lenguaje contractual, consultar subprocesadores o compartir artefactos con tu equipo de compliance.',
    columns: [
      {
        title: 'Mantente informado',
        body:
          'Suscríbete al changelog para conocer las novedades y revisa la página de estado cuando necesites contexto en vivo. Cada actualización legal se marca con fecha y se resume al inicio del artículo.',
      },
      {
        title: '¿Necesitas acuerdos?',
        body:
          'Los clientes Enterprise pueden solicitar DPAs firmados, cuestionarios de seguridad o informes SOC escribiendo a {{email}} con los datos de su empresa y los formularios requeridos.',
      },
    ],
    versionLabel: 'Versión',
    links: {
      terms: 'Términos del servicio',
      privacy: 'Política de privacidad',
      cookies: 'Política de cookies',
      acceptableUse: 'Política de uso aceptable',
      takedown: 'Notificación y retirada',
      mentions: 'Aviso legal',
      subprocessors: 'Subencargados',
    },
  },
};

export default async function LegalIndexPage() {
  const locale = await resolveLocale();
  const copy = HERO_COPY[locale] ?? HERO_COPY.en;
  const documents = await getLegalDocuments(['terms', 'privacy', 'cookies']);
  const renderEmailText = (text: string) => {
    if (!text.includes(EMAIL_TOKEN)) {
      return text;
    }
    const parts = text.split(EMAIL_TOKEN);
    return parts.map((part, index) => (
      <span key={`${part}-${index}`}>
        {part}
        {index < parts.length - 1 ? (
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
            className="font-semibold text-accent hover:text-accentSoft"
          />
        ) : null}
      </span>
    ));
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">{copy.title}</h2>
        <p className="text-sm text-text-secondary">{copy.description}</p>
      </header>

      <section className="rounded-card border border-hairline bg-white/90 p-5 text-sm text-text-secondary shadow-card sm:p-6">
        <p>{copy.intro}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {copy.columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{column.title}</h3>
              <p className="mt-2">{renderEmailText(column.body)}</p>
            </div>
          ))}
        </div>
      </section>

      <ul className="space-y-4">
        {LINKS.map((entry) => {
          const meta = entry.docKey ? documents[entry.docKey] : null;
          return (
            <li key={entry.href} className="rounded-card border border-border bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={entry.href}
                    className="text-lg font-semibold text-accent transition hover:text-accentSoft"
                  >
                    {copy.links[entry.key]}
                  </Link>
                  {meta?.version ? (
                    <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">
                      {copy.versionLabel} {meta.version}
                    </p>
                  ) : null}
                </div>
                <span aria-hidden className="text-text-muted">→</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
