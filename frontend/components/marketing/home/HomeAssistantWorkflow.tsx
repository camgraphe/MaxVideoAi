import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, CircleDollarSign, Images, Sparkles } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { ButtonLink } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';

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
    title: 'Let Claude, ChatGPT or Codex plan the video. Generate it with MaxVideoAI.',
    body: 'Describe the result once. Your assistant can develop the prompts and references, compare quality-first and lower-cost routes, budget the complete film, then ask before any credits are spent.',
    cta: 'Use MaxVideoAI with Claude, ChatGPT or Codex',
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    codex: 'Codex',
    prompt: 'I need a 60-second product film. Show me the best route and a credible lower-cost option.',
    answer: 'I’ll break it into shots, check live model capabilities and price both plans before we generate.',
    catalogLabel: 'Current catalog',
    facts: ['Live model advice', 'Exact price before generation', 'Results in your MaxVideoAI library'],
  },
  fr: {
    eyebrow: 'DE LA CONVERSATION AU RENDU',
    title: 'Laissez Claude, ChatGPT ou Codex préparer la vidéo. Générez-la avec MaxVideoAI.',
    body: 'Décrivez le résultat une seule fois. Votre assistant peut développer les prompts et références, comparer une approche qualité et des alternatives moins chères, budgéter le film complet puis demander votre accord avant toute dépense.',
    cta: 'Utiliser MaxVideoAI avec Claude, ChatGPT ou Codex',
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    codex: 'Codex',
    prompt: 'Je veux un film produit de 60 secondes. Propose le meilleur rendu et une alternative crédible moins chère.',
    answer: 'Je vais le découper en plans, vérifier les capacités actuelles des modèles et chiffrer les deux options avant de générer.',
    catalogLabel: 'Catalogue actuel',
    facts: ['Conseils selon les modèles actuels', 'Prix exact avant génération', 'Résultats dans votre bibliothèque MaxVideoAI'],
  },
  es: {
    eyebrow: 'DE LA CONVERSACIÓN AL RESULTADO',
    title: 'Deja que Claude, ChatGPT o Codex prepare el vídeo. Genéralo con MaxVideoAI.',
    body: 'Describe el resultado una vez. Tu asistente desarrolla prompts y referencias, compara una ruta de máxima calidad con alternativas más baratas, presupuesta la película y pide permiso antes de gastar créditos.',
    cta: 'Usar MaxVideoAI con Claude, ChatGPT o Codex',
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    codex: 'Codex',
    prompt: 'Necesito un vídeo de producto de 60 segundos. Dame la mejor ruta y una alternativa más económica creíble.',
    answer: 'Lo dividiré en planos, comprobaré las capacidades actuales y calcularé ambas opciones antes de generar.',
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
    <section className="dark-section-neon relative overflow-hidden border-b border-hairline bg-bg section">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_22%,rgba(59,130,246,0.13),transparent_32%),radial-gradient(circle_at_12%_80%,rgba(99,102,241,0.08),transparent_28%)] dark:bg-[radial-gradient(circle_at_82%_22%,rgba(96,165,250,0.16),transparent_34%)]" />
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

        <div className="relative rounded-[28px] border border-hairline bg-surface p-4 shadow-float dark:border-white/[0.14] dark:bg-white/[0.055] sm:p-6">
          <div className="flex items-center justify-between border-b border-hairline pb-4 dark:border-white/[0.1]">
            <span className="flex items-center gap-2 text-sm font-semibold text-text-primary dark:text-white">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-brand/10 text-brand"><UIIcon icon={Sparkles} size={18} /></span>
              MaxVideoAI
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {copy.catalogLabel}
            </span>
          </div>
          <div className="space-y-4 py-5">
            <div className="ml-auto max-w-[88%] rounded-[18px_18px_5px_18px] bg-[image:var(--brand-gradient)] px-4 py-3 text-sm leading-6 text-on-brand shadow-sm">{copy.prompt}</div>
            <div className="max-w-[92%] rounded-[18px_18px_18px_5px] border border-hairline bg-bg px-4 py-3 text-sm leading-6 text-text-primary dark:border-white/[0.12] dark:bg-black/20 dark:text-white/90">{copy.answer}</div>
          </div>
          <div className="grid gap-2 border-t border-hairline pt-4 dark:border-white/[0.1] sm:grid-cols-3">
            {copy.facts.map((fact, index) => {
              const icons = [BadgeCheck, CircleDollarSign, Images] as const;
              return (
                <div key={fact} className="flex items-center gap-2 rounded-[12px] bg-bg px-3 py-2.5 text-xs font-semibold leading-5 text-text-secondary dark:bg-black/20 dark:text-white/70">
                  <UIIcon icon={icons[index] ?? BadgeCheck} size={16} className="shrink-0 text-brand" />
                  {fact}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
