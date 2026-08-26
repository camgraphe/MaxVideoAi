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
        <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">{copy.eyebrow}</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <h2 className="text-3xl font-semibold leading-tight text-text-primary dark:text-white">{copy.title}</h2>
          <p className="text-sm leading-6 text-text-secondary dark:text-white/68">{copy.intro}</p>
        </div>
        <div className="mt-7 overflow-hidden rounded-[16px] border border-hairline bg-surface shadow-card dark:border-white/[0.14] dark:bg-white/[0.04]">
          <div className="border-b border-hairline bg-blue-50/70 px-5 py-4 dark:border-white/[0.1] dark:bg-blue-400/[0.07] sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">{copy.exampleLabel}</p>
            <p className="mt-2 max-w-[850px] text-base font-medium leading-7 text-text-primary dark:text-white">{copy.examplePrompt}</p>
          </div>
          <div className="grid gap-0 md:grid-cols-2">
            <article data-project-proposal="quality" className="border-b border-hairline p-5 dark:border-white/[0.1] md:border-b-0 md:border-r md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-micro text-blue-700 dark:text-blue-300">01 · {copy.qualityLabel}</p>
              <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/72">{copy.qualityBody}</p>
            </article>
            <article data-project-proposal="lower-cost" className="p-5 md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">02 · {copy.valueLabel}</p>
              <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/72">{copy.valueBody}</p>
            </article>
          </div>
          <p className="border-t border-hairline px-5 py-4 text-xs leading-5 text-text-secondary dark:border-white/[0.1] dark:text-white/62 sm:px-6">{copy.attemptsNote}</p>
        </div>

        {options.length ? (
          <div className="mt-5" data-price-references>
            <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end sm:gap-5">
              <h3 className="text-sm font-semibold text-text-primary dark:text-white">{copy.priceReferencesLabel}</h3>
              <p className="max-w-[650px] text-xs leading-5 text-text-secondary dark:text-white/62">{copy.priceReferencesBody}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {options.map((option) => (
                <Link
                  key={option.slot}
                  href={option.modelHref}
                  data-price-reference={option.slot}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-hairline bg-bg px-3 py-2 text-xs text-text-secondary transition-colors hover:border-text-primary hover:text-text-primary dark:border-white/[0.14] dark:bg-white/[0.03] dark:text-white/68 dark:hover:border-white/50 dark:hover:text-white"
                >
                  <span className="font-semibold text-text-primary dark:text-white">{option.name}</span>
                  <span>{option.scenarioLabel}</span>
                  <span className="font-semibold text-text-primary dark:text-white">{option.priceLabel}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.emptyBody}</p>
        )}
      </div>
    </section>
  );
}
