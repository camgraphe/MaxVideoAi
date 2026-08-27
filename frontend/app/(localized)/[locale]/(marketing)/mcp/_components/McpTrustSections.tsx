import Link from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import { getMcpDocsLink } from '@/lib/mcp-internal-links';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { McpCompatibilityEvidence } from '../_lib/mcp-compatibility';
import { formatMcpCheckpointDate } from '../_lib/mcp-compatibility';
import type { McpPageCopy } from '../_lib/mcp-page-types';
import { McpClientActions } from './McpClientActions';

export function McpTrustSections({
  compatibility,
  copy,
  locale,
  publication,
}: {
  compatibility: McpCompatibilityEvidence;
  copy: McpPageCopy;
  locale: AppLocale;
  publication: McpPublicationState;
}) {
  const checkpoint = formatMcpCheckpointDate(locale, compatibility.lastChecked);
  const docsLink = getMcpDocsLink(locale, 'hub', publication);
  return (
    <div className="border-b border-hairline bg-bg text-text-primary dark:border-white/[0.1] dark:bg-bg dark:text-white">
      <section className="container-page grid max-w-[1120px] gap-4 py-12 lg:grid-cols-2">
        <article className="rounded-[12px] border border-hairline bg-surface p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">{copy.trust.definition.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-text-primary dark:text-white">{copy.trust.definition.title}</h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.trust.definition.body}</p>
        </article>
        <article className="rounded-[12px] border border-hairline bg-surface p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-white">{copy.trust.availability.title}</h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">
            {publication.connectionAvailable ? copy.trust.availability.liveBody : copy.trust.availability.gatedBody}
          </p>
        </article>
      </section>

      <section className="border-y border-hairline bg-surface py-12 dark:border-white/[0.1] dark:bg-white/[0.025]">
        <div className="container-page max-w-[1120px]">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-white">{copy.trust.compatibility.title}</h2>
          <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-secondary dark:text-white/68">{copy.trust.compatibility.body}</p>
          <p className="mt-2 text-xs font-medium text-text-secondary dark:text-white/68">{copy.trust.compatibility.checkpointLabel}: {checkpoint}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {Object.values(compatibility.clients).flatMap((client) => client.hosts).map((host) => (
              <article key={host.id} className="rounded-[12px] border border-hairline bg-bg p-4 dark:border-white/[0.14] dark:bg-white/[0.04]">
                <h3 className="font-semibold text-text-primary dark:text-white">{host.hostLabel}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.trust.compatibility.statuses[host.id]}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page grid max-w-[1120px] gap-4 py-12 lg:grid-cols-2">
        <article className="rounded-[12px] border border-hairline bg-surface p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-white">{copy.trust.confirmation.title}</h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">
            {publication.showPaidGenerationClaim ? copy.trust.confirmation.liveBody : copy.trust.confirmation.gatedBody}
          </p>
          <ol className="mt-4 space-y-2 border-t border-hairline pt-4 dark:border-white/[0.12]">
            {copy.trust.confirmation.steps.map((step, index) => <li key={step} className="text-sm text-text-primary dark:text-white"><span className="mr-2 text-text-secondary dark:text-white/68">{index + 1}.</span>{step}</li>)}
          </ol>
        </article>
        <article className="rounded-[12px] border border-hairline bg-surface p-5 dark:border-white/[0.14] dark:bg-white/[0.04]">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-white">{copy.trust.controls.title}</h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.trust.controls.body}</p>
          <ul className="mt-4 space-y-2 border-t border-hairline pt-4 dark:border-white/[0.12]">
            {copy.trust.controls.items.map((item) => <li key={item} className="text-sm leading-6 text-text-secondary dark:text-white/68">• {item}</li>)}
          </ul>
        </article>
      </section>

      <section className="border-y border-hairline bg-surface py-12 dark:border-white/[0.1] dark:bg-white/[0.025]">
        <div className="container-page grid max-w-[1120px] gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary dark:text-white">{copy.trust.capabilities.title}</h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{copy.trust.capabilities.body}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {copy.trust.capabilities.items.map((item) => <li key={item} className="rounded-[12px] border border-hairline bg-bg p-4 text-sm leading-6 text-text-secondary dark:border-white/[0.14] dark:bg-white/[0.04] dark:text-white/68">{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="container-page max-w-[1120px] py-12">
        <h2 className="text-2xl font-semibold text-text-primary dark:text-white">{copy.trust.setup.title}</h2>
        <p className="mt-3 max-w-[780px] text-sm leading-6 text-text-secondary dark:text-white/68">{copy.trust.setup.body}</p>
        <div className="mt-5"><McpClientActions actions={copy.hero.actions} /></div>
      </section>

      <section className="border-t border-hairline bg-surface py-12 dark:border-white/[0.1] dark:bg-white/[0.025]">
        <div className="container-page max-w-[900px]">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-white">{copy.trust.faq.title}</h2>
          <div className="mt-5 space-y-3">
            {copy.trust.faq.items.map((item) => <details key={item.question} className="rounded-[12px] border border-hairline bg-bg p-4 dark:border-white/[0.14] dark:bg-white/[0.04]"><summary className="cursor-pointer font-semibold text-text-primary dark:text-white">{item.question}</summary><p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{item.answer}</p></details>)}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {docsLink ? <Link href={docsLink.href} className="inline-flex min-h-10 items-center border-b border-hairline text-sm font-semibold text-text-primary hover:border-text-primary dark:border-white/30 dark:text-white dark:hover:border-white">{docsLink.label} →</Link> : null}
            <Link href={copy.trust.support.href} className="inline-flex min-h-10 items-center border-b border-hairline text-sm font-semibold text-text-primary hover:border-text-primary dark:border-white/30 dark:text-white dark:hover:border-white">{copy.trust.support.label} →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
