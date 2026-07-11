import { ExternalLink } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import type { BenchmarkCopy } from '../_lib/benchmark-copy';
import type { BenchmarkSpecRow } from '../_lib/benchmark-page-data';

type BenchmarkSpecsTableProps = {
  copy: BenchmarkCopy;
  locale: AppLocale;
  rows: BenchmarkSpecRow[];
};

const COLUMN_LABELS: Record<AppLocale, { model: string; duration: string; resolution: string }> = {
  en: { model: 'Model', duration: 'Max duration', resolution: 'Max resolution' },
  fr: { model: 'Modèle', duration: 'Durée max.', resolution: 'Résolution max.' },
  es: { model: 'Modelo', duration: 'Duración máx.', resolution: 'Resolución máx.' },
};

export function BenchmarkSpecsTable({ copy, locale, rows }: BenchmarkSpecsTableProps) {
  const labels = COLUMN_LABELS[locale];
  return (
    <div className="overflow-hidden rounded-[24px] border border-hairline bg-surface/80 shadow-card">
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
        <table className="min-w-[980px] w-full border-collapse text-left">
          <caption className="sr-only">{copy.specs.intro}</caption>
          <thead>
            <tr className="border-b border-hairline bg-surface-2/70">
              {[labels.model, labels.duration, labels.resolution, copy.specs.modes, copy.specs.audio, copy.specs.references, copy.specs.source].map((label, index) => (
                <th
                  key={label}
                  scope="col"
                  className={`${index === 0 ? 'sticky left-0 z-10 w-[210px] border-r border-hairline bg-surface-2' : ''} px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <tr key={row.modelSlug} className="group transition-colors hover:bg-surface-2/45">
                <th scope="row" className="sticky left-0 z-10 border-r border-hairline bg-surface px-5 py-4 group-hover:bg-surface-2">
                  <Link
                    href={{ pathname: '/models/[slug]', params: { slug: row.modelSlug } }}
                    className="inline-flex min-h-10 items-center font-semibold text-text-primary underline decoration-transparent underline-offset-4 transition hover:text-brandHover hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row.modelName}
                  </Link>
                </th>
                <td className="px-5 py-4 text-sm font-medium text-text-primary">{row.maxDuration}</td>
                <td className="px-5 py-4 text-sm font-medium text-text-primary">{row.maxResolution}</td>
                <td className="px-5 py-4">
                  <div className="flex max-w-[230px] flex-wrap gap-1.5">
                    {row.inputModes.length ? row.inputModes.map((mode) => (
                      <span key={mode} className="rounded-full border border-hairline bg-bg px-2.5 py-1 text-xs font-medium text-text-secondary">
                        {copy.specs.modeLabels[mode]}
                      </span>
                    )) : <span className="text-text-muted">—</span>}
                  </div>
                </td>
                <td className="max-w-[170px] px-5 py-4 text-sm leading-6 text-text-secondary">{row.audio}</td>
                <td className="max-w-[190px] px-5 py-4 text-sm leading-6 text-text-secondary">{row.references}</td>
                <td className="px-5 py-4">
                  {row.sourceUrl ? (
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-brand transition hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {copy.specs.source}
                      <UIIcon icon={ExternalLink} size={14} />
                    </a>
                  ) : <span className="text-text-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
