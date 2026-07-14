import type { McpPageCopy } from '../_lib/mcp-page-types';

export function McpWorkflowStrip({ copy }: { copy: McpPageCopy['workflow'] }) {
  return (
    <section className="border-b border-hairline bg-surface py-6 text-text-primary dark:border-white/[0.1] dark:bg-white/[0.025] dark:text-white" aria-label={copy.ariaLabel}>
      <ol className="container-page grid max-w-[1120px] gap-3 md:grid-cols-3">
        {copy.steps.map((step, index) => (
          <li key={step} data-workflow-step={index + 1} className="flex items-center gap-3 rounded-[12px] border border-hairline bg-bg px-4 py-3 text-sm font-semibold text-text-primary dark:border-white/[0.14] dark:bg-white/[0.04] dark:text-white">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-xs text-text-secondary dark:border-white/[0.14] dark:bg-white/[0.06] dark:text-white/70">
              {index + 1}
            </span>
            <span>{step}</span>
            {index < copy.steps.length - 1 ? <span className="ml-auto hidden text-text-muted dark:text-white/40 md:inline" aria-hidden="true">→</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
