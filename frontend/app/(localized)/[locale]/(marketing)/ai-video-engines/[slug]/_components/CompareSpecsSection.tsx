import clsx from 'clsx';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import type { CompareDetailLabels, ComparePageCopy } from '../_lib/compare-page-copy';
import type { ComparePageOverride } from '../_lib/compare-page-overrides';
import type { CompareSpecRow } from '../_lib/compare-page-spec-rows';
import {
  formatEngineName,
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
  return (
    <section className="mt-4 rounded-[16px] border border-hairline bg-surface p-6 shadow-card sm:p-8">
      <h2 className="text-center text-2xl font-semibold text-text-primary">
        {compareCopy.keySpecs?.title ?? 'Key Specs (Side-by-Side)'}
      </h2>
      <p className="mt-2 text-center text-sm text-text-secondary">
        {stripAudioReferencesForSilentPair(
          compareCopy.keySpecs?.subtitle ??
            'Compare key AI video model specs side-by-side (pricing, inputs, resolution, duration, aspect ratios, audio, and core controls). This is a high-level snapshot — see the full engine profile for the complete feature set and prompt examples.',
          pairHasNativeAudio
        )}
      </p>

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
                {'subline' in row && row.subline ? (
                  <div className="mt-1 text-[10px] text-text-muted">{row.subline}</div>
                ) : null}
              </div>
              <span className="text-center text-text-primary">{row.label}</span>
              <div className="rounded-md px-1 py-0.5 text-right text-text-secondary sm:px-2 sm:py-1">
                {renderSpecValue(row.right, activeLocale, {
                  pending: labels.pending,
                  supported: labels.supported,
                  notSupported: labels.notSupported,
                })}
                {'rightSubline' in row && row.rightSubline ? (
                  <div className="mt-1 text-[10px] text-text-muted">{row.rightSubline}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pageOverride?.topCards?.length ? (
        <section className="mt-6 rounded-[24px] border border-hairline bg-surface-2/70 p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-2">
            {pageOverride.topCards.map((card) => (
              <article key={card.title} className="rounded-[18px] border border-hairline bg-surface/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                  {card.title}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-text-secondary">{card.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
