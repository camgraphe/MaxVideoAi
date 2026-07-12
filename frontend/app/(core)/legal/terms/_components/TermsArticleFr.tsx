import Link from 'next/link';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';

export function TermsArticleFr({
  version,
  effective,
  subprocessorsHref,
}: {
  version: string;
  effective: string | null;
  subprocessorsHref: string;
}) {
  return (
    <article className="stack-gap-lg text-base leading-relaxed text-text-secondary">
      <p>
        Les présentes Conditions régissent votre accès et votre utilisation de l’espace de travail MaxVideoAI (le « Service »), notamment la création de
        vidéos assistées par IA, les recharges de wallet, la gestion des jobs et les reçus. En créant un compte ou en utilisant le Service, vous acceptez
        ces Conditions ainsi que la Politique de confidentialité et la Politique cookies.
      </p>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">1. Éligibilité &amp; âge</h3>
        <p>
          Vous devez avoir au minimum <strong>15 ans</strong> (ou l’âge du consentement numérique dans votre pays, si plus élevé) pour utiliser le Service. Si vous agissez
          au nom d’une entreprise ou organisation, vous garantissez avoir le pouvoir de l’engager juridiquement.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">2. Votre compte</h3>
        <p>
          Gardez vos identifiants confidentiels et ne les partagez pas. Vous êtes responsable de toute activité réalisée via votre compte. Nous pouvons
          suspendre ou résilier un compte qui enfreint ces Conditions, détourne le Service ou viole la loi.
        </p>
      </section>

      <section className="stack-gap-sm">
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

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">4. Devise</h3>
        <p>
          Les prélèvements peuvent être effectués en EUR ou USD selon votre localisation ou préférence enregistrée. Les soldes du wallet et les reçus reflètent la devise facturée. Si votre moyen de paiement est libellé dans une autre devise, votre banque peut appliquer des frais de change.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">5. Sorties assistées par IA</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>Vous êtes responsable des prompts, des contenus fournis et de l’usage des sorties. N’envoyez aucun contenu illégal, contrefaisant ou nocif.</li>
          <li>Les rendus sont probabilistes, peuvent contenir des artefacts ou être inexacts. Vérifiez-les avant toute utilisation.</li>
          <li>Ne diffusez pas de sorties qui violeraient des droits (vie privée, image, propriété intellectuelle) ou des lois. Mentionnez clairement tout média synthétique lorsque c’est requis.</li>
        </ul>
      </section>

      <section id="generated-media-rights" className="stack-gap-sm scroll-mt-[calc(var(--header-height)+24px)]">
        <h3 className="text-lg font-semibold text-text-primary">6. Contenus utilisateur &amp; médias générés</h3>
        <p>
          Vous conservez la propriété de vos prompts, uploads, références, légendes ou autres éléments fournis au Service. Nous pouvons stocker, traiter et afficher ces assets uniquement pour livrer le rendu demandé (texte-vers-vidéo ou image-vers-vidéo), router les jobs, fournir les fonctionnalités activées dans votre workspace et respecter nos obligations de sécurité. Nous ne revendiquons aucune propriété sur les uploads.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Utilisation commerciale.</strong> Les utilisateurs peuvent utiliser commercialement leurs générations, sous réserve des droits de
            tiers, des lois applicables et des éventuelles restrictions propres au modèle ou fournisseur utilisé.
          </li>
          <li>
            <strong>Licence sur les médias générés.</strong> Pour chaque sortie produite via MaxVideoAI, vous nous accordez une licence mondiale, non exclusive, gratuite, transférable et sous-licenciable pour héberger, reproduire, indexer, afficher et utiliser ces vidéos afin (a) d’exploiter le Service, (b) d’améliorer le routage, les protections et les modèles, (c) de mener des enquêtes sécurité/abus et (d) de présenter la galerie Examples, les pages modèles, études de cas ou supports marketing.
          </li>
          <li>
            <strong>Contrôles de confidentialité.</strong> Les nouveaux rendus sont privés par défaut. La publication publique, l’indexation site-wide et l’éventuelle inclusion dans le rollout Video SEO sont gérées par MaxVideoAI via un workflow interne de revue. Si vous souhaitez désindexer, retirer d’un moteur ou supprimer un rendu public, vous pouvez écrire à{' '}
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

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">7. Propriété du Service</h3>
        <p>
          Nous (ainsi que nos concédants) détenons le Service, y compris les logiciels, modèles, outils de sécurité, interfaces, documentations et marques. Hormis les droits expressément accordés, aucune propriété intellectuelle ne vous est transférée.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">8. Utilisation acceptable</h3>
        <ul className="ml-5 list-disc space-y-2">
          <li>Interdiction de rétro-ingénierie, d’accès non autorisé ou de perturbation du Service.</li>
          <li>Interdiction de contenu illégal, diffamatoire, haineux ou contrefaisant.</li>
          <li>Interdiction d’utiliser les sorties pour l’identification biométrique, la surveillance ou des pratiques trompeuses sans autorisations ni mentions requises.</li>
        </ul>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">9. Services tiers</h3>
        <p>
          Nous nous appuyons sur des sous-traitants de confiance (Stripe pour les paiements, hébergeurs/CDN, stockage objet, bases de données, partenaires d’inférence IA). Consultez la Politique de confidentialité et la{' '}
          <Link href={subprocessorsHref} className="text-brand underline hover:text-brandHover">
            liste détaillée des sous-traitants
          </Link>
          .
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">10. Disponibilité &amp; évolutions</h3>
        <p>
          Nous visons une haute disponibilité mais ne pouvons garantir l’absence d’interruptions. Les fonctionnalités peuvent évoluer ou être retirées avec un préavis raisonnable lorsque c’est possible.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">11. Garanties &amp; exclusions</h3>
        <p>
          Le Service est fourni « en l’état » sans garantie de qualité marchande, d’adéquation à un usage particulier ou d’absence de contrefaçon. Les sorties sont générées par des systèmes probabilistes et peuvent être inexactes. Vous les utilisez à vos risques.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">12. Limitation de responsabilité</h3>
        <p>
          Dans la limite permise par la loi, notre responsabilité cumulée est plafonnée aux montants que vous nous avez versés durant les 12 mois précédant l’événement à l’origine de la réclamation. Cette clause ne limite pas les responsabilités qui ne peuvent être exclues légalement.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">13. Indemnisation</h3>
        <p>
          Vous acceptez de nous indemniser contre toute réclamation liée à vos contenus, à l’usage des sorties ou à la violation des présentes Conditions.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">14. Résiliation</h3>
        <p>
          Vous pouvez arrêter d’utiliser le Service à tout moment. Nous pouvons suspendre ou couper l’accès en cas de violation, de risque pour le Service ou d’obligation légale. Les clauses relatives à la propriété intellectuelle, aux exclusions, à la responsabilité et à l’indemnisation survivent à la résiliation.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">15. Droit applicable &amp; juridiction</h3>
        <p>
          Les présentes Conditions sont régies par le droit français. Les tribunaux de Paris sont seuls compétents, sous réserve des protections impératives dont vous pourriez bénéficier dans votre pays de résidence.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">16. Droits consommateurs &amp; rétractation</h3>
        <p>
          Si vous êtes consommateur dans l’UE/EEE/Royaume-Uni, vous disposez de droits légaux (rétractation, conformité). Rien dans ces Conditions ne restreint ces droits.
        </p>
      </section>

      <section className="stack-gap-sm">
        <h3 className="text-lg font-semibold text-text-primary">17. Modifications &amp; nouveau consentement</h3>
        <p>
          Nous pouvons mettre à jour ces Conditions. En cas de changement important, nous vous informerons et pourrons exiger une acceptation lors de votre prochaine connexion. La version et la date d’effet figurent ci-dessus.
        </p>
      </section>

      <section className="stack-gap-sm">
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
