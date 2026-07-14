import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { formatMcpVerifiedDate } from '../_lib/mcp-compatibility';
import type { McpPageCopy } from '../_lib/mcp-page-types';

type AnswerKey = keyof McpPageCopy['answers']['items'];

const LIVE_GATE: Record<AnswerKey, keyof McpPublicationState> = {
  integration: 'connectionAvailable',
  price: 'showPaidGenerationClaim',
  references: 'showReferenceClaim',
  confirmation: 'showPaidGenerationClaim',
  disconnect: 'connectionAvailable',
};

export function McpAnswerPassagesSection({
  copy,
  lastVerified,
  locale,
  publication,
}: {
  copy: McpPageCopy['answers'];
  lastVerified: string;
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
          <h2 className="text-3xl font-semibold text-text-primary dark:text-white">{copy.title}</h2>
          <p className="text-xs font-medium text-text-secondary dark:text-white/68">
            {copy.updatedLabel}:{' '}
            <time dateTime={lastVerified}>{formatMcpVerifiedDate(locale, lastVerified)}</time>
          </p>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {(Object.entries(copy.items) as Array<[AnswerKey, McpPageCopy['answers']['items'][AnswerKey]]>).map(
            ([key, item]) => (
              <article
                key={key}
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
