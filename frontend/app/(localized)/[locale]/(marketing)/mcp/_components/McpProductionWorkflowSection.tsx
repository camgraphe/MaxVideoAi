import Link from 'next/link';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { McpBudgetOption } from '../_lib/mcp-budget-options';
import type { McpPageCopy } from '../_lib/mcp-page-types';

export function McpProductionWorkflowSection({
  copy,
  options,
  publication,
}: {
  copy: McpPageCopy;
  options: McpBudgetOption[] | readonly McpBudgetOption[];
  publication: McpPublicationState;
}) {
  const steps = [
    {
      body: copy.references.intro,
      detail: publication.showReferenceClaim ? copy.references.liveBody : copy.references.gatedBody,
    },
    {
      body: copy.budget.intro,
      detail: publication.showPaidGenerationClaim ? copy.trust.confirmation.liveBody : copy.trust.confirmation.gatedBody,
    },
    {
      body: publication.connectionAvailable ? copy.answers.items.library.liveBody : copy.answers.items.library.gatedBody,
      detail: copy.trust.capabilities.items[3],
    },
  ] as const;

  return (
    <section id="how-it-works" className="scroll-mt-24 border-b border-hairline bg-surface py-12 text-text-primary dark:border-white/[0.1] dark:bg-white/[0.025] dark:text-white" aria-label={copy.workflow.ariaLabel}>
      <div className="container-page max-w-[1120px]">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">{copy.workflow.eyebrow}</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <h2 className="text-3xl font-semibold leading-tight text-text-primary dark:text-white">{copy.workflow.title}</h2>
          <p className="text-sm leading-6 text-text-secondary dark:text-white/68">{copy.workflow.intro}</p>
        </div>

        <ol className="mt-7 grid gap-4 lg:grid-cols-3">
          {copy.workflow.steps.map((title, index) => (
            <li key={title} data-production-step={index + 1} className="rounded-[14px] border border-hairline bg-bg p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface text-xs font-semibold text-text-secondary dark:border-white/[0.14] dark:bg-white/[0.06] dark:text-white/70">{index + 1}</span>
              <h3 className="mt-4 text-lg font-semibold text-text-primary dark:text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{steps[index]?.body}</p>
              <p className="mt-3 border-t border-hairline pt-3 text-xs leading-5 text-text-secondary dark:border-white/[0.1] dark:text-white/62">{steps[index]?.detail}</p>
            </li>
          ))}
        </ol>

        <details className="mt-5 rounded-[14px] border border-hairline bg-bg p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
          <summary className="cursor-pointer font-semibold text-text-primary dark:text-white">{copy.budget.exampleLabel}: {copy.budget.examplePrompt}</summary>
          <div className="mt-5 grid gap-4 border-t border-hairline pt-5 md:grid-cols-2 dark:border-white/[0.1]">
            <article>
              <h3 className="text-sm font-semibold text-text-primary dark:text-white">{copy.budget.qualityLabel}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.budget.qualityBody}</p>
            </article>
            <article>
              <h3 className="text-sm font-semibold text-text-primary dark:text-white">{copy.budget.valueLabel}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.budget.valueBody}</p>
            </article>
          </div>
          <p className="mt-4 text-xs leading-5 text-text-secondary dark:text-white/62">{copy.budget.attemptsNote}</p>
          <div className="mt-5 border-t border-hairline pt-4 dark:border-white/[0.1]">
            <h3 className="text-sm font-semibold text-text-primary dark:text-white">{copy.budget.priceReferencesLabel}</h3>
            <p className="mt-1 text-xs leading-5 text-text-secondary dark:text-white/62">{copy.budget.priceReferencesBody}</p>
            {options.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {options.map((option) => (
                  <Link key={option.slot} href={option.modelHref} data-price-reference={option.slot} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-hairline px-3 py-2 text-xs text-text-secondary transition-colors hover:border-text-primary hover:text-text-primary dark:border-white/[0.14] dark:text-white/68 dark:hover:border-white/50 dark:hover:text-white">
                    <span className="font-semibold text-text-primary dark:text-white">{option.name}</span>
                    <span>{option.scenarioLabel}</span>
                    <span className="font-semibold text-text-primary dark:text-white">{option.priceLabel}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.budget.emptyBody}</p>}
          </div>
        </details>
      </div>
    </section>
  );
}
