import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import type { BenchmarkCopy } from '../_lib/benchmark-copy';
import type { BenchmarkScoreRow } from '../_lib/benchmark-page-data';

type BenchmarkScoreTableProps = {
  copy: BenchmarkCopy;
  locale: AppLocale;
  rows: BenchmarkScoreRow[];
};

function formatDate(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(localeRegions[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function ScoreValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-text-muted">—</span>;
  const width = `${Math.max(0, Math.min(100, value * 10))}%`;
  return (
    <div className="min-w-[72px]">
      <span className="text-sm font-semibold tabular-nums text-text-primary">{value.toFixed(1)}</span>
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-subtle">
        <span className="block h-full rounded-full bg-brand/70" style={{ width }} />
      </span>
    </div>
  );
}

export function BenchmarkScoreTable({ copy, locale, rows }: BenchmarkScoreTableProps) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-hairline bg-surface/80 shadow-card">
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
        <table className="min-w-[1180px] w-full border-collapse text-left">
          <caption className="sr-only">{copy.scores.intro}</caption>
          <thead>
            <tr className="border-b border-hairline bg-surface-2/70">
              <th
                scope="col"
                className="sticky left-0 z-10 w-[210px] border-r border-hairline bg-surface-2 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted"
              >
                {copy.scores.source}
              </th>
              <th scope="col" className="w-[104px] px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                0–10
              </th>
              {copy.scoreLabels.map((metric) => (
                <th key={metric.id} scope="col" className="min-w-[88px] px-3 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  {metric.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <tr key={row.modelSlug} className="group transition-colors hover:bg-surface-2/45">
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-[210px] border-r border-hairline bg-surface px-5 py-4 align-top group-hover:bg-surface-2"
                >
                  <Link
                    href={{ pathname: '/models/[slug]', params: { slug: row.modelSlug } }}
                    className="inline-flex min-h-10 items-center font-semibold text-text-primary underline decoration-transparent underline-offset-4 transition hover:text-brandHover hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row.modelName}
                  </Link>
                  {row.updatedAt ? (
                    <span className="block text-[11px] font-normal leading-5 text-text-muted">
                      {copy.scores.updated} · {formatDate(row.updatedAt, locale)}
                    </span>
                  ) : null}
                </th>
                <td className="px-4 py-4 align-top">
                  {row.overall == null ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <span className="inline-flex min-w-12 justify-center rounded-full bg-brand px-2.5 py-1.5 text-sm font-bold tabular-nums text-on-brand shadow-sm">
                      {row.overall.toFixed(1)}
                    </span>
                  )}
                </td>
                {copy.scoreLabels.map((metric) => (
                  <td key={metric.id} className="px-3 py-4 align-top">
                    <ScoreValue value={row.metrics[metric.id as keyof BenchmarkScoreRow['metrics']]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
