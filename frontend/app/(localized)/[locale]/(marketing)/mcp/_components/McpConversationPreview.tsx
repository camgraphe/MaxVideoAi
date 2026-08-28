import Image from 'next/image';
import { BadgeCheck, CircleDollarSign, Images, Sparkles } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { UIIcon } from '@/components/ui/UIIcon';

const COPY: Record<AppLocale, { label: string; user: string; assistant: string; actions: string[] }> = {
  en: {
    label: 'Example conversation',
    user: 'I need a 60-second film. Prioritize quality, but show me a credible lower-cost plan too.',
    assistant: 'I’ll turn the brief into shots, check the best current model for each one, then price both complete plans before you choose.',
    actions: ['Develop prompts & references', 'Compare full-film budgets', 'Approve the exact price'],
  },
  fr: {
    label: 'Exemple de conversation',
    user: 'Je veux un film de 60 secondes. Priorité à la qualité, avec aussi une alternative crédible moins chère.',
    assistant: 'Je vais le découper en plans, vérifier le meilleur modèle actuel pour chacun et chiffrer les deux films complets avant votre choix.',
    actions: ['Prompts et références', 'Budgets du film complet', 'Validation du prix exact'],
  },
  es: {
    label: 'Ejemplo de conversación',
    user: 'Necesito una película de 60 segundos. Prioriza la calidad y muestra también una opción más económica creíble.',
    assistant: 'La dividiré en planos, comprobaré el mejor modelo actual para cada uno y calcularé ambos proyectos antes de que elijas.',
    actions: ['Prompts y referencias', 'Presupuestos completos', 'Aprobación del precio exacto'],
  },
};

export function McpConversationPreview({ locale }: { locale: AppLocale }) {
  const copy = COPY[locale];
  const icons = [Images, CircleDollarSign, BadgeCheck] as const;
  return (
    <aside className="relative overflow-hidden rounded-[24px] border border-hairline bg-surface p-4 shadow-float dark:border-white/[0.14] dark:bg-white/[0.05] sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative flex items-center justify-between border-b border-hairline pb-4 dark:border-white/[0.1]">
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary dark:text-white">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-brand/10 text-brand"><UIIcon icon={Sparkles} size={18} /></span>
          {copy.label}
        </span>
        <div className="flex -space-x-1.5">
          {[
            ['/brand/partners/openai/openai-mark-light.svg', '/brand/partners/openai/openai-mark-dark.svg'],
            ['/brand/partners/anthropic/claude-mark-light.svg', '/brand/partners/anthropic/claude-mark-dark.svg'],
          ].map(([light, dark]) => (
            <span key={light} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white dark:border-white/[0.14] dark:bg-neutral-900">
              <Image src={light} alt="" aria-hidden="true" width={18} height={18} className="dark:hidden" />
              <Image src={dark} alt="" aria-hidden="true" width={18} height={18} className="hidden dark:block" />
            </span>
          ))}
        </div>
      </div>
      <div className="relative space-y-4 py-5">
        <p className="ml-auto max-w-[88%] rounded-[18px_18px_5px_18px] bg-[image:var(--brand-gradient)] px-4 py-3 text-sm leading-6 text-on-brand shadow-sm">{copy.user}</p>
        <p className="max-w-[94%] rounded-[18px_18px_18px_5px] border border-hairline bg-bg px-4 py-3 text-sm leading-6 text-text-primary dark:border-white/[0.12] dark:bg-black/20 dark:text-white/90">{copy.assistant}</p>
      </div>
      <div className="relative grid gap-2 border-t border-hairline pt-4 dark:border-white/[0.1]">
        {copy.actions.map((action, index) => (
          <div key={action} className="flex items-center gap-3 rounded-[11px] bg-bg px-3 py-2.5 text-xs font-semibold text-text-secondary dark:bg-black/20 dark:text-white/72">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-brand/10 text-brand"><UIIcon icon={icons[index] ?? BadgeCheck} size={15} /></span>
            {action}
          </div>
        ))}
      </div>
    </aside>
  );
}
