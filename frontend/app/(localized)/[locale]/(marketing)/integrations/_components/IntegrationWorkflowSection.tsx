import type { McpPublicationState } from '@/lib/mcp-publication';
import type { IntegrationPageCopy } from '../_lib/integration-copy';

export function IntegrationWorkflowSection({
  copy,
  publication,
}: {
  copy: IntegrationPageCopy;
  publication: McpPublicationState;
}) {
  const steps = publication.showPaidGenerationClaim ? copy.workflow.liveSteps : copy.workflow.previewSteps;
  return (
    <section className="border-b border-hairline bg-bg py-12 text-text-primary dark:border-white/[0.1] dark:bg-bg dark:text-white">
      <div className="container-page max-w-[1060px]">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted dark:text-white/55">{copy.workflow.eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold text-text-primary dark:text-white">{copy.workflow.title}</h2>
        <p className="mt-3 max-w-[780px] text-base leading-7 text-text-secondary dark:text-white/70">{copy.workflow.intro}</p>
        <ol className="mt-6 grid gap-3 md:grid-cols-2">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-[12px] border border-hairline bg-surface p-4 dark:border-white/[0.14] dark:bg-white/[0.04]">
              <span className="text-xs font-semibold text-text-muted dark:text-white/50">0{index + 1}</span>
              <h3 className="mt-2 font-semibold text-text-primary dark:text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{step.body}</p>
            </li>
          ))}
        </ol>
        <article className="mt-6 rounded-[12px] border border-hairline bg-surface p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
          <h2 className="text-xl font-semibold text-text-primary dark:text-white">{copy.references.title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.references.planningBody}</p>
          <p className="mt-3 text-sm font-medium leading-6 text-text-primary dark:text-white">{publication.showReferenceClaim ? copy.references.liveBody : copy.references.gatedBody}</p>
        </article>
      </div>
    </section>
  );
}
