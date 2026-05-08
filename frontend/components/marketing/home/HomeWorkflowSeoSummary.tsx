import { ImageIcon, Sparkles, Type, Video } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';
import type { WorkflowSeoSummaryCopy } from '@/components/marketing/home/home-redesign-types';

type WorkflowBasicsLocale = 'en' | 'fr' | 'es';

const WORKFLOW_BASICS_COPY: Record<
  WorkflowBasicsLocale,
  {
    title: string;
    paragraph: string;
    cards: Array<{ title: string; body: string }>;
  }
> = {
  en: {
    title: 'AI video generator basics',
    paragraph:
      'MaxVideoAI is a pay-as-you-go AI video generator for creating videos from text, images, or existing clips. Compare leading models, preview real examples, and see the cost before you generate.',
    cards: [
      { title: 'Text-to-video', body: 'Generate scenes from prompts.' },
      { title: 'Image-to-video', body: 'Animate a still image.' },
      { title: 'Video-to-video', body: 'Transform existing footage.' },
    ],
  },
  fr: {
    title: 'Bases du générateur de vidéos IA',
    paragraph:
      'MaxVideoAI est un générateur de vidéos IA à l’usage pour créer depuis du texte, des images ou des clips existants. Comparez les modèles, consultez des exemples réels et voyez le coût avant de générer.',
    cards: [
      { title: 'Texte-vers-vidéo', body: 'Générez des scènes depuis des prompts.' },
      { title: 'Image-vers-vidéo', body: 'Animez une image fixe.' },
      { title: 'Vidéo-vers-vidéo', body: 'Transformez une vidéo existante.' },
    ],
  },
  es: {
    title: 'Conceptos básicos del generador de video IA',
    paragraph:
      'MaxVideoAI es un generador de video IA de pago por uso para crear desde texto, imágenes o clips existentes. Compara modelos, revisa ejemplos reales y ve el coste antes de generar.',
    cards: [
      { title: 'Texto a video', body: 'Genera escenas desde prompts.' },
      { title: 'Imagen a video', body: 'Anima una imagen fija.' },
      { title: 'Video a video', body: 'Transforma metraje existente.' },
    ],
  },
};

function resolveWorkflowBasicsLocale(copy: WorkflowSeoSummaryCopy): WorkflowBasicsLocale {
  const text = [copy.heroParagraph, copy.definition?.title, copy.definition?.body, copy.generateWays?.title].filter(Boolean).join(' ').toLowerCase();

  if (text.includes('générateur') || text.includes('générez')) return 'fr';
  if (text.includes('generador') || text.includes('genera videos')) return 'es';
  return 'en';
}

export function WorkflowSeoSummary({ copy }: { copy: WorkflowSeoSummaryCopy }) {
  const workflowItems = copy.generateWays?.items ?? [];
  const hasDefinition = Boolean(copy.definition?.title || copy.definition?.body || copy.heroParagraph);
  const locale = resolveWorkflowBasicsLocale(copy);
  const basicsCopy = WORKFLOW_BASICS_COPY[locale];
  const cardIcons = [
    { icon: Type, className: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-200' },
    { icon: ImageIcon, className: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-200' },
    { icon: Video, className: 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-200' },
  ] as const;

  if (!hasDefinition && workflowItems.length === 0) return null;

  return (
    <section className="dark-section-neon border-y border-hairline bg-surface py-6 sm:py-8">
      <div className="container-page max-w-[1280px]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-8">
          <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 sm:grid-cols-[52px_minmax(0,1fr)] sm:items-start sm:gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-bg text-text-primary shadow-sm dark:bg-white/[0.04] dark:text-white/88 sm:h-12 sm:w-12">
              <UIIcon icon={Sparkles} size={20} strokeWidth={1.9} />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">{basicsCopy.title}</h2>
              <p className="mt-2 max-w-[620px] text-sm leading-6 text-text-secondary">{basicsCopy.paragraph}</p>
            </div>
          </div>
          {workflowItems.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {workflowItems.slice(0, 3).map((item, index) => {
                const summary = basicsCopy.cards[index] ?? { title: item.title.replace(/\s+AI$/i, ''), body: item.body };
                const iconConfig = cardIcons[index] ?? cardIcons[0];

                return (
                  <article key={item.title} className="min-w-0 rounded-[12px] border border-hairline bg-bg/85 p-2.5 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.45)] dark-neon-panel dark:bg-white/[0.035] sm:rounded-[14px] sm:p-3">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] sm:h-9 sm:w-9 ${iconConfig.className}`}>
                      <UIIcon icon={iconConfig.icon} size={18} strokeWidth={1.85} />
                    </span>
                    <h3 className="mt-2 break-words text-[11px] font-semibold leading-4 text-text-primary sm:mt-3 sm:text-sm sm:leading-5">{summary.title}</h3>
                    <p className="mt-1 text-[10px] leading-4 text-text-secondary sm:mt-1.5 sm:text-sm sm:leading-5">{summary.body}</p>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
