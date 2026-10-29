import Image from 'next/image';
import NextLink from 'next/link';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { HomeAssistantStrip } from './HomeAssistantStrip';

const COPY = {
  en: {
    eyebrow: 'Create in conversation', title: 'An idea. A conversation. Your next creation.',
    body: 'Meet Milo, your creative partner in Studio. Describe an idea, add references, and let Milo prepare the prompts and tools for images, video and audio.',
    detail: 'Assistance and media generation have separate costs. Review the generation price before you confirm.',
    cta: 'Explore Studio', open: 'Open Studio', alt: 'MaxVideoAI Studio with a creative conversation, a product reference and a timeline',
  },
  fr: {
    eyebrow: 'Créer en conversation', title: 'Une idée. Une conversation. Votre prochaine création.',
    body: 'Découvrez Milo, votre partenaire créatif dans Studio. Décrivez une idée, ajoutez vos références : Milo prépare les prompts et les outils pour vos images, vidéos et créations audio.',
    detail: 'L’assistance et la génération de médias ont des coûts distincts. Vérifiez le prix de la génération avant de confirmer.',
    cta: 'Découvrir Studio', open: 'Ouvrir Studio', alt: 'Studio MaxVideoAI avec une conversation créative, une référence produit et une timeline',
  },
  es: {
    eyebrow: 'Crea conversando', title: 'Una idea. Una conversación. Tu próxima creación.',
    body: 'Descubre Milo, tu compañero creativo en Studio. Describe una idea, añade referencias y deja que Milo prepare los prompts y las herramientas para imágenes, vídeo y audio.',
    detail: 'La asistencia y la generación de medios tienen costes distintos. Revisa el precio de la generación antes de confirmar.',
    cta: 'Descubrir Studio', open: 'Abrir Studio', alt: 'Studio de MaxVideoAI con una conversación creativa, una referencia de producto y una línea de tiempo',
  },
};

export function HomeConversationSection({ locale, assistantHref }: { locale: AppLocale; assistantHref?: string }) {
  const copy = COPY[locale];
  const miloLink = { en: 'Just need a hand with your prompt? Meet Milo →', fr: 'Un coup de pouce pour votre prompt ? Découvrez Milo →', es: '¿Necesitas ayuda con tu prompt? Conoce a Milo →' }[locale];
  return (
    <section id="studio" className="home-conversation section border-b border-hairline bg-surface">
      <div className="container-page">
        <div className="editorial-split">
          <div>
            <p className="editorial-eyebrow">{copy.eyebrow}</p>
            <h2 className="editorial-heading">{copy.title}</h2>
            <p className="editorial-body">{copy.body}</p>
            <p className="home-conversation-detail">{copy.detail}</p>
            <div className="home-conversation-actions">
              <Link href={{ pathname: '/studio' }} prefetch={false} className="editorial-action" data-analytics-event="cta_click" data-analytics-cta-name="home_studio" data-analytics-cta-location="home_conversation">{copy.cta}<span aria-hidden>↗</span></Link>
              <NextLink href={`/api/studio/marketing-entry?lang=${locale}`} prefetch={false} className="home-studio-open" data-analytics-event="cta_click" data-analytics-cta-name="home_studio_open" data-analytics-cta-location="home_conversation">{copy.open}<span aria-hidden>→</span></NextLink>
            </div>
            <Link href="/ai-video-prompt-generator" locale={locale} prefetch={false} className="mt-5 inline-flex text-sm underline underline-offset-4" data-analytics-event="cta_click" data-analytics-cta-name="home_milo" data-analytics-cta-location="home_conversation">{miloLink}</Link>
          </div>
          <Link href={{ pathname: '/studio' }} prefetch={false} className="home-studio-preview" aria-label={copy.cta}>
            <Image src="/assets/studio/studio-milo-preview.webp" alt={copy.alt} width={1354} height={832} sizes="(max-width: 900px) 90vw, 720px" loading="lazy" />
          </Link>
        </div>
        {assistantHref ? <HomeAssistantStrip locale={locale} href={assistantHref} /> : null}
      </div>
    </section>
  );
}
