import { Film, ImageIcon, Mic2, type LucideIcon } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import {
  DEFAULT_EXAMPLE_COSTS,
  type ExampleCardConfig,
  type ExampleCostsContent,
} from '../_lib/pricingPageContent';

const EXAMPLE_CARD_VISUALS: Array<{ Icon: LucideIcon; accentClass: string; chartClass: string }> = [
  { Icon: Film, accentClass: 'bg-surface-3 text-text-secondary', chartClass: 'text-text-muted' },
  { Icon: ImageIcon, accentClass: 'bg-state-success/10 text-state-success', chartClass: 'text-state-success' },
  { Icon: Mic2, accentClass: 'bg-state-warning/10 text-state-warning', chartClass: 'text-state-warning' },
];

function MiniSparkline({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 122 42" className={`h-12 w-32 ${className}`}>
      <path
        d="M3 34 C16 22 24 20 34 26 C45 33 48 13 60 15 C72 17 74 25 85 18 C98 9 104 11 119 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}

type PricingExampleCostsSectionProps = {
  cards: ExampleCardConfig[];
  exampleCosts: ExampleCostsContent;
  locale: AppLocale;
};

export function PricingExampleCostsSection({
  cards,
  exampleCosts,
  locale,
}: PricingExampleCostsSectionProps) {
  return (
    <section aria-labelledby="example-costs" className="scroll-mt-28">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id="example-costs" className="text-2xl font-semibold text-text-primary">
            {exampleCosts.title ?? DEFAULT_EXAMPLE_COSTS[locale].title}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {exampleCosts.subtitle ?? DEFAULT_EXAMPLE_COSTS[locale].subtitle}
          </p>
        </div>
        <div className="hidden h-px w-28 bg-hairline sm:block" aria-hidden />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {cards.map((card, index) => {
          const visual = EXAMPLE_CARD_VISUALS[index % EXAMPLE_CARD_VISUALS.length];
          const Icon = visual.Icon;
          return (
            <article
              key={card.title}
              className={`rounded-[8px] border bg-white p-5 shadow-[0_18px_54px_rgba(33,49,78,0.06)] transition hover:-translate-y-1 hover:shadow-float dark:bg-white/[0.055] ${
                index === 1 ? 'border-[#356BE8]/70' : 'border-hairline'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-[8px] border border-hairline ${visual.accentClass}`}>
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{card.title}</h3>
                    <p className="mt-1 text-xs text-text-muted">
                      {card.duration} · {card.resolution} · {card.audio}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-semibold tracking-tight text-text-primary">{card.price ?? '—'}</p>
                  <p className="mt-2 inline-flex rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-text-secondary">
                    {card.engine}
                  </p>
                </div>
                <MiniSparkline className={visual.chartClass} />
              </div>
              {card.note ? (
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-text-muted">{card.note}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
