import { ArrowRight, GitCompareArrows, Lightbulb, RefreshCcw } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';

import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_MUTED, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';

const DECISION_CARD_ICONS = [GitCompareArrows, RefreshCcw, Lightbulb] as const;

type ModelDecisionCardsSectionProps = {
  cards: ModelDecisionData['decisionCards'];
};

export function ModelDecisionCardsSection({ cards }: ModelDecisionCardsSectionProps) {
  if (!cards.length) return null;

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" aria-label="Seedance decision paths">
      {cards.map((card, index) => {
        const Icon = DECISION_CARD_ICONS[index] ?? Lightbulb;
        return (
          <article key={card.title} className="flex min-h-[218px] flex-col justify-between rounded-2xl border border-hairline bg-surface p-4 shadow-card sm:min-h-[248px] sm:rounded-3xl sm:p-5">
            <div className="space-y-3 sm:space-y-4">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl sm:h-11 sm:w-11 ${MODEL_PAGE_ICON_WRAP}`}>
                <UIIcon icon={Icon} size={20} strokeWidth={1.9} className={MODEL_PAGE_ICON} />
              </div>
              <div className="space-y-2">
                <h2 className="!text-left text-base font-semibold leading-tight text-text-primary sm:text-xl">{card.title}</h2>
                <p className="text-xs leading-5 text-text-secondary sm:text-sm sm:leading-6">{card.body}</p>
              </div>
            </div>
            <Link
              href={card.cta.href}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand transition hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:mt-5 sm:gap-2 sm:text-sm"
            >
              <span>{card.cta.label}</span>
              <UIIcon icon={ArrowRight} size={16} className={MODEL_PAGE_ICON_MUTED} />
            </Link>
          </article>
        );
      })}
    </section>
  );
}
