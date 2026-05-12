import { ArrowRight, BadgeDollarSign, CheckCircle2 } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';

import type { ModelDecisionData } from '../_lib/model-page-decision-data';

type ModelDecisionPricingCardProps = {
  pricing: ModelDecisionData['pricing'];
};

export function ModelDecisionPricingCard({ pricing }: ModelDecisionPricingCardProps) {
  return (
    <section
      id="decision-pricing"
      className="rounded-3xl border border-hairline bg-surface p-5 shadow-card sm:p-6 lg:p-7"
      aria-labelledby="decision-pricing-title"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-alt text-on-accent-alt">
              <UIIcon icon={BadgeDollarSign} size={20} strokeWidth={1.9} />
            </div>
            <h2 id="decision-pricing-title" className="text-2xl font-semibold text-text-primary sm:text-3xl">
              {pricing.title}
            </h2>
            <p className="text-sm leading-6 text-text-secondary sm:text-base">{pricing.subtitle}</p>
          </div>
          <Link
            href={pricing.cta.href}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-input bg-[#08172d] px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-[#102647] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <span>{pricing.cta.label}</span>
            <UIIcon icon={ArrowRight} size={16} />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {pricing.scenarios.map((scenario) => {
            const featured = scenario.id === '10s-1080p-audio';
            return (
              <article
                key={scenario.id}
                className={[
                  'flex min-h-[144px] flex-col justify-between rounded-2xl border p-4',
                  featured
                    ? 'border-[#08172d] bg-[#08172d] text-white shadow-card'
                    : 'border-hairline bg-surface-2 text-text-primary',
                ].join(' ')}
              >
                <div className="space-y-2">
                  <div
                    className={[
                      'inline-flex h-8 w-8 items-center justify-center rounded-full',
                      featured ? 'bg-white/14 text-white' : 'bg-surface text-text-secondary',
                    ].join(' ')}
                  >
                    <UIIcon icon={CheckCircle2} size={16} strokeWidth={2} />
                  </div>
                  <h3 className="text-sm font-semibold">{scenario.label}</h3>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-semibold">{scenario.value}</p>
                  <p className={featured ? 'text-xs font-medium text-white/75' : 'text-xs font-medium text-text-muted'}>
                    {scenario.note}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <p className="text-xs leading-5 text-text-muted">{pricing.footnote}</p>
      </div>
    </section>
  );
}
