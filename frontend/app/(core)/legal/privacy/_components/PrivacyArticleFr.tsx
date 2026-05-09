import Link from 'next/link';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import type { PrivacyBodyProps } from './PrivacyArticle';

export function PrivacyArticleFr({
  version,
  effective,
  links,
}: {
  version: string;
  effective: string | null;
  links: PrivacyBodyProps['links'];
}) {
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
          <Link href={links.subprocessorsHref} className="text-brand underline hover:text-brandHover">
            {links.subprocessorsHref}
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
          <Link href={links.cookiesHref} className="text-brand underline hover:text-brandHover">
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
