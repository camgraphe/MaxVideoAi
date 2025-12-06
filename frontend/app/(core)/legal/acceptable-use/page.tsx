import type { Metadata } from 'next';
import Link from 'next/link';
import { resolveLocale } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy',
  description: 'Rules that govern how MaxVideoAI may be used, including restrictions on abusive or illegal content.',
};

const HEADER_COPY: Record<AppLocale, { title: string; effective: string; companyLine: string; contactLabel: string }> = {
  en: {
    title: 'Acceptable Use Policy',
    effective: 'Effective date: 28 October 2025',
    companyLine: 'Company: MaxVideoAI',
    contactLabel: 'Contact:',
  },
  fr: {
    title: "Politique d’utilisation acceptable",
    effective: "Date d’entrée en vigueur : 28 octobre 2025",
    companyLine: 'Société : MaxVideoAI',
    contactLabel: 'Contact :',
  },
  es: {
    title: 'Política de uso aceptable',
    effective: 'Fecha de entrada en vigor: 28 de octubre de 2025',
    companyLine: 'Empresa: MaxVideoAI',
    contactLabel: 'Contacto:',
  },
};

type AupBodyProps = { locale: AppLocale };

function AupArticle({ locale }: AupBodyProps) {
  switch (locale) {
    case 'fr':
      return <AupArticleFr />;
    case 'es':
      return <AupArticleEs />;
    default:
      return <AupArticleEn />;
  }
}

export default async function AcceptableUsePage() {
  const locale = await resolveLocale();
  const header = HEADER_COPY[locale] ?? HEADER_COPY.en;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">{header.title}</h1>
        <p className="text-sm text-text-secondary">{header.effective}</p>
        <p className="text-sm text-text-secondary">{header.companyLine}</p>
        <p className="text-sm text-text-secondary">
          {header.contactLabel}{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
          />
        </p>
      </header>

      <AupArticle locale={locale} />
    </div>
  );
}

