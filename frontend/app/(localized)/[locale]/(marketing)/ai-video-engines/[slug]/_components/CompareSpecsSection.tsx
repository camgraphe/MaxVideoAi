import { ChevronDown, Timer, Monitor, AudioLines, Ratio } from 'lucide-react';
import { getCompareEditorialCopy, getCompareDetailActions } from '../_lib/compare-editorial-copy';
import { CompareSpecsTable } from './CompareSpecsTable';
import { compareDurationLabels } from '../_lib/compare-duration-copy';
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

type CompareSpecsSectionProps = {
  activeLocale: AppLocale;
  sources: Array<{ name: string; urls: string[] }>;
  compareCopy: ComparePageCopy;
  labels: CompareDetailLabels;
  left: EngineCatalogEntry;
  pageOverride?: ComparePageOverride | null;
  pairHasNativeAudio: boolean;
  right: EngineCatalogEntry;
  specRows: CompareSpecRow[];
};

export function CompareSpecsSection({
  activeLocale, sources,
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
    const row = specRows.find(item => item.key === key || item.label === (compareCopy.specLabels?.[key] ?? fallback));
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
          <h3><span className="compare-spec-icon"><Icon size={18} aria-hidden="true" /></span>{row.label}</h3>
          <dl>{[{ entry: left, value: row.left, side: 'left' }, { entry: right, value: row.right, side: 'right' }].map(({ entry, value, side }) => <div key={entry.modelSlug} className={`compare-spec-side compare-spec-side--${side}`}>
            <dt>{formatEngineName(entry)}</dt><dd>{localizeSpecDetailValue(value, activeLocale, { pending: labels.pending, supported: labels.supported, notSupported: labels.notSupported })}</dd>
          </div>)}</dl>
        </article>)}
      </div>
      <details className="compare-spec-details" data-comparison-section="specifications">
        <summary className="compare-disclosure-trigger">
          <span className="compare-disclosure-copy">
            <strong className="compare-when-closed">{actions.allSpecs.replace('{count}', String(specRows.length))}</strong>
            <strong className="compare-when-open">{actions.closeSpecs}</strong>
            <small>{actions.specHint}</small>
          </span>
          <span className="compare-disclosure-arrow"><ChevronDown size={22} aria-hidden="true" /></span>
        </summary>
      <CompareSpecsTable rows={specRows} locale={activeLocale} labels={labels} leftName={formatEngineName(left)} rightName={formatEngineName(right)} criterionLabel={compareCopy.keySpecs?.keyLabel ?? 'Key spec'} />
      <p className="px-4 py-3 text-xs leading-5 text-text-muted">{compareDurationLabels(activeLocale).conditions}</p>

      {specRows.some((row) => row.kind === 'latency') ? (
        <p className="mt-3 text-xs leading-5 text-text-muted">
          {compareCopy.keySpecs?.latencyNote ??
            'Observed production times over 30 days; settings and queues vary. P90 means 90% of measured renders finished within this time. These are not controlled speed tests.'}{' '}
          <Link href="/benchmarks" className="font-semibold text-brand underline underline-offset-4">
            {compareCopy.keySpecs?.latencySource ?? 'Measurement method and limitations'}
          </Link>
        </p>
      ) : null}

      <div className="compare-spec-sources">
        <p>{activeLocale === 'fr' ? 'Capacités disponibles dans MaxVideoAI. Sources fournisseur ci-dessous ; leur date de vérification n’est pas consignée ici.' : activeLocale === 'es' ? 'Capacidades disponibles en MaxVideoAI. Fuentes del proveedor abajo; su fecha de verificación no se registra aquí.' : 'Capabilities available in MaxVideoAI. Provider sources below; their verification dates are not recorded here.'}</p>
        {sources.map(source => <p key={source.name}><strong>{source.name}: </strong>{source.urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{index > 0 ? ' · ' : ''}{new URL(url).hostname}{source.urls.filter(other => new URL(other).hostname === new URL(url).hostname).length > 1 ? ` (${index + 1})` : ''}</a>)}</p>)}
      </div>
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
