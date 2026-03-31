import type { Metadata } from 'next';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { resolveLocale } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';

type CookieRow = {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
  category: 'essential' | 'analytics' | 'advertising';
  notes?: string;
};

const METADATA_COPY: Record<AppLocale, { title: string; description: string; imageAlt: string }> = {
  en: {
    title: 'Cookie list',
    description: 'Inventory of cookies and SDKs used by MaxVideoAI.',
    imageAlt: 'Cookie inventory table.',
  },
  fr: {
    title: 'Liste des cookies',
    description: 'Inventaire des cookies et SDK utilisés par MaxVideoAI.',
    imageAlt: 'Tableau d’inventaire des cookies.',
  },
  es: {
    title: 'Lista de cookies',
    description: 'Inventario de cookies y SDK utilizados por MaxVideoAI.',
    imageAlt: 'Tabla de inventario de cookies.',
  },
};

const PAGE_COPY: Record<
  AppLocale,
  {
    title: string;
    intro: string;
    lastUpdated: string;
    categoryLabel: Record<CookieRow['category'], string>;
    noneInUse: string;
    required: string;
    consentOnly: string;
    columns: { name: string; provider: string; purpose: string; duration: string };
    contactIntro: string;
  }
> = {
  en: {
    title: 'Cookie & SDK inventory',
    intro: 'We track the cookies and SDKs used on maxvideoai.com. Non-essential technologies are only activated after consent.',
    lastUpdated: 'Last updated: 26 October 2025',
    categoryLabel: {
      essential: 'Essential',
      analytics: 'Analytics',
      advertising: 'Advertising',
    },
    noneInUse: 'None currently in use. We will update this table before activating technologies in this category.',
    required: 'Required for the Service to function. They cannot be disabled in the consent manager.',
    consentOnly: 'Activated only after you grant consent in the cookie banner or preference centre.',
    columns: {
      name: 'Name',
      provider: 'Provider',
      purpose: 'Purpose',
      duration: 'Duration',
    },
    contactIntro: 'Have questions or found an inconsistency? Contact',
  },
  fr: {
    title: 'Inventaire des cookies et SDK',
    intro: 'Nous référençons les cookies et SDK utilisés sur maxvideoai.com. Les technologies non essentielles ne sont activées qu’après consentement.',
    lastUpdated: 'Dernière mise à jour : 26 octobre 2025',
    categoryLabel: {
      essential: 'Essentiels',
      analytics: 'Mesure d’audience',
      advertising: 'Publicitaires',
    },
    noneInUse: 'Aucun n’est actuellement utilisé. Nous mettrons ce tableau à jour avant d’activer des technologies dans cette catégorie.',
    required: 'Nécessaires au fonctionnement du Service. Ils ne peuvent pas être désactivés dans le gestionnaire de consentement.',
    consentOnly: 'Activés uniquement après votre consentement dans le bandeau cookies ou le centre de préférences.',
    columns: {
      name: 'Nom',
      provider: 'Fournisseur',
      purpose: 'Finalité',
      duration: 'Durée',
    },
    contactIntro: 'Une question ou une incohérence à signaler ? Contactez',
  },
  es: {
    title: 'Inventario de cookies y SDK',
    intro: 'Mantenemos un inventario de los cookies y SDK utilizados en maxvideoai.com. Las tecnologías no esenciales solo se activan tras el consentimiento.',
    lastUpdated: 'Última actualización: 26 de octubre de 2025',
    categoryLabel: {
      essential: 'Esenciales',
      analytics: 'Analítica',
      advertising: 'Publicitarios',
    },
    noneInUse: 'Actualmente no hay ninguno en uso. Actualizaremos esta tabla antes de activar tecnologías en esta categoría.',
    required: 'Necesarios para que el Servicio funcione. No se pueden desactivar en el gestor de consentimiento.',
    consentOnly: 'Se activan solo después de que otorgues tu consentimiento en el banner de cookies o en el centro de preferencias.',
    columns: {
      name: 'Nombre',
      provider: 'Proveedor',
      purpose: 'Finalidad',
      duration: 'Duración',
    },
    contactIntro: 'Si tienes preguntas o detectas una incoherencia, contacta con',
  },
};

