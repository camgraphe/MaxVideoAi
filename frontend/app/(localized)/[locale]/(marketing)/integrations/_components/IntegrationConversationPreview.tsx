import Image from 'next/image';
import { BadgeCheck, CircleDollarSign, Images } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { UIIcon } from '@/components/ui/UIIcon';
import type { McpClientId } from '../../mcp/_lib/mcp-page-types';

const MEDIA = {
  poster:
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/8729a3ad-aa8e-470d-85e5-558a5f897893.jpg',
  video:
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/4e4954fc-513a-4345-945c-41adba7ec26a.mp4',
} as const;

const MARKS = {
  claude: {
    light: '/brand/partners/anthropic/claude-mark-light.svg',
    dark: '/brand/partners/anthropic/claude-mark-dark.svg',
  },
  chatgpt: {
    light: '/brand/partners/openai/openai-mark-light.svg',
    dark: '/brand/partners/openai/openai-mark-dark.svg',
  },
  codex: {
    light: '/brand/partners/openai/openai-mark-light.svg',
    dark: '/brand/partners/openai/openai-mark-dark.svg',
  },
} as const;

const COPY: Record<
  AppLocale,
  {
    label: string;
    user: string;
    assistant: string;
    result: string;
    facts: string[];
  }
> = {
  en: {
    label: 'Workflow preview',
    user: 'Create the strongest version, then show me a credible lower-cost option.',
    assistant: 'Seedance leads the quality route. I can price H3 and LTX alternatives before you approve anything.',
    result: 'Rendered with MaxVideoAI · Saved to MaxVideoAI Library',
    facts: ['Current models', 'Exact quote', 'Private media'],
  },
  fr: {
    label: 'Aperçu du parcours',
    user: 'Prépare la meilleure version, puis une alternative crédible moins chère.',
    assistant: 'Seedance mène la route qualité. Je peux chiffrer H3 et LTX avant toute validation.',
    result: 'Généré avec MaxVideoAI · Enregistré dans la bibliothèque MaxVideoAI',
    facts: ['Modèles actuels', 'Devis exact', 'Médias privés'],
  },
  es: {
    label: 'Vista previa del flujo',
    user: 'Prepara la mejor versión y después una alternativa más económica creíble.',
    assistant: 'Seedance lidera la opción de calidad. Puedo calcular H3 y LTX antes de que apruebes nada.',
    result: 'Generado con MaxVideoAI · Guardado en la biblioteca MaxVideoAI',
    facts: ['Modelos actuales', 'Precio exacto', 'Medios privados'],
  },
};

function clientLabel(client: McpClientId): string {
  if (client === 'chatgpt') return 'ChatGPT';
  return client === 'claude' ? 'Claude' : 'Codex';
}

export function IntegrationConversationPreview({
  client,
  locale,
}: {
  client: McpClientId;
  locale: AppLocale;
}) {
  const copy = COPY[locale];
  const mark = MARKS[client];
  const icons = [BadgeCheck, CircleDollarSign, Images] as const;

  return (
    <figure className="overflow-hidden rounded-[20px] border border-hairline bg-surface p-4 shadow-float dark:border-white/[0.14] dark:bg-white/[0.05] sm:p-5">
      <figcaption className="flex items-center justify-between border-b border-hairline pb-4 dark:border-white/[0.1]">
        <span className="flex items-center gap-2.5 text-sm font-semibold text-text-primary dark:text-white">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[11px] border border-hairline bg-white dark:border-white/[0.14] dark:bg-neutral-900">
            <Image src={mark.light} alt="" aria-hidden="true" width={21} height={21} className="dark:hidden" />
            <Image src={mark.dark} alt="" aria-hidden="true" width={21} height={21} className="hidden dark:block" />
          </span>
          {clientLabel(client)}
        </span>
        <span className="rounded-full border border-hairline bg-bg px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:border-white/[0.12] dark:bg-black/20 dark:text-white/68">
          {copy.label}
        </span>
      </figcaption>

      <div className="space-y-3 py-4">
        <p className="ml-auto max-w-[88%] rounded-[16px_16px_5px_16px] bg-[image:var(--brand-gradient)] px-3.5 py-2.5 text-sm leading-5 text-on-brand">
          {copy.user}
        </p>
        <p className="max-w-[94%] rounded-[16px_16px_16px_5px] border border-hairline bg-bg px-3.5 py-2.5 text-sm leading-5 text-text-primary dark:border-white/[0.12] dark:bg-black/20 dark:text-white/90">
          {copy.assistant}
        </p>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-hairline bg-black dark:border-white/[0.14]">
        <video
          controls
          playsInline
          preload="metadata"
          poster={MEDIA.poster}
          className="aspect-video w-full object-cover"
          aria-label={copy.result}
        >
          <source src={MEDIA.video} type="video/mp4" />
        </video>
        <p className="bg-bg px-3 py-2 text-xs font-medium text-text-secondary dark:bg-neutral-950 dark:text-white/70">
          {copy.result}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {copy.facts.map((fact, index) => (
          <span key={fact} className="flex items-center justify-center gap-1.5 rounded-[9px] bg-bg px-2 py-2 text-center text-[11px] font-semibold text-text-secondary dark:bg-black/20 dark:text-white/68">
            <UIIcon icon={icons[index] ?? BadgeCheck} size={14} className="shrink-0 text-brand" />
            {fact}
          </span>
        ))}
      </div>
    </figure>
  );
}
