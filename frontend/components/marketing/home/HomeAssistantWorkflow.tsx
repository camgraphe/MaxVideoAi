import Image from 'next/image';
import Link from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import { ButtonLink } from '@/components/ui/Button';
import { AssistantJourney } from '@/components/marketing/AssistantJourney.client';
import { ASSISTANT_JOURNEY_COPY } from '@/components/marketing/assistant-journey-copy';

const COPY: Record<
  AppLocale,
  {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    claude: string;
    chatgpt: string;
    codex: string;
    prompt: string;
    answer: string;
    catalogLabel: string;
    facts: string[];
  }
> = {
  en: {
    eyebrow: 'FROM CONVERSATION TO RENDER',
    title: 'Create from the conversation.',
    body: 'Turn a project you are discussing with your assistant into a video. Review the proposal and price, approve the generation, then find the result in your MaxVideoAI library.',
    cta: 'Choose your assistant',
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    codex: 'Codex',
    prompt: 'Use the project we are working on to propose a short launch video. Compare two suitable models before I choose.',
    answer: 'I’ll use our brief, check current model capabilities and compare the cost and trade-offs. You choose the route and approve the exact quote before generation.',
    catalogLabel: 'Current catalog',
    facts: ['Live model advice', 'Exact price before generation', 'Results in your MaxVideoAI library'],
  },
  fr: {
    eyebrow: 'DE LA CONVERSATION AU RENDU',
    title: 'Créez depuis la conversation.',
    body: 'Transformez un projet discuté avec votre assistant en vidéo. Vérifiez sa proposition et le prix, validez la génération, puis retrouvez le résultat dans votre bibliothèque MaxVideoAI.',
    cta: 'Choisir mon assistant',
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    codex: 'Codex',
    prompt: 'À partir du projet que nous préparons, propose une courte vidéo de lancement. Compare deux modèles adaptés avant mon choix.',
    answer: 'Je vais reprendre notre brief, vérifier les capacités actuelles et comparer les coûts et compromis. Vous choisissez la proposition et validez le devis exact avant la génération.',
    catalogLabel: 'Catalogue actuel',
    facts: ['Conseils selon les modèles actuels', 'Prix exact avant génération', 'Résultats dans votre bibliothèque MaxVideoAI'],
  },
  es: {
    eyebrow: 'DE LA CONVERSACIÓN AL RESULTADO',
    title: 'Crea desde la conversación.',
    body: 'Convierte un proyecto que estás preparando con tu asistente en un video. Revisa la propuesta y el precio, autoriza la generación y encuentra el resultado en tu biblioteca de MaxVideoAI.',
    cta: 'Elegir mi asistente',
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    codex: 'Codex',
    prompt: 'A partir del proyecto que estamos preparando, propón un video corto de lanzamiento. Compara dos modelos adecuados antes de que elija.',
    answer: 'Usaré nuestro brief, comprobaré las capacidades actuales y compararé costos y ventajas. Tú eliges la propuesta y autorizas el precio exacto antes de generar.',
    catalogLabel: 'Catálogo actual',
    facts: ['Modelos y precios actuales', 'Precio exacto antes de generar', 'Resultados en tu biblioteca MaxVideoAI'],
  },
};

const MARKS = [
  { id: 'claude', light: '/brand/partners/anthropic/claude-mark-light.svg', dark: '/brand/partners/anthropic/claude-mark-dark.svg' },
  { id: 'chatgpt', light: '/brand/partners/openai/openai-mark-light.svg', dark: '/brand/partners/openai/openai-mark-dark.svg' },
  { id: 'codex', light: '/brand/partners/openai/openai-mark-light.svg', dark: '/brand/partners/openai/openai-mark-dark.svg' },
] as const;

export function HomeAssistantWorkflow({ locale, href }: { locale: AppLocale; href: string }) {
  const copy = COPY[locale];
  const labels = { claude: copy.claude, chatgpt: copy.chatgpt, codex: copy.codex };

  return (
    <section className="assistant-editorial dark-section-neon relative overflow-hidden border-b border-hairline bg-bg section">

      <div className="container-page relative grid max-w-[1280px] gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16">
        <div className="max-w-[590px]">
          <p className="text-xs font-semibold uppercase tracking-micro text-brand">{copy.eyebrow}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2" aria-label={`${copy.claude}, ${copy.chatgpt}, ${copy.codex}`}>
            {MARKS.map((mark) => (
              <span key={mark.id} className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline bg-surface px-3 text-sm font-semibold text-text-primary shadow-sm dark:border-white/[0.14] dark:bg-white/[0.05] dark:text-white">
                <Image src={mark.light} alt="" aria-hidden="true" width={21} height={21} className="h-[21px] w-[21px] dark:hidden" />
                <Image src={mark.dark} alt="" aria-hidden="true" width={21} height={21} className="hidden h-[21px] w-[21px] dark:block" />
                {labels[mark.id]}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs text-text-muted">OpenClaw · n8n · MCP</p>
          <h2 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-text-primary sm:text-5xl">{copy.title}</h2>
          <p className="mt-5 text-base leading-8 text-text-secondary sm:text-lg">{copy.body}</p>
          <ButtonLink
            href={href}
            linkComponent={Link}
            size="lg"
            className="mt-7"
            data-analytics-event="mcp_internal_link_click"
            data-analytics-cta-name="homepage_ai_video_plugin"
            data-analytics-cta-location="home_assistant_workflow"
            data-analytics-target-family="mcp"
          >
            {copy.cta}
            <span aria-hidden="true">→</span>
          </ButtonLink>
        </div>

        <AssistantJourney {...ASSISTANT_JOURNEY_COPY[locale]}/>
      </div>
    </section>
  );
}