const COOKIE_ROWS: Record<AppLocale, CookieRow[]> = {
  en: [
    {
      name: 'sb-access-token',
      provider: 'Supabase',
      purpose: 'Authentication session token for logged-in users (required).',
      duration: '1 week (refreshes on activity)',
      category: 'essential',
    },
    {
      name: 'sb-refresh-token',
      provider: 'Supabase',
      purpose: 'Refresh token enabling silent session renewal (required).',
      duration: 'Rolling 4 weeks',
      category: 'essential',
    },
    {
      name: 'mv-consent',
      provider: 'MaxVideoAI',
      purpose: 'Stores cookie banner preferences (timestamp, categories).',
      duration: '13 months',
      category: 'essential',
    },
  ],
  fr: [
    {
      name: 'sb-access-token',
      provider: 'Supabase',
      purpose: 'Jeton de session d’authentification pour les utilisateurs connectés (obligatoire).',
      duration: '1 semaine (renouvelée en cas d’activité)',
      category: 'essential',
    },
    {
      name: 'sb-refresh-token',
      provider: 'Supabase',
      purpose: 'Jeton de rafraîchissement permettant le renouvellement silencieux de la session (obligatoire).',
      duration: '4 semaines glissantes',
      category: 'essential',
    },
    {
      name: 'mv-consent',
      provider: 'MaxVideoAI',
      purpose: 'Enregistre les préférences du bandeau cookies (horodatage, catégories).',
      duration: '13 mois',
      category: 'essential',
    },
  ],
  es: [
    {
      name: 'sb-access-token',
      provider: 'Supabase',
      purpose: 'Token de sesión de autenticación para usuarios conectados (obligatorio).',
      duration: '1 semana (se renueva con la actividad)',
      category: 'essential',
    },
    {
      name: 'sb-refresh-token',
      provider: 'Supabase',
      purpose: 'Token de refresco que permite la renovación silenciosa de la sesión (obligatorio).',
      duration: '4 semanas móviles',
      category: 'essential',
    },
    {
      name: 'mv-consent',
      provider: 'MaxVideoAI',
      purpose: 'Almacena las preferencias del banner de cookies (marca temporal, categorías).',
      duration: '13 meses',
      category: 'essential',
    },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await resolveLocale()) as AppLocale;
  const metadata = METADATA_COPY[locale] ?? METADATA_COPY.en;
  return buildSeoMetadata({
    locale,
    title: metadata.title,
    description: metadata.description,
    hreflangGroup: 'legalCookiesList',
    englishPath: '/legal/cookies-list',
    availableLocales: ['en', 'fr', 'es'] as AppLocale[],
    ogType: 'article',
    imageAlt: metadata.imageAlt,
  });
}

export default async function CookiesListPage() {
  const locale = (await resolveLocale()) as AppLocale;
  const copy = PAGE_COPY[locale] ?? PAGE_COPY.en;
  const rows = COOKIE_ROWS[locale] ?? COOKIE_ROWS.en;
  const grouped = rows.reduce<Record<CookieRow['category'], CookieRow[]>>(
    (acc, row) => {
      acc[row.category] ??= [];
      acc[row.category].push(row);
      return acc;
    },
    { essential: [], analytics: [], advertising: [] }
  );

  return (
    <div className="stack-gap-lg">
      <header className="stack-gap-sm">
        <h1 className="text-xl font-semibold text-text-primary">{copy.title}</h1>
        <p className="text-sm text-text-secondary">{copy.intro}</p>
        <p className="text-sm text-text-secondary">{copy.lastUpdated}</p>
      </header>

      <article className="stack-gap-xl text-base leading-relaxed text-text-secondary">
        {(Object.keys(grouped) as CookieRow['category'][]).map((category) => (
          <section key={category} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{copy.categoryLabel[category]} cookies</h3>
              {grouped[category].length === 0 ? (
                <p className="text-sm text-text-muted">{copy.noneInUse}</p>
              ) : (
                <p className="text-sm text-text-secondary">
                  {category === 'essential' ? copy.required : copy.consentOnly}
                </p>
              )}
            </div>
            {grouped[category].length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-bg-secondary text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    <tr>
                      <th scope="col" className="px-4 py-3">{copy.columns.name}</th>
                      <th scope="col" className="px-4 py-3">{copy.columns.provider}</th>
                      <th scope="col" className="px-4 py-3">{copy.columns.purpose}</th>
                      <th scope="col" className="px-4 py-3">{copy.columns.duration}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {grouped[category].map((row) => (
                      <tr key={row.name}>
                        <td className="px-4 py-4 font-medium text-text-primary">{row.name}</td>
                        <td className="px-4 py-4 text-text-secondary">{row.provider}</td>
                        <td className="px-4 py-4 text-text-secondary">
                          {row.purpose}
                          {row.notes ? <span className="block text-xs text-text-muted">{row.notes}</span> : null}
                        </td>
                        <td className="px-4 py-4 text-text-secondary">{row.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ))} 

        <p className="text-sm text-text-secondary">
          {copy.contactIntro}{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
          />
          .
        </p>
      </article>
    </div>
  );
}
