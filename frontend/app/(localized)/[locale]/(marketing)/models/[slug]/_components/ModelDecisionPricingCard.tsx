import { ArrowRight, Clock3, Gauge, Speaker, UploadCloud, Zap } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';

import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
import type { ModelDecisionPricingScenario } from '../_lib/model-page-decision-pricing';

type ModelDecisionPricingCardProps = {
  pricing: ModelDecisionData['pricing'];
};

const SCENARIO_ICONS: Partial<Record<ModelDecisionPricingScenario['id'], typeof Zap>> = {
  '5s-480p': Zap,
  '8s-720p': UploadCloud,
  '10s-1080p': Gauge,
  '10s-1080p-audio': Speaker,
  'max-duration': Clock3,
};

export function ModelDecisionPricingCard({ pricing }: ModelDecisionPricingCardProps) {
  return (
    <section
      id="decision-pricing"
      className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_24px_70px_rgba(0,0,0,0.30)] sm:p-6 lg:p-7"
      aria-labelledby="decision-pricing-title"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 id="decision-pricing-title" className="!text-left text-2xl font-semibold text-[#071126] dark:text-white sm:text-[27px]">
              {pricing.title}
            </h2>
            <p className="text-sm leading-6 text-[#52627a] dark:text-white/60 sm:text-base">{pricing.subtitle}</p>
          </div>
          <Link
            href={pricing.cta.href}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-[#d8e0ec] bg-white px-5 py-2 text-sm font-semibold text-[#071126] shadow-[0_10px_28px_rgba(15,23,42,0.07)] transition hover:border-[#b8c6db] hover:bg-[#fbfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:border-white/12 dark:bg-white/[0.055] dark:text-white dark:hover:bg-white/[0.085]"
          >
            <span>{pricing.cta.label}</span>
            <UIIcon icon={ArrowRight} size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {pricing.scenarios.map((scenario) => {
            const featured = scenario.id === '10s-1080p';
            const Icon = SCENARIO_ICONS[scenario.id] ?? Gauge;
            return (
              <article
                key={scenario.id}
                className={[
                  'relative flex min-h-[116px] flex-col justify-between overflow-hidden rounded-xl border bg-white p-3.5 sm:p-4',
                  featured
                    ? 'border-[#93a3ba] shadow-[0_14px_36px_rgba(15,23,42,0.08)]'
                    : 'border-[#dce4f0] shadow-[0_8px_22px_rgba(15,23,42,0.035)]',
                  'dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none',
                  featured ? 'dark:border-white/35' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="!text-left text-sm font-semibold leading-snug text-[#41516c] dark:text-white/80 sm:text-base">{scenario.label}</h3>
                  <div
                    className={[
                      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10',
                      MODEL_PAGE_ICON_WRAP,
                    ].join(' ')}
                  >
                    <UIIcon icon={Icon} size={20} strokeWidth={1.9} className={MODEL_PAGE_ICON} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <p className="text-2xl font-semibold leading-none text-[#071126] dark:text-white sm:text-[27px]">{scenario.value}</p>
                    {scenario.badge ? (
                      <span className="rounded-full bg-[#071126] px-2.5 py-1 text-[0.68rem] font-semibold leading-none text-white shadow-sm dark:bg-white dark:text-[#071126] sm:px-3 sm:text-xs">
                        {scenario.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs font-medium leading-5 text-[#52627a] dark:text-white/60 sm:text-sm">{scenario.note}</p>
                </div>
              </article>
            );
          })}
        </div>

        <p className="text-center text-xs leading-5 text-[#52627a] dark:text-white/50">{pricing.footnote}</p>
      </div>
    </section>
  );
}
