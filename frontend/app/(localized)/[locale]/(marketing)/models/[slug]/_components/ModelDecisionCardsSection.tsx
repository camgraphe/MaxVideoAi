import { ArrowRight, GitCompareArrows, Lightbulb, RefreshCcw } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';

import type { ModelDecisionData } from '../_lib/model-page-decision-data';

const DECISION_CARD_ICONS = [GitCompareArrows, RefreshCcw, Lightbulb] as const;

type ModelDecisionCardsSectionProps = {
  cards: ModelDecisionData['decisionCards'];
};

export function ModelDecisionCardsSection({ cards }: ModelDecisionCardsSectionProps) {
  if (!cards.length) return null;

  return (
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Seedance decision paths">
      {cards.map((card, index) => {
        const Icon = DECISION_CARD_ICONS[index] ?? Lightbulb;
        return (
          <article key={card.title} className="flex min-h-[248px] flex-col justify-between rounded-3xl border border-hairline bg-surface p-5 shadow-card">
            <div className="space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-brand">
                <UIIcon icon={Icon} size={21} strokeWidth={1.9} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold leading-tight text-text-primary">{card.title}</h2>
                <p className="text-sm leading-6 text-text-secondary">{card.body}</p>
              </div>
            </div>
            <Link
              href={card.cta.href}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <span>{card.cta.label}</span>
              <UIIcon icon={ArrowRight} size={16} />
            </Link>
          </article>
        );
      })}
    </section>
  );
}
