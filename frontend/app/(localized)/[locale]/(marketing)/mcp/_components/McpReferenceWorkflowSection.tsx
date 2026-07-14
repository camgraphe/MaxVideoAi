import type { McpPageCopy } from '../_lib/mcp-page-types';

export function McpReferenceWorkflowSection({
  copy,
  showReferenceClaim,
}: {
  copy: McpPageCopy['references'];
  showReferenceClaim: boolean;
}) {
  return (
    <section className="border-b border-hairline bg-surface py-12 text-text-primary dark:border-white/[0.1] dark:bg-white/[0.025] dark:text-white">
      <div className="container-page max-w-[1120px]">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted dark:text-white/55">{copy.eyebrow}</p>
        <h2 className="mt-2 max-w-[760px] text-3xl font-semibold leading-tight text-text-primary dark:text-white">{copy.title}</h2>
        <p className="mt-3 max-w-[780px] text-base leading-7 text-text-secondary dark:text-white/70">{copy.intro}</p>
        <div className="mt-6 rounded-[12px] border border-hairline bg-bg p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
          <p className="text-sm leading-6 text-text-secondary dark:text-white/68">{copy.planningBody}</p>
          <p className="mt-3 text-sm font-medium leading-6 text-text-primary dark:text-white">
            {showReferenceClaim ? copy.liveBody : copy.gatedBody}
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {copy.steps.map((step, index) => (
            <article key={step.title} className="rounded-[12px] border border-hairline bg-bg p-4 text-text-primary dark:border-white/[0.14] dark:bg-white/[0.04] dark:text-white">
              <span className="text-xs font-semibold text-text-muted dark:text-white/50">0{index + 1}</span>
              <h3 className="mt-2 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
