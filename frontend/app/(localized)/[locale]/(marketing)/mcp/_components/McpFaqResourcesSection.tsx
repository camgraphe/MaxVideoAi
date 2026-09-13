import { Fragment } from 'react';
import Link from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import { getMcpDocsLink } from '@/lib/mcp-internal-links';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { formatMcpCheckpointDate } from '../_lib/mcp-compatibility';
import type { McpHostProof } from '../_lib/mcp-host-proof';
import type { McpFeaturedAnswerId, McpPageCopy } from '../_lib/mcp-page-types';
import type { McpProof } from '../_lib/mcp-proof';
import { McpClientActions } from './McpClientActions';
import { McpEvidenceSection } from './McpEvidenceSection';
import { McpHostProofCard } from './McpHostProofCard';

const FEATURED_GRID_POSITION = [
  'order-1 xl:col-start-1 xl:row-start-1',
  'order-3 xl:col-start-1 xl:row-start-2',
  'order-4 xl:col-start-1 xl:row-start-3',
] as const;

export function McpFaqResourcesSection({
  copy,
  generationProof = null,
  hostProof = null,
  lastChecked,
  locale,
  publication,
}: {
  copy: McpPageCopy;
  generationProof?: McpProof | null;
  hostProof?: McpHostProof | null;
  lastChecked: string;
  locale: AppLocale;
  publication: McpPublicationState;
}) {
  const docsLink = getMcpDocsLink(locale, 'hub', publication);
  const details = Object.entries(copy.answers.items) as Array<[
    keyof McpPageCopy['answers']['items'],
    McpPageCopy['answers']['items'][keyof McpPageCopy['answers']['items']],
  ]>;
  const faq = [
    copy.trust.faq.items[0],
    ...details.map(([key, item]) => ({
      question: item.title,
      answer: publication[key === 'references' ? 'showReferenceClaim' : 'connectionAvailable']
        ? item.liveBody
        : item.gatedBody,
    })),
  ];

  return (
    <section className="border-b border-hairline bg-bg py-12 text-text-primary dark:border-white/[0.1] dark:bg-bg dark:text-white">
      <div className="container-page max-w-[1120px]">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">{copy.answers.eyebrow}</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-3xl font-semibold text-text-primary dark:text-white">{copy.answers.title}</h2>
          <p className="text-xs font-medium text-text-secondary dark:text-white/68">{copy.answers.updatedLabel}: <time dateTime={lastChecked}>{formatMcpCheckpointDate(locale, lastChecked)}</time></p>
        </div>

        {generationProof ? <div className="mt-7"><McpEvidenceSection copy={copy.evidence} proof={generationProof} /></div> : null}

        <div className="mt-7 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.92fr)] xl:gap-x-6" data-answer-with-evidence={hostProof?.host ?? 'none'}>
          {(Object.entries(copy.answers.featured) as Array<[McpFeaturedAnswerId, McpPageCopy['answers']['featured'][McpFeaturedAnswerId]]>).map(([key, item], index) => (
            <Fragment key={key}>
              <details data-answer-passage={key} className={`${FEATURED_GRID_POSITION[index]} rounded-[14px] border border-hairline bg-surface p-5 dark:border-white/[0.14] dark:bg-white/[0.04]`} open={index === 0}>
                <summary className="cursor-pointer text-lg font-semibold text-text-primary dark:text-white">{item.title}</summary>
                <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{item.body}</p>
              </details>
              {index === 0 && hostProof ? (
                <aside className="order-2 xl:col-start-2 xl:row-span-3 xl:row-start-1" data-answer-evidence={hostProof.host}>
                  <McpHostProofCard proof={hostProof} />
                </aside>
              ) : null}
            </Fragment>
          ))}
        </div>

        <div className="mt-10 max-w-[900px]">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-white">{copy.trust.faq.title}</h2>
          <div className="mt-5 space-y-3">
            {faq.map((item) => (
              <details key={item.question} data-faq-item className="rounded-[12px] border border-hairline bg-surface p-4 dark:border-white/[0.14] dark:bg-white/[0.04]">
                <summary className="cursor-pointer font-semibold text-text-primary dark:text-white">{item.question}</summary>
                <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{item.answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <a href={copy.answers.repositoryHref} rel="noreferrer" target="_blank" className="inline-flex min-h-10 items-center border-b border-hairline text-sm font-semibold text-text-primary hover:border-text-primary dark:border-white/30 dark:text-white dark:hover:border-white">{copy.answers.repositoryLabel} →</a>
            {docsLink ? <Link href={docsLink.href} className="inline-flex min-h-10 items-center border-b border-hairline text-sm font-semibold text-text-primary hover:border-text-primary dark:border-white/30 dark:text-white dark:hover:border-white">{docsLink.label} →</Link> : null}
            <Link href={copy.trust.support.href} className="inline-flex min-h-10 items-center border-b border-hairline text-sm font-semibold text-text-primary hover:border-text-primary dark:border-white/30 dark:text-white dark:hover:border-white">{copy.trust.support.label} →</Link>
          </div>
        </div>

        <div className="mt-12 border-t border-hairline pt-8 dark:border-white/[0.1]">
          <h2 className="text-2xl font-semibold text-text-primary dark:text-white">{copy.trust.setup.title}</h2>
          <p className="mt-3 max-w-[780px] text-sm leading-6 text-text-secondary dark:text-white/68">{copy.trust.setup.body}</p>
          <div className="mt-5"><McpClientActions actions={copy.hero.actions} /></div>
        </div>
      </div>
    </section>
  );
}
