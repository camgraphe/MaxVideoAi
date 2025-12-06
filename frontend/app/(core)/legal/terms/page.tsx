import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalVersionBadge } from '@/components/legal/LegalVersionBadge';
import { formatLegalDate, getLegalDocument } from '@/lib/legal';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import type { AppLocale } from '@/i18n/locales';
import { resolveLocale } from '@/lib/i18n/server';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';

const TERMS_URL = `${SITE_BASE_URL}/legal/terms`;

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'MaxVideoAI Terms of Service governing access to the platform and AI-assisted video generation tools.',
  alternates: {
    canonical: TERMS_URL,
  },
};

const HEADER_COPY: Record<AppLocale, { title: string; versionLabel: string; effectiveLabel: string; companyLine: string; contactLabel: string }> = {
  en: {
    title: 'Terms of Service',
    versionLabel: 'Version',
    effectiveLabel: 'Effective date',
    companyLine: 'Company: MaxVideoAI (sole proprietorship in formation) · Governing law: France (Paris courts)',
    contactLabel: 'Contact:',
  },
  fr: {
    title: "Conditions d’utilisation",
    versionLabel: 'Version',
    effectiveLabel: "Date d’entrée en vigueur",
    companyLine: "Société : MaxVideoAI (entreprise individuelle en cours de constitution) · Droit applicable : France (tribunaux de Paris)",
    contactLabel: 'Contact :',
  },
  es: {
    title: 'Términos del servicio',
    versionLabel: 'Versión',
    effectiveLabel: 'Fecha de entrada en vigor',
    companyLine: 'Empresa: MaxVideoAI (empresa individual en constitución) · Ley aplicable: Francia (tribunales de París)',
    contactLabel: 'Contacto:',
  },
};

type TermsBodyProps = {
  locale: AppLocale;
  version: string;
  effective: string | null;
};

function TermsArticle({ locale, version, effective }: TermsBodyProps) {
  switch (locale) {
    case 'fr':
      return <TermsArticleFr version={version} effective={effective} />;
    case 'es':
      return <TermsArticleEs version={version} effective={effective} />;
    default:
      return <TermsArticleEn version={version} effective={effective} />;
  }
}

export default async function TermsPage() {
  const locale = await resolveLocale();
  const document = await getLegalDocument('terms');
  const version = document?.version ?? '2025-10-26';
  const effective = formatLegalDate(document?.publishedAt ?? `${version}T00:00:00Z`);
  const header = HEADER_COPY[locale] ?? HEADER_COPY.en;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">{header.title}</h2>
        <p className="text-sm text-text-secondary">
          {header.versionLabel}: {version} · {header.effectiveLabel}: {effective ?? version}
        </p>
        <p className="text-sm text-text-secondary">{header.companyLine}</p>
        <p className="text-sm text-text-secondary">
          {header.contactLabel}{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
            unstyled
            className="font-medium"
          />{' '}
          ·{' '}
          <ObfuscatedEmailLink
            user="support"
            domain="maxvideoai.com"
            label="support@maxvideoai.com"
            placeholder="support [at] maxvideoai.com"
            unstyled
            className="font-medium"
          />
        </p>
        <LegalVersionBadge docKey="terms" doc={document} />
      </header>
      <TermsArticle locale={locale} version={version} effective={effective ?? version} />
    </div>
  );
}

