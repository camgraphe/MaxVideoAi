import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalVersionBadge } from '@/components/legal/LegalVersionBadge';
import { formatLegalDate, getLegalDocument } from '@/lib/legal';
import type { AppLocale } from '@/i18n/locales';
import { resolveLocale } from '@/lib/i18n/server';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await resolveLocale()) as AppLocale;
  return buildSeoMetadata({
    locale,
    title: 'Privacy Policy',
    description: 'How MaxVideoAI collects, uses, stores, and protects personal data.',
    hreflangGroup: 'legalPrivacy',
    englishPath: '/legal/privacy',
    availableLocales: ['en', 'fr', 'es'] as AppLocale[],
    ogType: 'article',
    imageAlt: 'Privacy Policy overview.',
  });
}

const HEADER_COPY: Record<AppLocale, { title: string; versionLabel: string; effectiveLabel: string; contactLabel: string }> = {
  en: {
    title: 'Privacy Policy',
    versionLabel: 'Version',
    effectiveLabel: 'Effective date',
    contactLabel: 'Contact:',
  },
  fr: {
    title: 'Politique de confidentialité',
    versionLabel: 'Version',
    effectiveLabel: "Date d’entrée en vigueur",
    contactLabel: 'Contact :',
  },
  es: {
    title: 'Política de privacidad',
    versionLabel: 'Versión',
    effectiveLabel: 'Fecha de entrada en vigor',
    contactLabel: 'Contacto:',
  },
};

type PrivacyBodyProps = {
  locale: AppLocale;
  version: string;
  effective: string | null;
};

function PrivacyArticle({ locale, version, effective }: PrivacyBodyProps) {
  switch (locale) {
    case 'fr':
      return <PrivacyArticleFr version={version} effective={effective} />;
    case 'es':
      return <PrivacyArticleEs version={version} effective={effective} />;
    default:
      return <PrivacyArticleEn version={version} effective={effective} />;
  }
}

