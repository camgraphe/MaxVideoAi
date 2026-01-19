import type { Metadata } from 'next';
import Link from 'next/link';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { resolveLocale } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await resolveLocale()) as AppLocale;
  return buildSeoMetadata({
    locale,
    title: 'Mentions légales',
    description: 'Informations légales obligatoires pour MaxVideoAI.',
    hreflangGroup: 'legalMentions',
    englishPath: '/legal/mentions',
    availableLocales: ['en', 'fr', 'es'] as AppLocale[],
    ogType: 'article',
    imageAlt: 'Mentions légales',
  });
}

export default function MentionsLegalesPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">Mentions légales</h2>
        <p className="text-sm text-text-secondary">
          Conformément à l’article 6 de la loi n°2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique.
        </p>
      </header>

      <article className="stack-gap-lg text-base leading-relaxed text-text-secondary">
        <section className="space-y-2">
          <h3 className="text-lg font-semibold text-text-primary">Éditeur du site</h3>
          <p>
            <strong>Dénomination&nbsp;:</strong> MaxVideoAI (entreprise individuelle en cours d’immatriculation)
          </p>
          <p>
            <strong>Adresse&nbsp;:</strong> 324 rue de la mare, 60730 Novillers, France
          </p>
          <p>
            <strong>Responsable de la publication&nbsp;:</strong> Adrien Millot
          </p>
          <p>
            <strong>Contact&nbsp;:</strong>{' '}
            <ObfuscatedEmailLink
              user="support"
              domain="maxvideoai.com"
              label="support@maxvideoai.com"
              placeholder="support [at] maxvideoai.com"
            />{' '}
            ·{' '}
            <ObfuscatedEmailLink
              user="legal"
              domain="maxvideoai.com"
              label="legal@maxvideoai.com"
              placeholder="legal [at] maxvideoai.com"
            />
          </p>
          <p>
            <strong>SIREN&nbsp;:</strong> en cours d’attribution · <strong>TVA intracommunautaire&nbsp;:</strong> en cours d’attribution
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-lg font-semibold text-text-primary">Hébergement</h3>
          <p>
            <strong>Hébergeur&nbsp;:</strong> Vercel Inc., 444 De Haro Street, Suite 200, San Francisco, CA 94107, États-Unis
          </p>
          <p>
            <strong>Site web&nbsp;:</strong>{' '}
            <a href="https://vercel.com" className="text-brand underline hover:text-brandHover">
              https://vercel.com
            </a>
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-lg font-semibold text-text-primary">Propriété intellectuelle</h3>
          <p>
            L’ensemble des contenus (textes, visuels, interface, fonctionnalités) présentés sur maxvideoai.com est protégé par le droit d’auteur et,
            le cas échéant, par des droits de propriété industrielle. Toute reproduction ou représentation non autorisée est interdite.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-lg font-semibold text-text-primary">Données personnelles</h3>
          <p>
            MaxVideoAI collecte et traite des données personnelles conformément à la{' '}
            <Link href="/legal/privacy" className="text-brand underline hover:text-brandHover">
              Politique de confidentialité
            </Link>
            . Pour exercer vos droits RGPD (accès, rectification, suppression, opposition, portabilité), contactez{' '}
            <ObfuscatedEmailLink
              user="privacy"
              domain="maxvideoai.com"
              label="privacy@maxvideoai.com"
              placeholder="privacy [at] maxvideoai.com"
            />
            .
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-lg font-semibold text-text-primary">Crédits</h3>
          <p>
            Illustrations et contenus générés via MaxVideoAI et ses partenaires d’inférence. Les marques citées restent la propriété de leurs titulaires respectifs.
          </p>
        </section>
      </article>
    </div>
  );
}
