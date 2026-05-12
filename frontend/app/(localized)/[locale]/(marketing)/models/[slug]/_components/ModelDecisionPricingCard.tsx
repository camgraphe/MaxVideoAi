import { ArrowRight, Clock3, Gauge, Speaker, UploadCloud, Zap } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';

import type { ModelDecisionData } from '../_lib/model-page-decision-data';
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

const SCENARIO_ICON_STYLES: Partial<Record<ModelDecisionPricingScenario['id'], string>> = {
  '5s-480p': 'bg-[#e9f9ef] text-[#17b56b] dark:bg-emerald-400/10 dark:text-emerald-300',
  '8s-720p': 'bg-[#edf4ff] text-[#4275ff] dark:bg-blue-400/10 dark:text-blue-300',
  '10s-1080p': 'bg-[#f0e9ff] text-[#7c4dff] dark:bg-violet-400/10 dark:text-violet-300',
  '10s-1080p-audio': 'bg-[#e9f9ef] text-[#17b56b] dark:bg-emerald-400/10 dark:text-emerald-300',
  'max-duration': 'bg-[#fff1e8] text-[#f97316] dark:bg-orange-400/10 dark:text-orange-300',
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {pricing.scenarios.map((scenario) => {
            const featured = scenario.id === '10s-1080p';
            const Icon = SCENARIO_ICONS[scenario.id] ?? Gauge;
            return (
              <article
                key={scenario.id}
                className={[
                  'relative flex min-h-[116px] flex-col justify-between overflow-hidden rounded-xl border bg-white p-4',
                  featured
                    ? 'border-[#57d38c] shadow-[0_14px_36px_rgba(16,185,129,0.12)]'
                    : 'border-[#dce4f0] shadow-[0_8px_22px_rgba(15,23,42,0.035)]',
                  'dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none',
                  featured ? 'dark:border-emerald-300/45' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="!text-left text-base font-semibold text-[#41516c] dark:text-white/80">{scenario.label}</h3>
                  <div
                    className={[
                      'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      SCENARIO_ICON_STYLES[scenario.id] ?? 'bg-[#edf4ff] text-[#4275ff] dark:bg-blue-400/10 dark:text-blue-300',
                    ].join(' ')}
                  >
                    <UIIcon icon={Icon} size={21} strokeWidth={1.9} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="text-[27px] font-semibold leading-none text-[#071126] dark:text-white">{scenario.value}</p>
                    {scenario.badge ? (
                      <span className="rounded-full bg-[#efe7ff] px-3 py-1 text-xs font-semibold text-[#7c3cff] dark:bg-violet-300/14 dark:text-violet-200">
                        {scenario.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium text-[#52627a] dark:text-white/60">{scenario.note}</p>
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
