import { Fragment } from 'react';
import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { formatMcpCheckpointDate } from '../_lib/mcp-compatibility';
import type { McpHostProof } from '../_lib/mcp-host-proof';
import type { McpFeaturedAnswerId, McpPageCopy } from '../_lib/mcp-page-types';
import { McpHostProofCard } from './McpHostProofCard';

type AnswerKey = keyof McpPageCopy['answers']['items'];

const LIVE_GATE: Record<AnswerKey, keyof McpPublicationState> = {
  references: 'showReferenceClaim',
  credits: 'connectionAvailable',
  library: 'connectionAvailable',
  disconnect: 'connectionAvailable',
};

const FEATURED_GRID_POSITION = [
  'order-1 xl:col-start-1 xl:row-start-1',
  'order-3 xl:col-start-1 xl:row-start-2',
  'order-4 xl:col-start-1 xl:row-start-3',
] as const;

export function McpAnswerPassagesSection({
  copy,
  hostProof = null,
  lastChecked,
  locale,
  publication,
}: {
  copy: McpPageCopy['answers'];
  hostProof?: McpHostProof | null;
  lastChecked: string;
  locale: AppLocale;
  publication: McpPublicationState;
}) {
  return (
    <section className="border-y border-hairline bg-surface py-12 dark:border-white/[0.1] dark:bg-white/[0.025]">
      <div className="container-page max-w-[1120px]">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">
          {copy.eyebrow}
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-text-primary dark:text-white">{copy.title}</h2>
            <a
              className="mt-3 inline-flex text-sm font-semibold text-text-primary underline decoration-hairline underline-offset-4 transition-colors hover:text-accent dark:text-white dark:hover:text-accent"
              href={copy.repositoryHref}
              rel="noreferrer"
              target="_blank"
            >
              {copy.repositoryLabel}
            </a>
          </div>
          <p className="text-xs font-medium text-text-secondary dark:text-white/68">
            {copy.updatedLabel}:{' '}
            <time dateTime={lastChecked}>{formatMcpCheckpointDate(locale, lastChecked)}</time>
          </p>
        </div>
        <div
          className="mt-7 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.92fr)] xl:gap-x-6"
          data-answer-with-evidence={hostProof?.host ?? 'none'}
        >
          {(Object.entries(copy.featured) as Array<[
            McpFeaturedAnswerId,
            McpPageCopy['answers']['featured'][McpFeaturedAnswerId],
          ]>).map(([key, item], index) => (
            <Fragment key={key}>
              <article
                data-answer-passage={key}
                className={`${FEATURED_GRID_POSITION[index]} rounded-[14px] border border-hairline bg-bg p-5 dark:border-white/[0.14] dark:bg-white/[0.04]`}
              >
                <p className="text-xs font-semibold tracking-micro text-text-muted dark:text-white/52">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-text-primary dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">{item.body}</p>
              </article>
              {index === 0 && hostProof ? (
                <aside
                  className="order-2 xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:sticky xl:top-24"
                  data-answer-evidence={hostProof.host}
                >
                  <McpHostProofCard proof={hostProof} />
                </aside>
              ) : null}
            </Fragment>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {(Object.entries(copy.items) as Array<[AnswerKey, McpPageCopy['answers']['items'][AnswerKey]]>).map(
            ([key, item]) => (
              <article
                key={key}
                data-answer-detail={key}
                className="rounded-[12px] border border-hairline bg-bg p-5 dark:border-white/[0.14] dark:bg-white/[0.04]"
              >
                <h3 className="text-lg font-semibold text-text-primary dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-text-secondary dark:text-white/68">
                  {publication[LIVE_GATE[key]] ? item.liveBody : item.gatedBody}
                </p>
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
