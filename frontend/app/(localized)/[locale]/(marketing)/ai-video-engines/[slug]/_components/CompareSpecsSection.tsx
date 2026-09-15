import { ChevronDown, Timer, Monitor, AudioLines, Ratio } from 'lucide-react';
import { getCompareEditorialCopy, getCompareDetailActions } from '../_lib/compare-editorial-copy';
import clsx from 'clsx';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import type { CompareDetailLabels, ComparePageCopy } from '../_lib/compare-page-copy';
import type { ComparePageOverride } from '../_lib/compare-page-overrides';
import type { CompareSpecRow } from '../_lib/compare-page-spec-rows';
import {
  formatEngineName,
  localizeSpecDetailValue,
  stripAudioReferencesForSilentPair,
} from '../_lib/compare-page-helpers';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';
import { renderSpecValue } from './CompareSpecValue';

type CompareSpecsSectionProps = {
  activeLocale: AppLocale;
  compareCopy: ComparePageCopy;
  labels: CompareDetailLabels;
  left: EngineCatalogEntry;
  pageOverride?: ComparePageOverride | null;
  pairHasNativeAudio: boolean;
  right: EngineCatalogEntry;
  specRows: CompareSpecRow[];
};

export function CompareSpecsSection({
  activeLocale,
  compareCopy,
  labels,
  left,
  pageOverride,
  pairHasNativeAudio,
  right,
  specRows,
}: CompareSpecsSectionProps) {
  const editorialCopy = getCompareEditorialCopy(activeLocale);
  const actions = getCompareDetailActions(activeLocale);
  const previewRows = [
    { key: 'maxDuration', fallback: 'Max duration', Icon: Timer },
    { key: 'maxResolution', fallback: 'Max resolution', Icon: Monitor },
    pairHasNativeAudio ? { key: 'audioOutput', fallback: 'Audio output', Icon: AudioLines } : { key: 'aspectRatios', fallback: 'Aspect ratios', Icon: Ratio },
  ].flatMap(({ key, fallback, Icon }) => {
    const row = specRows.find(item => item.label === (compareCopy.specLabels?.[key] ?? fallback));
    return row ? [{ row, Icon }] : [];
  });
  return (
    <section id="specs" className="compare-spec-panel">
      <h2 className="text-center text-2xl font-semibold text-text-primary">
        {editorialCopy.specs}
      </h2>
      <p className="mt-2 text-center text-sm text-text-secondary">
        {stripAudioReferencesForSilentPair(
          compareCopy.keySpecs?.subtitle ??
            'Compare key AI video model specs side-by-side (pricing, inputs, resolution, duration, aspect ratios, audio, and core controls). This is a high-level snapshot — see the full engine profile for the complete feature set and prompt examples.',
          pairHasNativeAudio
        )}
      </p>

      <div className="compare-spec-preview">
        {previewRows.map(({ row, Icon }) => <article key={row.label}>
          <h3><Icon size={20} aria-hidden="true" />{row.label}</h3>
          <dl>{[{ entry: left, value: row.left }, { entry: right, value: row.right }].map(({ entry, value }) => <div key={entry.modelSlug}>
            <dt>{formatEngineName(entry)}</dt><dd>{localizeSpecDetailValue(value, activeLocale, { pending: labels.pending, supported: labels.supported, notSupported: labels.notSupported })}</dd>
          </div>)}</dl>
        </article>)}
      </div>
      <details className="compare-spec-details">
        <summary className="compare-disclosure-trigger">
          <span className="compare-disclosure-copy">
            <strong className="compare-when-closed">{actions.allSpecs.replace('{count}', String(specRows.length))}</strong>
            <strong className="compare-when-open">{actions.closeSpecs}</strong>
            <small>{actions.specHint}</small>
          </span>
          <span className="compare-disclosure-arrow"><ChevronDown size={22} aria-hidden="true" /></span>
        </summary>
      <div className="mt-4 rounded-card border border-hairline bg-surface shadow-card">
        <div className="grid grid-cols-[minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(90px,1fr)] gap-2 border-b border-hairline px-3 py-3 text-[10px] font-semibold uppercase tracking-micro text-text-muted min-[840px]:grid-cols-[minmax(200px,2fr)_minmax(220px,1fr)_minmax(200px,2fr)] min-[840px]:gap-4 min-[840px]:px-6 min-[840px]:py-4 min-[840px]:text-xs">
          <span className="text-left">{formatEngineName(left)}</span>
          <span className="text-center">{compareCopy.keySpecs?.keyLabel ?? 'Key spec'}</span>
          <span className="text-right">{formatEngineName(right)}</span>
        </div>
        <div className="divide-y divide-hairline">
          {specRows.map((row, index) => (
            <div
              key={row.label}
              className={clsx(
                'grid grid-cols-[minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(90px,1fr)] gap-2 px-3 py-3 text-[11px] min-[840px]:grid-cols-[minmax(200px,2fr)_minmax(220px,1fr)_minmax(200px,2fr)] min-[840px]:gap-4 min-[840px]:px-6 min-[840px]:py-4 min-[840px]:text-sm',
                index % 2 === 1 && 'bg-surface-2'
              )}
            >
              <div className="rounded-md px-1 py-0.5 text-text-secondary sm:px-2 sm:py-1">
                {renderSpecValue(row.left, activeLocale, {
                  pending: labels.pending,
                  supported: labels.supported,
                  notSupported: labels.notSupported,
                })}
                {(row.sublines ?? (row.subline ? [row.subline] : [])).map((line) => (
                  <div key={line} className="mt-1 text-[10px] text-text-muted">{line}</div>
                ))}
              </div>
              <span className="text-center text-text-primary">{row.label}</span>
              <div className="rounded-md px-1 py-0.5 text-right text-text-secondary sm:px-2 sm:py-1">
                {renderSpecValue(row.right, activeLocale, {
                  pending: labels.pending,
                  supported: labels.supported,
                  notSupported: labels.notSupported,
                })}
                {(row.rightSublines ?? (row.rightSubline ? [row.rightSubline] : [])).map((line) => (
                  <div key={line} className="mt-1 text-[10px] text-text-muted">{line}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {specRows.some((row) => row.kind === 'latency') ? (
        <p className="mt-3 text-xs leading-5 text-text-muted">
          {compareCopy.keySpecs?.latencyNote ??
            'Observed production times over 30 days; settings and queues vary. P90 means 90% of measured renders finished within this time. These are not controlled speed tests.'}{' '}
          <Link href="/benchmarks" className="font-semibold text-brand underline underline-offset-4">
            {compareCopy.keySpecs?.latencySource ?? 'Measurement method and limitations'}
          </Link>
        </p>
      ) : null}

      </details>

      {pageOverride?.primaryLinks?.length ? (
        <section className="mt-4 rounded-[24px] border border-hairline bg-surface/90 px-4 py-4 shadow-sm sm:px-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
            {pageOverride.primaryLinksTitle ?? 'Recommended next steps'}
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {pageOverride.primaryLinks.map((item) => (
              <Link key={item.label} href={item.href} className="font-semibold text-brand hover:text-brandHover">
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
