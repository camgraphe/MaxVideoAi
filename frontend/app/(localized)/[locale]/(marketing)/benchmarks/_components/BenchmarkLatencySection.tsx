import { Clock3 } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import type { BenchmarkCopy } from '../_lib/benchmark-copy';
import type { BenchmarkPageData, BenchmarkScoreRow } from '../_lib/benchmark-page-data';

type BenchmarkLatencySectionProps = {
  copy: BenchmarkCopy;
  latency: BenchmarkPageData['latency'];
  locale: AppLocale;
  scores: BenchmarkScoreRow[];
};

function formatDuration(milliseconds: number, locale: AppLocale): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const number = new Intl.NumberFormat(localeRegions[locale]);
  return minutes ? `${number.format(minutes)}m ${number.format(seconds)}s` : `${number.format(seconds)}s`;
}

function formatDate(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(localeRegions[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function BenchmarkLatencySection({ copy, latency, locale, scores }: BenchmarkLatencySectionProps) {
  const scoresBySlug = new Map(scores.map((score) => [score.modelSlug, score]));
  const rows = latency.rows.flatMap((row) => {
    const score = scoresBySlug.get(row.modelSlug);
    return score ? [{ row, score }] : [];
  });

  return (
    <div>
      <div className="flex max-w-3xl items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-hairline bg-surface text-brand shadow-sm">
          <UIIcon icon={Clock3} size={20} />
        </span>
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-text-primary sm:text-4xl">{copy.latency.title}</h2>
          {latency.status === 'available' ? <p className="mt-3 text-base leading-7 text-text-secondary">{copy.latency.intro}</p> : null}
        </div>
      </div>

      {latency.status === 'unavailable' ? (
        <p className="mt-8 rounded-[20px] border border-hairline bg-surface/80 px-5 py-6 text-sm leading-6 text-text-secondary shadow-sm">
          {copy.latency.unavailable}
        </p>
      ) : rows.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ row, score }) => (
            <article key={row.modelSlug} className="rounded-[22px] border border-hairline bg-surface/80 p-5 shadow-card sm:p-6">
              <Link
                href={{ pathname: '/models/[slug]', params: { slug: row.modelSlug } }}
                className="inline-flex min-h-10 items-center font-semibold text-text-primary underline decoration-transparent underline-offset-4 transition hover:text-brandHover hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {score.modelName}
              </Link>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-hairline py-5">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{copy.latency.median}</dt>
                  <dd className="mt-1 text-3xl font-semibold tracking-[-0.04em] tabular-nums text-text-primary sm:text-4xl">
                    {formatDuration(row.medianDurationMs, locale)}
                  </dd>
                </div>
                <div className="border-l border-hairline pl-4">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{copy.latency.p90}</dt>
                  <dd className="mt-2 text-xl font-semibold tabular-nums text-text-secondary">
                    {formatDuration(row.p90DurationMs, locale)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-text-muted">
                <span>{copy.latency.window}</span>
                <time dateTime={row.asOf}>{formatDate(row.asOf, locale)}</time>
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-[20px] border border-hairline bg-surface/80 px-5 py-6 text-sm leading-6 text-text-secondary shadow-sm">
          {copy.latency.more}
        </p>
      )}
    </div>
  );
}