export default async function PrivacyPage() {
  const locale = await resolveLocale();
  const document = await getLegalDocument('privacy');
  const version = document?.version ?? '2025-10-26';
  const effective = formatLegalDate(document?.publishedAt ?? `${version}T00:00:00Z`);
  const header = HEADER_COPY[locale] ?? HEADER_COPY.en;

  return (
    <div className="stack-gap-lg">
      <header className="stack-gap-sm">
        <h2 className="text-xl font-semibold text-text-primary">{header.title}</h2>
        <p className="text-sm text-text-secondary">
          {header.versionLabel}: {version} · {header.effectiveLabel}: {effective ?? version}
        </p>
        <p className="text-sm text-text-secondary">
          {locale === 'en' ? (
            <>
              Controller: MaxVideoAI (sole proprietorship in formation, France). Registered office: see{' '}
              <Link href="/legal/mentions" className="text-brand underline hover:text-brandHover">
                legal mentions
              </Link>
              .
            </>
          ) : locale === 'fr' ? (
            <>
              Responsable de traitement : MaxVideoAI (entreprise individuelle en France). Adresse : voir{' '}
              <Link href="/legal/mentions" className="text-brand underline hover:text-brandHover">
                Mentions légales
              </Link>
              .
            </>
          ) : (
            <>
              Responsable: MaxVideoAI (empresa individual en Francia). Dirección: consulta las{' '}
              <Link href="/legal/mentions" className="text-brand underline hover:text-brandHover">
                menciones legales
              </Link>
              .
            </>
          )}
        </p>
        <p className="text-sm text-text-secondary">
          {header.contactLabel}{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
            unstyled
            className="font-medium"
          />{' '}
          ·{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
            unstyled
            className="font-medium"
          />
        </p>
        <LegalVersionBadge docKey="privacy" doc={document} />
      </header>
      <PrivacyArticle locale={locale} version={version} effective={effective ?? version} />
    </div>
  );
}

function PrivacyArticleEn({ version, effective }: { version: string; effective: string | null }) {
  return (
    <article className="stack-gap-lg text-base leading-relaxed text-text-secondary">
      <p>
        This Privacy Policy explains how MaxVideoAI (“we”, “us”) collects, uses, discloses, and protects personal data when you visit maxvideoai.com, create an account, purchase
        top-ups, or generate AI outputs.
      </p>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">1. Scope</h3>
        <p>
          The Policy covers the processing of personal data across the MaxVideoAI workspace, including account management, billing, analytics, content generation, and support interactions.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">2. Categories of data we process</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Account &amp; identity:</strong> name, email, password hash, country/region, language.
          </li>
          <li>
            <strong>Transactional:</strong> wallet operations, top-ups, receipts (amount, currency, tax, timestamps), job IDs.
          </li>
          <li>
            <strong>Payments:</strong> processed by Stripe; we store Stripe identifiers and minimal payment metadata, never full card numbers.
          </li>
          <li>
            <strong>Usage &amp; telemetry:</strong> device information, IP, user-agent, approximate location, feature flags, error diagnostics, logs.
          </li>
          <li>
            <strong>Content:</strong> prompts, inputs, generated outputs, and file uploads needed to provide the Service.
          </li>
          <li>
            <strong>Consents &amp; preferences:</strong> legal document versions accepted, cookie choices, marketing opt-in, preferred currency.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">3. Purposes &amp; legal bases (GDPR)</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Provide the Service:</strong> account management, wallet, video jobs, support — legal basis: contract.
          </li>
          <li>
            <strong>Payments &amp; fraud prevention:</strong> processing payments, fraud monitoring — legal bases: contract, legitimate interests, legal obligation.
          </li>
          <li>
            <strong>Analytics &amp; product improvement:</strong> measuring usage to improve features — legal bases: consent for non-essential cookies; otherwise legitimate interests with safeguards.
          </li>
          <li>
            <strong>Marketing emails:</strong> sending product updates when you opt in — legal basis: consent (revocable anytime).
          </li>
          <li>
            <strong>Legal compliance &amp; security:</strong> record keeping, audit trails, incident response — legal bases: legal obligation and legitimate interests.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">4. Retention</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Account data:</strong> kept for as long as you have an account, plus limited backup retention.
          </li>
          <li>
            <strong>Receipts &amp; financial records:</strong> stored per statutory accounting periods.
          </li>
          <li>
            <strong>Logs &amp; telemetry:</strong> retained for short rolling windows unless needed for security or abuse investigations.
          </li>
          <li>We anonymise or delete data when it is no longer required for the purposes above.</li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">5. Sharing &amp; sub-processors</h3>
        <p>We use trusted providers to operate the Service. Typical sub-processors include:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Stripe (payments)</li>
          <li>Hosting/CDN (e.g., Vercel)</li>
          <li>Object storage (e.g., AWS S3)</li>
          <li>Database &amp; auth (Neon, Supabase)</li>
          <li>AI inference providers (e.g., Fal.ai)</li>
          <li>Email &amp; support tooling (transactional email, helpdesk)</li>
        </ul>
        <p>
          We maintain data-processing agreements with each provider. A current list is available at{' '}
          <Link href="/legal/subprocessors" className="text-brand underline hover:text-brandHover">
            /legal/subprocessors
          </Link>
          .
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">6. International transfers</h3>
        <p>
          When personal data leaves the EEA/UK, we rely on appropriate safeguards such as Standard Contractual Clauses and implement supplementary measures where required.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">7. Security</h3>
        <p>
          We apply technical and organisational measures including encryption in transit, access controls, least-privilege principles, monitoring, and incident response processes. No method is entirely
          secure, so we encourage strong passwords and two-factor authentication when available.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">8. Cookies &amp; similar technologies</h3>
        <p>
          We use essential cookies to run the site and, with your consent, analytics or advertising cookies. Consent can be withdrawn at any time via the cookie banner or settings. See the{' '}
          <Link href="/legal/cookies" className="text-brand underline hover:text-brandHover">
            Cookie Policy
          </Link>{' '}
          for details.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">9. Your rights (EU/EEA/UK)</h3>
        <p>
          Subject to conditions and applicable law, you may request access, rectification, erasure, restriction, objection, and data portability. You may also withdraw consent at any time. To exercise
          rights, email{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
          />
          . You can lodge a complaint with your local data protection authority; in France, contact the CNIL.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">10. Children</h3>
        <p>The Service is not directed to children under 15/16. If you believe a child provided data without appropriate consent, contact us so we can delete the data.</p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">11. Changes</h3>
        <p>
          We may update this Policy. Material changes will be announced in-app or by email and may require renewed consent. The version and effective date appear above.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">12. Contact</h3>
        <p>
          Questions about privacy?{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
          />
          .
        </p>
        <p className="text-sm text-text-muted">Last updated: {effective ?? version}</p>
      </section>
    </article>
  );
}

function PrivacyArticleFr({ version, effective }: { version: string; effective: string | null }) {
  return (
    <article className="stack-gap-lg text-base leading-relaxed text-text-secondary">
      <p>
        Cette Politique explique comment MaxVideoAI (« nous ») collecte, utilise, partage et protège vos données personnelles lorsque vous visitez maxvideoai.com, ouvrez un compte, achetez des crédits
        ou générez des sorties IA.
      </p>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">1. Périmètre</h3>
        <p>
          La Politique couvre les traitements effectués dans l’espace de travail MaxVideoAI : gestion de compte, facturation, analytics, génération de contenu et support.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">2. Données traitées</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Compte &amp; identité :</strong> nom, e-mail, empreinte de mot de passe, pays/région, langue.
          </li>
          <li>
            <strong>Transactionnel :</strong> opérations du wallet, recharges, reçus (montant, devise, taxes, horodatage), identifiants de jobs.
          </li>
          <li>
            <strong>Paiements :</strong> traités par Stripe ; nous conservons les identifiants Stripe et des métadonnées minimales, jamais le numéro complet de carte.
          </li>
          <li>
            <strong>Usage &amp; télémétrie :</strong> informations appareil, IP, user-agent, localisation approximative, flags, diagnostics d’erreur, journaux.
          </li>
          <li>
            <strong>Contenu :</strong> prompts, entrées, sorties générées et fichiers téléversés nécessaires à la prestation.
          </li>
          <li>
            <strong>Consentements &amp; préférences :</strong> versions légales acceptées, choix cookies, opt-in marketing, devise préférée.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">3. Finalités &amp; bases légales (RGPD)</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Fournir le Service :</strong> gestion de compte, wallet, jobs vidéo, support — base légale : contrat.
          </li>
          <li>
            <strong>Paiements &amp; prévention de la fraude :</strong> traitement des paiements, surveillance — bases : contrat, intérêt légitime, obligation légale.
          </li>
          <li>
            <strong>Analytics &amp; amélioration produit :</strong> mesure d’usage pour améliorer les fonctionnalités — bases : consentement pour les cookies non essentiels ; sinon intérêt légitime avec garanties.
          </li>
          <li>
            <strong>E-mails marketing :</strong> envoi d’actualités produit lorsque vous y consentez — base : consentement (retirable à tout moment).
          </li>
          <li>
            <strong>Conformité &amp; sécurité :</strong> obligations légales, archivage, réponse aux incidents — bases : obligation légale et intérêt légitime.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">4. Conservation</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Données de compte :</strong> conservées tant que le compte est actif, puis sauvegardes limitées.
          </li>
          <li>
            <strong>Reçus &amp; documents financiers :</strong> stockés selon les durées comptables légales.
          </li>
          <li>
            <strong>Logs &amp; télémétrie :</strong> conservés sur des fenêtres glissantes courtes sauf nécessité de sécurité ou d’enquête.
          </li>
          <li>Nous anonymisons ou supprimons les données lorsqu’elles ne sont plus nécessaires.</li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">5. Partage &amp; sous-traitants</h3>
        <p>Nous recourons à des prestataires de confiance :</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Stripe (paiements)</li>
          <li>Hébergement/CDN (ex. Vercel)</li>
          <li>Stockage objet (ex. AWS S3)</li>
          <li>Base de données &amp; authentification (Neon, Supabase)</li>
          <li>Fournisseurs d’inférence IA (ex. Fal.ai)</li>
          <li>Outils d’e-mail et de support</li>
        </ul>
        <p>
          Nous signons des accords de traitement avec chaque prestataire. La liste à jour est disponible sur{' '}
          <Link href="/legal/subprocessors" className="text-brand underline hover:text-brandHover">
            /legal/subprocessors
          </Link>
          .
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">6. Transferts internationaux</h3>
        <p>
          Si les données sortent de l’EEE/Royaume-Uni, nous utilisons des garanties appropriées (clauses contractuelles types) et des mesures complémentaires si nécessaire.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">7. Sécurité</h3>
        <p>
          Nous appliquons des mesures techniques et organisationnelles (chiffrement en transit, contrôle d’accès, principe du moindre privilège, monitoring, réponse aux incidents). Aucun système
          n’étant infaillible, nous recommandons des mots de passe forts et, lorsque disponible, la double authentification.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">8. Cookies &amp; technologies similaires</h3>
        <p>
          Nous utilisons des cookies essentiels pour faire fonctionner le site et, avec votre accord, des cookies d’analyse/publicité. Vous pouvez retirer votre consentement via la bannière ou les
          paramètres. Voir la{' '}
          <Link href="/legal/cookies" className="text-brand underline hover:text-brandHover">
            Politique cookies
          </Link>{' '}
          pour plus de détails.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">9. Vos droits (UE/EEE/R.-U.)</h3>
        <p>
          Selon la loi applicable, vous pouvez demander l’accès, la rectification, l’effacement, la limitation, l’opposition ou la portabilité. Vous pouvez retirer votre consentement à tout moment en
          écrivant à{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
          />
          . Vous pouvez introduire une plainte auprès de votre autorité locale (en France : CNIL).
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">10. Mineurs</h3>
        <p>Le Service ne s’adresse pas aux enfants de moins de 15/16 ans. Si vous pensez qu’un mineur nous a fourni des données sans consentement adéquat, contactez-nous pour les supprimer.</p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">11. Évolutions</h3>
        <p>
          Nous pouvons mettre à jour cette Politique. Les changements importants seront annoncés dans l’app ou par e-mail et pourront nécessiter un nouveau consentement. La version en vigueur et la
          date d’effet figurent ci-dessus.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">12. Contact</h3>
        <p>
          Question sur la confidentialité ? Écrivez à{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
          />
          .
        </p>
        <p className="text-sm text-text-muted">Dernière mise à jour : {effective ?? version}</p>
      </section>
    </article>
  );
}

function PrivacyArticleEs({ version, effective }: { version: string; effective: string | null }) {
  return (
    <article className="stack-gap-lg text-base leading-relaxed text-text-secondary">
      <p>
        Esta política explica cómo MaxVideoAI («nosotros») recopila, utiliza, comparte y protege tus datos personales cuando visitas maxvideoai.com, creas una cuenta, adquieres recargas o generas
        contenido con IA.
      </p>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">1. Alcance</h3>
        <p>
          Cubre el tratamiento de datos dentro del workspace de MaxVideoAI: gestión de cuentas, facturación, analíticas, generación de contenido y soporte.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">2. Datos que tratamos</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Cuenta e identidad:</strong> nombre, e-mail, hash de contraseña, país/región, idioma.
          </li>
          <li>
            <strong>Transacciones:</strong> operaciones del wallet, recargas, recibos (importe, divisa, impuestos, marcas de tiempo), IDs de trabajos.
          </li>
          <li>
            <strong>Pagos:</strong> procesados por Stripe; guardamos identificadores y metadatos mínimos, nunca números completos de tarjeta.
          </li>
          <li>
            <strong>Uso y telemetría:</strong> datos del dispositivo, IP, user-agent, ubicación aproximada, flags, diagnósticos de errores, logs.
          </li>
          <li>
            <strong>Contenido:</strong> prompts, entradas, salidas generadas y archivos subidos necesarios para prestar el Servicio.
          </li>
          <li>
            <strong>Consentimientos y preferencias:</strong> versiones legales aceptadas, opciones de cookies, opt-in de marketing, divisa preferida.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">3. Finalidades y bases legales (RGPD)</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Prestar el Servicio:</strong> gestión de cuentas, wallet, trabajos de vídeo, soporte — base legal: contrato.
          </li>
          <li>
            <strong>Pagos y prevención de fraude:</strong> procesamiento y monitorización — bases: contrato, interés legítimo, obligación legal.
          </li>
          <li>
            <strong>Analítica y mejora:</strong> medición de uso para mejorar funciones — bases: consentimiento para cookies no esenciales; de lo contrario, interés legítimo con salvaguardas.
          </li>
          <li>
            <strong>Emails de marketing:</strong> envío de novedades cuando aceptas recibirlas — base: consentimiento, revocable en cualquier momento.
          </li>
          <li>
            <strong>Cumplimiento y seguridad:</strong> registros, auditorías, respuesta a incidentes — bases: obligación legal e interés legítimo.
          </li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">4. Conservación</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Datos de cuenta:</strong> mientras el acceso esté activo, más un periodo limitado de respaldos.
          </li>
          <li>
            <strong>Recibos y registros financieros:</strong> guardados según los plazos que marque la normativa contable.
          </li>
          <li>
            <strong>Logs y telemetría:</strong> periodos cortos salvo que se necesiten para seguridad o investigaciones.
          </li>
          <li>Anonimizamos o borramos los datos cuando dejan de ser necesarios para las finalidades descritas.</li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">5. Compartición y subencargados</h3>
        <p>Trabajamos con proveedores de confianza:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Stripe (pagos)</li>
          <li>Hosting/CDN (p. ej. Vercel)</li>
          <li>Almacenamiento objeto (p. ej. AWS S3)</li>
          <li>Bases de datos y autenticación (Neon, Supabase)</li>
          <li>Proveedores de inferencia IA (p. ej. Fal.ai)</li>
          <li>Herramientas de e-mail y soporte</li>
        </ul>
        <p>
          Firmamos acuerdos de tratamiento con cada proveedor. Consulta la lista actualizada en{' '}
          <Link href="/legal/subprocessors" className="text-brand underline hover:text-brandHover">
            /legal/subprocessors
          </Link>
          .
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">6. Transferencias internacionales</h3>
        <p>
          Cuando los datos salen del EEE/Reino Unido, usamos garantías adecuadas como las Cláusulas Contractuales Tipo e implementamos medidas adicionales si es necesario.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">7. Seguridad</h3>
        <p>
          Aplicamos medidas técnicas y organizativas (cifrado en tránsito, controles de acceso, mínimo privilegio, monitorización, respuesta ante incidentes). Ningún método es infalible, así que
          recomendamos contraseñas robustas y, cuando exista, autenticación en dos pasos.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">8. Cookies y tecnologías similares</h3>
        <p>
          Usamos cookies esenciales para el funcionamiento y, con tu consentimiento, cookies de analítica o publicidad. Puedes retirar el consentimiento desde el banner o los ajustes. Consulta la{' '}
          <Link href="/legal/cookies" className="text-brand underline hover:text-brandHover">
            Política de cookies
          </Link>{' '}
          para más información.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">9. Tus derechos (UE/EEE/R.-U.)</h3>
        <p>
          Según la ley aplicable puedes ejercer acceso, rectificación, supresión, restricción, portabilidad u oposición. También puedes retirar tu consentimiento escribiendo a{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
          />
          . Puedes presentar reclamaciones ante tu autoridad local (por ejemplo, la AEPD o la CNIL).
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">10. Menores</h3>
        <p>El Servicio no está dirigido a menores de 15/16 años. Si crees que un menor nos facilitó datos sin el consentimiento adecuado, avísanos para eliminarlos.</p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">11. Cambios</h3>
        <p>
          Podemos actualizar esta Política. Cualquier cambio importante se comunicará en la app o por correo y puede requerir un nuevo consentimiento. La versión vigente y la fecha figuran arriba.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">12. Contacto</h3>
        <p>
          ¿Dudas sobre privacidad? Escribe a{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
          />
          .
        </p>
        <p className="text-sm text-text-muted">Última actualización: {effective ?? version}</p>
      </section>
    </article>
  );
}