function TermsArticleEn({ version, effective }: { version: string; effective: string | null }) {
  return (
    <article className="space-y-6 text-base leading-relaxed text-text-secondary">
      <p>
        These Terms govern your access to and use of the MaxVideoAI workspace (the “Service”), including AI-assisted video creation, wallet
        top-ups, job management, and receipts. By creating an account or using the Service you agree to these Terms, the Privacy Policy, and
        the Cookie Policy.
      </p>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">1. Eligibility &amp; age</h3>
        <p>
          You must be at least <strong>15 years old</strong> (or the age of digital consent in your country, whichever is higher) to use the Service. If you
          use the Service on behalf of a business or organisation, you confirm that you have authority to bind that entity.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">2. Your account</h3>
        <p>
          Keep your credentials confidential and do not share them. You are responsible for all activity that happens under your account. We may
          suspend or terminate accounts that breach these Terms, misuse the Service, or break the law.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">3. Pricing, payments &amp; wallet</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Platform-only payments.</strong> Card payments are processed by Stripe to our own platform account. We do not facilitate split payouts.
          </li>
          <li>
            <strong>Wallet top-ups.</strong> You can add funds to your wallet. Balances and receipts show the currency displayed at checkout.
          </li>
          <li>
            <strong>Receipts.</strong> Receipts list the price paid (plus applicable taxes/discounts). We do not expose margins, platform fees, or take-rates.
          </li>
          <li>
            <strong>Taxes.</strong> Prices may be shown inclusive or exclusive of tax depending on your location. Applicable taxes are displayed at checkout and on receipts.
          </li>
          <li>
            <strong>Refunds.</strong> If we cannot deliver a job because of a technical failure on our side, we may refund the charge to the original payment method or credit your wallet, in line with consumer law.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">4. Currency</h3>
        <p>
          Charges may be in EUR or USD depending on your location or saved preference. Wallet balances and receipts reflect the charged currency. If
          your payment method is in a different currency, your bank may apply FX or additional fees.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">5. AI-assisted outputs</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>You are responsible for the prompts, inputs, and use of outputs. Do not submit illegal, infringing, or harmful content.</li>
          <li>Outputs are probabilistic, may contain artefacts, and can be inaccurate. Review and validate them before use.</li>
          <li>Do not use outputs to violate rights (privacy, publicity, IP) or applicable laws. Clearly disclose any synthetic media when required.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">6. User content &amp; generated media</h3>
        <p>
          You own your prompts, uploads, reference frames, captions, and other assets you provide to the Service. We may store, process, and display
          uploaded assets solely to deliver the requested text-to-video or image-to-video renders, route jobs, provide workspace features you enable
          (such as galleries or version history), and meet security obligations. We do not claim ownership of uploaded inputs.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Generated media licence.</strong> For every output created with MaxVideoAI, you grant us a worldwide, non-exclusive, royalty-free,
            transferable, and sublicensable licence to host, reproduce, index, display, and otherwise use that media to (a) operate the Service, (b)
            improve routing, safeguards, and underlying models, (c) run security and abuse investigations, and (d) showcase Examples galleries,
            template pages, case studies, or other marketing placements.
          </li>
          <li>
            <strong>Privacy controls.</strong> You can mark renders as private within your workspace to limit distribution. If a privacy toggle is not
            available for a specific feature, you may request delisting or deletion by emailing{' '}
            <ObfuscatedEmailLink
              user="support"
              domain="maxvideoai.com"
              label="support@maxvideoai.com"
              placeholder="support [at] maxvideoai.com"
              unstyled
              className="font-medium"
            />{' '}
            and we will honour reasonable requests unless legal obligations prevent removal.
          </li>
          <li>
            <strong>Uploads vs. generated content.</strong> Uploaded logos, footage, and other inputs remain your property; we only use them to fulfil the
            requested generation or diagnose quality issues. Generated media remains yours subject to the licence above, and you are responsible for any
            third-party rights contained in your inputs or outputs.
          </li>
          <li>
            <strong>Our IP.</strong> MaxVideoAI retains ownership of the platform, interfaces, pipelines, model improvements, safety systems, and other
            technology used to render or transform content. These Terms do not transfer any of that IP to you.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">7. Service IP</h3>
        <p>
          We and our licensors own the Service, including software, models, safety tooling, UI, documentation, and brand assets. Except for the limited
          rights granted in these Terms, no intellectual property rights in the Service transfer to you.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">8. Acceptable use</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>No reverse engineering, unauthorised access, or interference with the Service.</li>
          <li>No submission of unlawful, defamatory, hateful, or infringing content.</li>
          <li>No use of outputs for biometric identification, surveillance, or deceptive practices without required permissions and disclosures.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">9. Third-party services</h3>
        <p>
          We rely on trusted sub-processors to operate the Service, including Stripe (payments), hosting/CDN providers, object storage, databases, and AI
          inference partners. See the Privacy Policy and the /legal/subprocessors notice for details.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">10. Availability &amp; changes</h3>
        <p>
          We aim for high availability but cannot guarantee uninterrupted service. Features may change or be discontinued with reasonable notice where
          feasible.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">11. Warranties &amp; disclaimers</h3>
        <p>
          The Service is provided “as is” without warranties of merchantability, fitness for a particular purpose, or non-infringement. Outputs are
          generated by probabilistic systems and may be inaccurate. You use them at your own risk.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">12. Liability cap</h3>
        <p>
          To the extent permitted by law, our aggregate liability for any claim is limited to the fees you paid to us in the 12 months before the event
          giving rise to the claim. This section does not limit liability that cannot be excluded by law.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">13. Indemnity</h3>
        <p>You agree to indemnify and hold us harmless from claims arising from your content, your use of outputs, or any breach of these Terms.</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">14. Termination</h3>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access for breach, risk to the Service, or legal compliance reasons.
          Sections regarding intellectual property, disclaimers, liability, and indemnity survive termination.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">15. Governing law &amp; venue</h3>
        <p>
          These Terms are governed by French law. The courts of Paris have exclusive jurisdiction, subject to mandatory consumer protections in your
          country of residence.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">16. Consumer rights &amp; withdrawals</h3>
        <p>
          If you are a consumer in the EU/EEA/UK, you may have statutory rights, including withdrawal or conformity guarantees. Nothing in these Terms
          limits those rights.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">17. Changes &amp; re-consent</h3>
        <p>
          We may update these Terms. When material changes occur, we will notify you and may require you to accept the new version at your next login.
          The current version and effective date are shown above.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">18. Contact</h3>
        <p>
          Questions about these Terms?{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
          />
          .
        </p>
        <p className="text-sm text-text-muted">Last updated: {effective ?? version}</p>
      </section>
    </article>
  );
}

function TermsArticleFr({ version, effective }: { version: string; effective: string | null }) {
  return (
    <article className="space-y-6 text-base leading-relaxed text-text-secondary">
      <p>
        Les présentes Conditions régissent votre accès et votre utilisation de l’espace de travail MaxVideoAI (le « Service »), notamment la création de
        vidéos assistées par IA, les recharges de wallet, la gestion des jobs et les reçus. En créant un compte ou en utilisant le Service, vous acceptez
        ces Conditions ainsi que la Politique de confidentialité et la Politique cookies.
      </p>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">1. Éligibilité &amp; âge</h3>
        <p>
          Vous devez avoir au minimum <strong>15 ans</strong> (ou l’âge du consentement numérique dans votre pays, si plus élevé) pour utiliser le Service. Si vous agissez
          au nom d’une entreprise ou organisation, vous garantissez avoir le pouvoir de l’engager juridiquement.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">2. Votre compte</h3>
        <p>
          Gardez vos identifiants confidentiels et ne les partagez pas. Vous êtes responsable de toute activité réalisée via votre compte. Nous pouvons
          suspendre ou résilier un compte qui enfreint ces Conditions, détourne le Service ou viole la loi.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">3. Tarification, paiements &amp; wallet</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Paiements plateforme.</strong> Les paiements carte sont traités par Stripe vers notre compte plateforme. Nous ne proposons pas de reversements fractionnés.
          </li>
          <li>
            <strong>Crédit du wallet.</strong> Vous pouvez ajouter des fonds à votre wallet. Les soldes et reçus affichent la devise montrée au checkout.
          </li>
          <li>
            <strong>Reçus.</strong> Les reçus listent le montant payé (taxes ou remises incluses). Nous n’exposons ni marges ni frais internes.
          </li>
          <li>
            <strong>Taxes.</strong> Selon votre localisation, les prix peuvent s’afficher TTC ou HT. Les taxes applicables apparaissent au checkout et sur les reçus.
          </li>
          <li>
            <strong>Remboursements.</strong> Si nous ne pouvons livrer un job suite à une défaillance technique, nous pouvons recréditer la carte d’origine ou votre wallet, conformément au droit de la consommation.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">4. Devise</h3>
        <p>
          Les prélèvements peuvent être effectués en EUR ou USD selon votre localisation ou préférence enregistrée. Les soldes du wallet et les reçus reflètent la devise facturée. Si votre moyen de paiement est libellé dans une autre devise, votre banque peut appliquer des frais de change.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">5. Sorties assistées par IA</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>Vous êtes responsable des prompts, des contenus fournis et de l’usage des sorties. N’envoyez aucun contenu illégal, contrefaisant ou nocif.</li>
          <li>Les rendus sont probabilistes, peuvent contenir des artefacts ou être inexacts. Vérifiez-les avant toute utilisation.</li>
          <li>Ne diffusez pas de sorties qui violeraient des droits (vie privée, image, propriété intellectuelle) ou des lois. Mentionnez clairement tout média synthétique lorsque c’est requis.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">6. Contenus utilisateur &amp; médias générés</h3>
        <p>
          Vous conservez la propriété de vos prompts, uploads, références, légendes ou autres éléments fournis au Service. Nous pouvons stocker, traiter et afficher ces assets uniquement pour livrer le rendu demandé (texte-vers-vidéo ou image-vers-vidéo), router les jobs, fournir les fonctionnalités activées dans votre workspace et respecter nos obligations de sécurité. Nous ne revendiquons aucune propriété sur les uploads.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Licence sur les médias générés.</strong> Pour chaque sortie produite via MaxVideoAI, vous nous accordez une licence mondiale, non exclusive, gratuite, transférable et sous-licenciable pour héberger, reproduire, indexer, afficher et utiliser ces vidéos afin (a) d’exploiter le Service, (b) d’améliorer le routage, les protections et les modèles, (c) de mener des enquêtes sécurité/abus et (d) de présenter la galerie Examples, les pages modèles, études de cas ou supports marketing.
          </li>
          <li>
            <strong>Contrôles de confidentialité.</strong> Vous pouvez marquer un rendu comme privé afin de limiter sa diffusion. Si aucune option n’est disponible pour une fonctionnalité donnée, vous pouvez demander la désindexation ou la suppression par e-mail à{' '}
            <ObfuscatedEmailLink
              user="support"
              domain="maxvideoai.com"
              label="support@maxvideoai.com"
              placeholder="support [at] maxvideoai.com"
              unstyled
              className="font-medium"
            />{' '}
            ; nous honorerons votre demande sauf obligation légale contraire.
          </li>
          <li>
            <strong>Uploads vs. médias générés.</strong> Les logos, images ou vidéos importés restent votre propriété ; nous ne les utilisons que pour produire le rendu demandé ou diagnostiquer la qualité. Les rendus vous appartiennent sous réserve de la licence ci-dessus et vous êtes responsable des droits de tiers incorporés.
          </li>
          <li>
            <strong>Notre propriété intellectuelle.</strong> MaxVideoAI conserve la propriété de la plateforme, des interfaces, des pipelines, des améliorations techniques et des systèmes de sécurité. Aucune cession d’IP n’est accordée au-delà des droits limités prévus ici.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">7. Propriété du Service</h3>
        <p>
          Nous (ainsi que nos concédants) détenons le Service, y compris les logiciels, modèles, outils de sécurité, interfaces, documentations et marques. Hormis les droits expressément accordés, aucune propriété intellectuelle ne vous est transférée.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">8. Utilisation acceptable</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>Interdiction de rétro-ingénierie, d’accès non autorisé ou de perturbation du Service.</li>
          <li>Interdiction de contenu illégal, diffamatoire, haineux ou contrefaisant.</li>
          <li>Interdiction d’utiliser les sorties pour l’identification biométrique, la surveillance ou des pratiques trompeuses sans autorisations ni mentions requises.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">9. Services tiers</h3>
        <p>
          Nous nous appuyons sur des sous-traitants de confiance (Stripe pour les paiements, hébergeurs/CDN, stockage objet, bases de données, partenaires d’inférence IA). Consultez la Politique de confidentialité et la page /legal/subprocessors pour la liste détaillée.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">10. Disponibilité &amp; évolutions</h3>
        <p>
          Nous visons une haute disponibilité mais ne pouvons garantir l’absence d’interruptions. Les fonctionnalités peuvent évoluer ou être retirées avec un préavis raisonnable lorsque c’est possible.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">11. Garanties &amp; exclusions</h3>
        <p>
          Le Service est fourni « en l’état » sans garantie de qualité marchande, d’adéquation à un usage particulier ou d’absence de contrefaçon. Les sorties sont générées par des systèmes probabilistes et peuvent être inexactes. Vous les utilisez à vos risques.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">12. Limitation de responsabilité</h3>
        <p>
          Dans la limite permise par la loi, notre responsabilité cumulée est plafonnée aux montants que vous nous avez versés durant les 12 mois précédant l’événement à l’origine de la réclamation. Cette clause ne limite pas les responsabilités qui ne peuvent être exclues légalement.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">13. Indemnisation</h3>
        <p>
          Vous acceptez de nous indemniser contre toute réclamation liée à vos contenus, à l’usage des sorties ou à la violation des présentes Conditions.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">14. Résiliation</h3>
        <p>
          Vous pouvez arrêter d’utiliser le Service à tout moment. Nous pouvons suspendre ou couper l’accès en cas de violation, de risque pour le Service ou d’obligation légale. Les clauses relatives à la propriété intellectuelle, aux exclusions, à la responsabilité et à l’indemnisation survivent à la résiliation.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">15. Droit applicable &amp; juridiction</h3>
        <p>
          Les présentes Conditions sont régies par le droit français. Les tribunaux de Paris sont seuls compétents, sous réserve des protections impératives dont vous pourriez bénéficier dans votre pays de résidence.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">16. Droits consommateurs &amp; rétractation</h3>
        <p>
          Si vous êtes consommateur dans l’UE/EEE/Royaume-Uni, vous disposez de droits légaux (rétractation, conformité). Rien dans ces Conditions ne restreint ces droits.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">17. Modifications &amp; nouveau consentement</h3>
        <p>
          Nous pouvons mettre à jour ces Conditions. En cas de changement important, nous vous informerons et pourrons exiger une acceptation lors de votre prochaine connexion. La version et la date d’effet figurent ci-dessus.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">18. Contact</h3>
        <p>
          Questions sur ces Conditions ? Écrivez à{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
          />
          .
        </p>
        <p className="text-sm text-text-muted">Dernière mise à jour : {effective ?? version}</p>
      </section>
    </article>
  );
}

function TermsArticleEs({ version, effective }: { version: string; effective: string | null }) {
  return (
    <article className="space-y-6 text-base leading-relaxed text-text-secondary">
      <p>
        Estos Términos regulan tu acceso y uso del espacio de trabajo MaxVideoAI (el «Servicio»), incluidas las funciones de vídeo asistido por IA, las recargas del
        wallet, la gestión de trabajos y los recibos. Al crear una cuenta o usar el Servicio aceptas estos Términos, la Política de privacidad y la Política de cookies.
      </p>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">1. Elegibilidad y edad</h3>
        <p>
          Debes tener al menos <strong>15 años</strong> (o la edad de consentimiento digital en tu país, la que sea mayor) para usar el Servicio. Si actúas en nombre de una empresa
          u organización, declaras que tienes autoridad para vincularla.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">2. Tu cuenta</h3>
        <p>
          Mantén tus credenciales confidenciales y no las compartas. Eres responsable de toda actividad realizada con tu cuenta. Podemos suspender o cancelar cuentas
          que infrinjan estos Términos, hagan un uso indebido del Servicio o violen la ley.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">3. Precios, pagos y wallet</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Pagos gestionados por la plataforma.</strong> Los pagos con tarjeta se procesan mediante Stripe hacia nuestra propia cuenta. No gestionamos pagos divididos.
          </li>
          <li>
            <strong>Recargas del wallet.</strong> Puedes añadir fondos a tu wallet. Los saldos y recibos muestran la moneda indicada en el checkout.
          </li>
          <li>
            <strong>Recibos.</strong> Los recibos detallan el importe pagado (impuestos o descuentos incluidos). No mostramos márgenes ni comisiones internas.
          </li>
          <li>
            <strong>Impuestos.</strong> Según tu ubicación, los precios pueden mostrarse con o sin impuestos. Los tributos aplicables aparecen en el checkout y en los recibos.
          </li>
          <li>
            <strong>Reembolsos.</strong> Si no podemos completar un trabajo por un fallo técnico propio, podemos devolver el cobro al método original o acreditar tu wallet, de acuerdo con la normativa de consumo.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">4. Moneda</h3>
        <p>
          Los cargos pueden realizarse en EUR o USD según tu ubicación o preferencia guardada. Los saldos del wallet y los recibos reflejan la moneda cobrada. Si tu medio de pago usa otra moneda, tu banco puede aplicar comisiones o tipos de cambio.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">5. Resultados asistidos por IA</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>Eres responsable de los prompts, entradas y uso de las salidas. No envíes contenido ilegal, infractor o dañino.</li>
          <li>Las salidas son probabilísticas, pueden contener artefactos y ser imprecisas. Revísalas antes de utilizarlas.</li>
          <li>No emplees las salidas para vulnerar derechos (privacidad, imagen, PI) ni leyes. Indica claramente cualquier medio sintético cuando sea obligatorio.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">6. Contenido del usuario y medios generados</h3>
        <p>
          Conservas la propiedad de tus prompts, archivos cargados, referencias, subtítulos y demás activos que aportes al Servicio. Podemos almacenar, procesar y mostrar
          dichos activos únicamente para entregar el render solicitado (texto-a-video o imagen-a-video), encaminar trabajos, habilitar las funciones que hayas activado en
          tu espacio de trabajo y cumplir obligaciones de seguridad. No reclamamos la propiedad de los archivos cargados.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Licencia sobre los medios generados.</strong> Por cada salida creada con MaxVideoAI nos concedes una licencia mundial, no exclusiva, libre de regalías,
            transferible y sublicenciable para alojar, reproducir, indexar, mostrar y usar esos medios con el fin de (a) operar el Servicio, (b) mejorar el enrutamiento, las
            protecciones y los modelos, (c) realizar investigaciones de seguridad o abuso y (d) mostrar galerías de Ejemplos, páginas de plantillas, casos de uso u otras
            acciones de marketing.
          </li>
          <li>
            <strong>Controles de privacidad.</strong> Puedes marcar los renders como privados para limitar su difusión. Si no existe un control de privacidad para cierta
            función, puedes solicitar la desindexación o eliminación enviando un correo a{' '}
            <ObfuscatedEmailLink
              user="support"
              domain="maxvideoai.com"
              label="support@maxvideoai.com"
              placeholder="support [at] maxvideoai.com"
              unstyled
              className="font-medium"
            />
            ; atenderemos la solicitud salvo obligación legal en contrario.
          </li>
          <li>
            <strong>Cargas vs. contenido generado.</strong> Los logotipos, imágenes o vídeos que cargas siguen siendo tuyos; solo los usamos para producir el render o resolver
            incidencias. Las salidas también son tuyas, sujetas a la licencia anterior, y eres responsable de los derechos de terceros incluidos en tus entradas o salidas.
          </li>
          <li>
            <strong>Nuestra propiedad intelectual.</strong> MaxVideoAI mantiene la propiedad de la plataforma, las interfaces, los pipelines, las mejoras técnicas y los sistemas
            de seguridad. Estos Términos no te transfieren esos derechos.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">7. Propiedad del Servicio</h3>
        <p>
          Nosotros y nuestros licenciantes poseemos el Servicio, incluidos software, modelos, herramientas de seguridad, interfaz, documentación y marcas. Salvo los derechos
          limitados aquí otorgados, no se transfiere propiedad intelectual alguna.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">8. Uso aceptable</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>Prohibido el reverse engineering, el acceso no autorizado o interferir con el Servicio.</li>
          <li>Prohibido enviar contenido ilegal, difamatorio, de odio o que infrinja derechos.</li>
          <li>Prohibido usar las salidas para identificación biométrica, vigilancia o prácticas engañosas sin los permisos y avisos necesarios.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">9. Servicios de terceros</h3>
        <p>
          Dependemos de subencargados de confianza (Stripe para pagos, proveedores de hosting/CDN, almacenamiento, bases de datos, partners de inferencia). Consulta la
          Política de privacidad y /legal/subprocessors para ver la lista actualizada.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">10. Disponibilidad y cambios</h3>
        <p>
          Buscamos una alta disponibilidad pero no podemos garantizar un servicio ininterrumpido. Las funciones pueden cambiar o retirarse avisando con antelación cuando sea posible.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">11. Garantías y exenciones</h3>
        <p>
          El Servicio se ofrece “tal cual”, sin garantías de comerciabilidad, idoneidad para un propósito específico ni ausencia de infracción. Las salidas pueden ser inexactas;
          las usas bajo tu propio riesgo.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">12. Límite de responsabilidad</h3>
        <p>
          En la medida permitida por la ley, nuestra responsabilidad total se limita a los importes que nos pagaste en los 12 meses previos al evento que originó la reclamación.
          Esta cláusula no limita las responsabilidades que no puedan excluirse legalmente.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">13. Indemnización</h3>
        <p>Te comprometes a indemnizarnos frente a reclamaciones derivadas de tu contenido, de tu uso de las salidas o del incumplimiento de estos Términos.</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">14. Terminación</h3>
        <p>
          Puedes dejar de usar el Servicio en cualquier momento. Podemos suspender o terminar el acceso si hay incumplimientos, riesgos para el Servicio o exigencias legales. Las
          secciones relativas a propiedad intelectual, exenciones, responsabilidad e indemnización sobreviven a la terminación.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">15. Ley aplicable y jurisdicción</h3>
        <p>
          Estos Términos se rigen por la ley francesa. Los tribunales de París tienen jurisdicción exclusiva, sin perjuicio de las protecciones imperativas de tu país de residencia.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">16. Derechos del consumidor y desistimiento</h3>
        <p>
          Si eres consumidor en la UE/EEE/Reino Unido, puedes disponer de derechos legales (desistimiento, conformidad). Nada en estos Términos limita dichos derechos.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">17. Cambios y nuevo consentimiento</h3>
        <p>
          Podemos actualizar estos Términos. Cuando haya cambios sustanciales te lo notificaremos y podremos requerir que aceptes la nueva versión en tu siguiente inicio de sesión.
          La versión vigente y su fecha aparecen arriba.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">18. Contacto</h3>
        <p>
          ¿Dudas sobre estos Términos? Escribe a{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
          />
          .
        </p>
        <p className="text-sm text-text-muted">Última actualización: {effective ?? version}</p>
      </section>
    </article>
  );
}
