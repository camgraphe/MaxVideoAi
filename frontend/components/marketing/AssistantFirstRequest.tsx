import { CopyPromptButton } from '@/components/CopyPromptButton';
import type { AppLocale } from '@/i18n/locales';

type FirstRequestCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  prompt: string;
  copyLabel: string;
  copiedLabel: string;
  note: string;
  proofLabel: string;
};

const COPY: Record<AppLocale, FirstRequestCopy> = {
  en: {
    eyebrow: 'YOUR FIRST VIDEO',
    title: 'Start with the project already in your conversation.',
    intro: 'Once MaxVideoAI is connected, paste this request into the conversation where you are preparing your site, product or campaign.',
    prompt: 'Use the project we are working on to propose a short launch video with MaxVideoAI. Compare two suitable, currently available models, including their trade-offs and prices for the proposed settings. Ask me for any missing context or references. Wait for my choice, then my approval of the exact quote, before generating anything.',
    copyLabel: 'Copy my first request',
    copiedLabel: 'Request copied',
    note: 'Planning is free on MaxVideoAI. Generation uses your MaxVideoAI credits after you approve the exact price.',
    proofLabel: 'See a real result displayed in Claude',
  },
  fr: {
    eyebrow: 'VOTRE PREMIÈRE VIDÉO',
    title: 'Partez du projet déjà présent dans votre conversation.',
    intro: 'Une fois MaxVideoAI connecté, collez cette demande dans la discussion où vous préparez votre site, votre produit ou votre campagne.',
    prompt: 'À partir du projet que nous préparons ici, propose une courte vidéo de lancement avec MaxVideoAI. Compare deux modèles disponibles et adaptés, avec leurs compromis et les prix pour les réglages proposés. Demande-moi le contexte ou les références qui te manquent. Attends mon choix, puis mon accord sur le devis exact, avant toute génération.',
    copyLabel: 'Copier ma première demande',
    copiedLabel: 'Demande copiée',
    note: 'La préparation est gratuite sur MaxVideoAI. La génération utilise vos crédits MaxVideoAI après validation du prix exact.',
    proofLabel: 'Voir un résultat réel affiché dans Claude',
  },
  es: {
    eyebrow: 'TU PRIMER VÍDEO',
    title: 'Parte del proyecto que ya está en tu conversación.',
    intro: 'Una vez conectado MaxVideoAI, pega esta petición en la conversación donde preparas tu web, producto o campaña.',
    prompt: 'A partir del proyecto que estamos preparando, propón un vídeo corto de lanzamiento con MaxVideoAI. Compara dos modelos disponibles y adecuados, con sus ventajas, limitaciones y precios para los ajustes propuestos. Pídeme el contexto o las referencias que falten. Espera mi elección y después mi autorización del precio exacto antes de generar nada.',
    copyLabel: 'Copiar mi primera petición',
    copiedLabel: 'Petición copiada',
    note: 'La planificación es gratuita en MaxVideoAI. La generación utiliza tus créditos de MaxVideoAI cuando autorizas el precio exacto.',
    proofLabel: 'Ver un resultado real mostrado en Claude',
  },
};

export function AssistantFirstRequest({ locale, proofHref, prompt }: { locale: AppLocale; proofHref?: string; prompt?: string }) {
  const copy = COPY[locale];

  return (
    <section id="first-video" className="scroll-mt-24 border-b border-hairline bg-surface py-12">
      <div className="container-page grid max-w-[1120px] gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-micro text-brand">{copy.eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold text-text-primary">{copy.title}</h2>
          <p className="mt-4 text-base leading-7 text-text-secondary">{copy.intro}</p>
          {proofHref ? (
            <a href={proofHref} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {copy.proofLabel}<span aria-hidden="true">→</span>
            </a>
          ) : null}
        </div>
        <div className="rounded-2xl border border-hairline bg-bg p-5 sm:p-6" data-assistant-first-request>
          <p id="assistant-first-request-text" className="select-text text-base leading-7 text-text-primary">{prompt ?? copy.prompt}</p>
          <div className="mt-5">
            <CopyPromptButton
              promptElementId="assistant-first-request-text"
              copyLabel={copy.copyLabel}
              copiedLabel={copy.copiedLabel}
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-text-secondary">{copy.note}</p>
        </div>
      </div>
    </section>
  );
}
