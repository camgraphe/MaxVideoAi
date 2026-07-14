import Link from 'next/link';
import type { IntegrationPageCopy } from '../_lib/integration-copy';

export function IntegrationTroubleshootingSection({ copy }: { copy: IntegrationPageCopy }) {
  return (
    <section className="border-b border-hairline bg-surface py-12 text-text-primary dark:border-white/[0.1] dark:bg-white/[0.025] dark:text-white">
      <div className="container-page grid max-w-[1060px] gap-6 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted dark:text-white/55">{copy.troubleshooting.eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-text-primary dark:text-white">{copy.troubleshooting.title}</h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.troubleshooting.intro}</p>
          <div className="mt-5 space-y-3">
            {copy.troubleshooting.items.map((item) => <details key={item.question} className="rounded-[12px] border border-hairline bg-bg p-4 dark:border-white/[0.14] dark:bg-white/[0.04]"><summary className="cursor-pointer font-semibold text-text-primary dark:text-white">{item.question}</summary><p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{item.answer}</p></details>)}
          </div>
        </div>
        <aside className="h-fit rounded-[12px] border border-hairline bg-bg p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
          <h2 className="text-xl font-semibold text-text-primary dark:text-white">{copy.disconnect.title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.disconnect.body}</p>
          <ol className="mt-4 space-y-2 border-t border-hairline pt-4 dark:border-white/[0.12]">
            {copy.disconnect.steps.map((step, index) => <li key={step} className="text-sm leading-6 text-text-primary dark:text-white"><span className="mr-2 text-text-muted dark:text-white/50">{index + 1}.</span>{step}</li>)}
          </ol>
          <Link href={copy.support.href} className="mt-5 inline-flex min-h-10 items-center border-b border-hairline text-sm font-semibold text-text-primary hover:border-text-primary dark:border-white/30 dark:text-white dark:hover:border-white">{copy.support.label} →</Link>
        </aside>
      </div>
    </section>
  );
}
