import Link from 'next/link';
import type { McpBudgetOption } from '../_lib/mcp-budget-options';
import type { McpPageCopy } from '../_lib/mcp-page-types';

export function McpBudgetShortlist({
  copy,
  options,
}: {
  copy: McpPageCopy['budget'];
  options: McpBudgetOption[] | readonly McpBudgetOption[];
}) {
  return (
    <section className="border-b border-hairline bg-bg py-12 text-text-primary dark:border-white/[0.1] dark:bg-bg dark:text-white">
      <div className="container-page max-w-[1120px]">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted dark:text-white/55">{copy.eyebrow}</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <h2 className="text-3xl font-semibold leading-tight text-text-primary dark:text-white">{copy.title}</h2>
          <p className="text-sm leading-6 text-text-secondary dark:text-white/68">{copy.intro}</p>
        </div>
        {options.length ? (
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {options.map((option, index) => (
              <article
                key={option.slot}
                data-budget-slot={option.slot}
                className={`rounded-[12px] border border-hairline p-4 shadow-card dark:border-white/[0.14] ${index < 2 ? 'bg-blue-50/70 dark:bg-blue-400/[0.07]' : 'bg-surface dark:bg-white/[0.04]'}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted dark:text-white/55">
                  {copy.slotLabels[option.slot]}
                </p>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-text-primary dark:text-white">{option.name}</h3>
                  <span className="shrink-0 text-lg font-semibold text-text-primary dark:text-white">{option.priceLabel}</span>
                </div>
                <p className="mt-2 text-sm text-text-secondary dark:text-white/68">{option.scenarioLabel}</p>
                <Link href={option.modelHref} className="mt-4 inline-flex min-h-9 items-center border-b border-hairline text-xs font-semibold text-text-primary hover:border-text-primary dark:border-white/30 dark:text-white dark:hover:border-white">
                  {copy.modelLinkLabel} <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-[12px] border border-hairline bg-surface p-5 text-text-primary dark:border-white/[0.14] dark:bg-white/[0.04] dark:text-white">
            <h3 className="font-semibold">{copy.emptyTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.emptyBody}</p>
          </div>
        )}
      </div>
    </section>
  );
}