function AupArticleEn() {
  return (
    <article className="space-y-4 text-base leading-relaxed text-text-secondary">
      <p>
        This Acceptable Use Policy (“AUP”) explains how you may use the MaxVideoAI platform. It applies to all prompts, uploads, and outputs you generate or distribute through the Service. If you
        violate this AUP we may suspend or terminate your account and remove offending content.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Never submit or distribute:</h2>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Illegal content of any kind, including child sexual abuse material or extremist propaganda.</li>
          <li>Non-consensual intimate imagery, sexualised or exploitative depictions of minors, or deepfakes intended to harm a person’s reputation or privacy.</li>
          <li>Hate speech, harassment, stalking, doxxing, or encouragement of self-harm, suicide, or violence against individuals or groups.</li>
          <li>Content that infringes intellectual property or publicity rights, including unlicensed logos and copyrighted media.</li>
          <li>Malware, phishing content, or attempts to gain unauthorised access to systems or data.</li>
          <li>Content that facilitates fraud, scams, spyware, unlawful surveillance, or other criminal activity.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Respect privacy and consent</h2>
        <p>Do not impersonate real people, misuse personal data, or publish private information without permission. If your output depicts someone else, obtain their explicit consent before sharing it.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Platform safeguards</h2>
        <p>We may suspend prompts, jobs, or accounts to protect the service, comply with law, or investigate abuse. We may share relevant information with law enforcement when compelled or if harm is imminent.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Report abuse</h2>
        <p>
          If you believe content generated through MaxVideoAI breaches this policy or your rights, notify us via the{' '}
          <Link href="/legal/takedown" className="text-accent underline">
            Notice &amp; Takedown form
          </Link>{' '}
          or email{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
          />
          . We review reports promptly and take appropriate action.
        </p>
      </section>
    </article>
  );
}

function AupArticleFr() {
  return (
    <article className="space-y-4 text-base leading-relaxed text-text-secondary">
      <p>
        Cette Politique d’utilisation acceptable (« AUP ») précise comment vous pouvez utiliser la plateforme MaxVideoAI. Elle s’applique à tous les prompts, fichiers importés et sorties générées ou
        partagées via le Service. En cas de violation, nous pouvons suspendre ou fermer votre compte et supprimer le contenu en cause.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Ne soumettez ou ne diffusez jamais :</h2>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Tout contenu illégal, y compris les abus sexuels sur mineurs ou la propagande extrémiste.</li>
          <li>Des images intimes non consenties, des représentations sexualisées/exploitantes de mineurs ou des deepfakes visant à nuire à la réputation ou à la vie privée d’une personne.</li>
          <li>Discours haineux, harcèlement, traque, doxxing ou incitation à l’automutilation, au suicide ou à la violence.</li>
          <li>Contenu qui porte atteinte aux droits d’auteur, aux marques ou au droit à l’image (logos sans licence, médias protégés, etc.).</li>
          <li>Malwares, tentatives de phishing ou accès non autorisé à des systèmes ou données.</li>
          <li>Contenu facilitant fraude, escroquerie, spyware, surveillance illégale ou toute activité criminelle.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Respect de la vie privée et du consentement</h2>
        <p>
          N’usurpez pas l’identité d’une personne réelle, n’exploitez pas de données personnelles et ne publiez pas d’informations privées sans autorisation. Si votre rendu représente quelqu’un, obtenez son consentement explicite avant de le partager.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Mesures de protection</h2>
        <p>
          Nous pouvons suspendre des prompts, jobs ou comptes pour protéger le Service, respecter la loi ou enquêter sur un abus. Nous pouvons coopérer avec les autorités en cas d’injonction ou de risque grave.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Signaler un abus</h2>
        <p>
          Si vous estimez qu’un contenu généré via MaxVideoAI viole cette politique ou vos droits, signalez-le via le{' '}
          <Link href="/legal/takedown" className="text-accent underline">
            formulaire Notification &amp; retrait
          </Link>{' '}
          ou écrivez à{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
          />
          . Nous examinons chaque signalement et agissons rapidement.
        </p>
      </section>
    </article>
  );
}

function AupArticleEs() {
  return (
    <article className="space-y-4 text-base leading-relaxed text-text-secondary">
      <p>
        Esta Política de Uso Aceptable («PUA») explica cómo puedes utilizar la plataforma MaxVideoAI. Aplica a todos los prompts, cargas y salidas que generes o compartas mediante el Servicio. Si infringes
        esta política podremos suspender o cancelar tu cuenta y eliminar el contenido infractor.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Nunca envíes ni distribuyas:</h2>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Contenido ilegal de cualquier tipo, incluido material de abuso infantil o propaganda extremista.</li>
          <li>Imágenes íntimas sin consentimiento, representaciones sexualizadas/explotadoras de menores o deepfakes diseñados para dañar la reputación o privacidad de alguien.</li>
          <li>Discurso de odio, acoso, stalking, doxxing o incitación a la autolesión, al suicidio o a la violencia.</li>
          <li>Material que infrinja derechos de autor, marcas o derecho de imagen (logos sin licencia, obras protegidas, etc.).</li>
          <li>Malware, phishing o intentos de acceder sin permiso a sistemas o datos.</li>
          <li>Contenido que facilite fraudes, estafas, spyware, vigilancia ilegal u otras actividades delictivas.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Respeta la privacidad y el consentimiento</h2>
        <p>
          No suplantes a personas reales ni uses datos personales o información privada sin autorización. Si tu salida retrata a alguien, consigue su consentimiento explícito antes de publicarla.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Protecciones de la plataforma</h2>
        <p>
          Podemos suspender prompts, trabajos o cuentas para proteger el servicio, cumplir la ley o investigar abusos. Compartiremos información relevante con las autoridades si nos obligan o si existe un riesgo grave.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Reporta abusos</h2>
        <p>
          Si crees que un contenido generado con MaxVideoAI vulnera esta política o tus derechos, notifícanos mediante el{' '}
          <Link href="/legal/takedown" className="text-accent underline">
            formulario de Notificación y retirada
          </Link>{' '}
          o escribe a{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
          />
          . Revisamos cada informe y actuamos con rapidez.
        </p>
      </section>
    </article>
  );
}
