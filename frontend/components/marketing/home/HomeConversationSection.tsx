import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { HomeAssistantStrip } from './HomeAssistantStrip';

const COPY = {
  en: {
    eyebrow: 'Create in conversation', title: 'An idea. A conversation. Your next creation.',
    body: 'Meet Studio, your creative space in MaxVideoAI. Describe an idea, add references, and shape images, video and audio with an assistant by your side.',
    detail: 'Review the generation price before you confirm. Keep your references and creations together as your project takes shape.',
    cta: 'Explore Studio', alt: 'MaxVideoAI Studio with a creative conversation, three image references and a timeline',
  },
  fr: {
    eyebrow: 'Créer en conversation', title: 'Une idée. Une conversation. Votre prochaine création.',
    body: 'Découvrez Studio, votre espace créatif dans MaxVideoAI. Décrivez une idée, ajoutez vos références et créez des images, des vidéos et de l’audio avec un assistant à vos côtés.',
    detail: 'Vérifiez le prix de la génération avant de confirmer. Gardez vos références et vos créations au même endroit pour faire avancer votre projet.',
    cta: 'Découvrir Studio', alt: 'Studio MaxVideoAI avec une conversation créative, trois images de référence et une timeline',
  },
  es: {
    eyebrow: 'Crea conversando', title: 'Una idea. Una conversación. Tu próxima creación.',
    body: 'Descubre Studio, tu espacio creativo en MaxVideoAI. Describe una idea, añade referencias y crea imágenes, video y audio con un asistente a tu lado.',
    detail: 'Revisa el precio de la generación antes de confirmar. Mantén tus referencias y creaciones juntas mientras tu proyecto toma forma.',
    cta: 'Descubrir Studio', alt: 'Studio de MaxVideoAI con una conversación creativa, tres imágenes de referencia y una línea de tiempo',
  },
};

export function HomeConversationSection({ locale, assistantHref }: { locale: AppLocale; assistantHref?: string }) {
  const copy = COPY[locale];
  return (
    <section id="studio" className="home-conversation section border-b border-hairline bg-surface">
      <div className="container-page">
        <div className="editorial-split">
          <div>
            <p className="editorial-eyebrow">{copy.eyebrow}</p>
            <h2 className="editorial-heading">{copy.title}</h2>
            <p className="editorial-body">{copy.body}</p>
            <p className="home-conversation-detail">{copy.detail}</p>
            <Link href={{ pathname: '/studio' }} prefetch={false} className="editorial-action" data-analytics-event="cta_click" data-analytics-cta-name="home_studio" data-analytics-cta-location="home_conversation">{copy.cta}<span aria-hidden>↗</span></Link>
          </div>
          <Link href={{ pathname: '/studio' }} prefetch={false} className="home-studio-preview" aria-label={copy.cta}>
            <Image src="/assets/studio/studio-conversation-preview.webp" alt={copy.alt} width={1354} height={832} sizes="(max-width: 900px) 90vw, 720px" loading="lazy" />
          </Link>
        </div>
        {assistantHref ? <HomeAssistantStrip locale={locale} href={assistantHref} /> : null}
      </div>
    </section>
  );
}
