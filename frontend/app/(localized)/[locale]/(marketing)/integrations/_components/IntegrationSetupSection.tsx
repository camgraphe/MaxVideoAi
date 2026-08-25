import type { AppLocale } from '@/i18n/locales';
import type { McpCompatibilityClientEvidence } from '../../mcp/_lib/mcp-compatibility';
import { formatMcpCheckpointDate } from '../../mcp/_lib/mcp-compatibility';
import type { IntegrationPageCopy } from '../_lib/integration-copy';

export function IntegrationSetupSection({
  compatibility,
  copy,
  locale,
}: {
  compatibility: McpCompatibilityClientEvidence;
  copy: IntegrationPageCopy;
  locale: AppLocale;
}) {
  return (
    <section className="border-b border-hairline bg-surface py-12 text-text-primary dark:border-white/[0.1] dark:bg-white/[0.025] dark:text-white">
      <div className="container-page max-w-[1060px]">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">{copy.setup.eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold text-text-primary dark:text-white">{copy.setup.title}</h2>
        <p className="mt-3 max-w-[780px] text-base leading-7 text-text-secondary dark:text-white/70">{copy.setup.intro}</p>
        <div className="mt-6 space-y-6">
          {copy.setup.hostGuides.map((guide) => {
            const evidence = compatibility.hosts.find((host) => host.id === guide.hostId);
            if (!evidence) return null;
            return (
              <article key={guide.hostId} className="rounded-[12px] border border-hairline bg-bg p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
                <h3 className="text-xl font-semibold text-text-primary dark:text-white">{guide.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{guide.intro}</p>
                <div className="mt-4 border-y border-hairline py-3 dark:border-white/[0.12]">
                  <p className="text-sm font-semibold text-text-primary dark:text-white">{evidence.hostLabel}</p>
                  <p className="mt-1 text-xs text-text-secondary dark:text-white/68">{copy.compatibility.checkpointLabel}: {formatMcpCheckpointDate(locale, evidence.lastChecked)}</p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.compatibility.statuses[guide.hostId]}</p>
                </div>
                <ol className="mt-4 grid gap-3 md:grid-cols-3">
                  {guide.steps.map((step, index) => (
                    <li key={step.title} className="rounded-[12px] border border-hairline bg-surface p-4 dark:border-white/[0.14] dark:bg-white/[0.04]">
                      <span className="text-xs font-semibold text-text-secondary dark:text-white/68">0{index + 1}</span>
                      <h4 className="mt-2 font-semibold text-text-primary dark:text-white">{step.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{step.body}</p>
                    </li>
                  ))}
                </ol>
                {guide.setupValues.length > 0 ? (
                  <dl className="mt-4 space-y-3">
                    {guide.setupValues.map((item) => (
                      <div key={item.label}>
                        <dt className="text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">{item.label}</dt>
                        <dd className="mt-2 overflow-x-auto rounded-[8px] border border-hairline bg-surface p-3 text-xs text-text-primary dark:border-white/[0.14] dark:bg-black/25 dark:text-white">
                          <code className="select-all">{item.value}</code>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {guide.commands.length > 0 ? (
                  <div className="mt-4">
                    {guide.commandLabel ? <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">{guide.commandLabel}</p> : null}
                    <div className="mt-3 space-y-2">
                      {guide.commands.map((command) => <pre key={command} className="overflow-x-auto rounded-[8px] border border-hairline bg-surface p-3 text-xs text-text-primary dark:border-white/[0.14] dark:bg-black/25 dark:text-white"><code>{command}</code></pre>)}
                    </div>
                  </div>
                ) : null}
                {guide.authTrigger ? <p className="mt-3 text-sm font-medium leading-6 text-text-primary dark:text-white">{guide.authTrigger}</p> : null}
                <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{guide.limitation}</p>
              </article>
            );
          })}
        </div>
        <div className="mt-6 rounded-[12px] border border-hairline bg-bg p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
          <h3 className="text-xl font-semibold text-text-primary dark:text-white">{copy.setup.oauthTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.setup.oauthBody}</p>
          <ol className="mt-4 space-y-2 border-t border-hairline pt-4 dark:border-white/[0.12]">
            {copy.setup.oauthSteps.map((step, index) => <li key={step} className="text-sm text-text-primary dark:text-white"><span className="mr-2 text-text-secondary dark:text-white/68">{index + 1}.</span>{step}</li>)}
          </ol>
        </div>
      </div>
    </section>
  );
}
