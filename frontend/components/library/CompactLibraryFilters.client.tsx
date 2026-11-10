'use client';
import type { AssetLibraryBrowserProps } from './AssetLibraryBrowser';
import { compactLibraryCopy } from './compact-library-copy';
import { CompactLibraryPopup } from './CompactLibraryPopup.client';
import { RefreshCw } from 'lucide-react';
import type { MediaDisplayMode } from './CompactMediaGrid.client';
import { compactMediaSource } from './media-action-copy';
import { CompactLibrarySelection } from './CompactLibrarySelection.client';
import type { useLibraryManagementSelection } from './useLibraryManagementSelection';

type Props = NonNullable<AssetLibraryBrowserProps['management']> & {
    locale: string;
    density: number;
    setDensity: (value: number) => void;
    onRefresh?: () => void;
    refreshLabel?: string;
    displayMode: MediaDisplayMode;
    onDisplayModeChange: (mode: MediaDisplayMode) => void;
    sourceOptions: Pick<AssetLibraryBrowserProps, 'source' | 'availableSources' | 'sourceLabels' | 'onSourceChange'>;
    selection: ReturnType<typeof useLibraryManagementSelection>;
    isLoading: boolean;
  };
export function CompactLibraryFilters({
  userId,
  locale,
  scope,
  onScopeChange,
  density,
  setDensity,
  onRefresh,
  refreshLabel,
  totalCount,
  displayMode,
  onDisplayModeChange,
  sourceOptions,
  selection,
  isLoading,
}: Props) {
  const copy = compactLibraryCopy(locale);
  return (
    <CompactLibraryPopup className="compact-library-filters-trigger" label={copy.filters} active={scope.view !== 'all' || sourceOptions.source !== 'all'}>
      {close => <div className="compact-library-filters">
        <div className="compact-library-mobile-settings">
          <p>{totalCount.toLocaleString(locale)} {copy.results}</p>
          <label>
            <span>{copy.source}</span>
            <select aria-label={copy.source} value={sourceOptions.source} onChange={event => sourceOptions.onSourceChange(event.target.value as typeof sourceOptions.source)}>
              {sourceOptions.availableSources.map(value => <option key={value} value={value}>
                {value === 'all' ? copy.all : compactMediaSource(value, locale, sourceOptions.sourceLabels[value] ?? value)}
              </option>)}
            </select>
          </label>
          <label>
            <span>{copy.display}</span>
            <select aria-label={copy.display} value={displayMode} onChange={event => onDisplayModeChange(event.target.value as MediaDisplayMode)}>
              {(['mosaic', 'grid', 'list'] as const).map(mode => <option key={mode} value={mode}>{copy[mode]}</option>)}
            </select>
          </label>
        </div>
        <label>
          <span>{copy.view}</span>
          <select
            aria-label={copy.view}
            value={scope.view}
            onChange={(event) =>
              onScopeChange({
                view: event.target.value as typeof scope.view,
              })
            }
          >
            <option value="all">{copy.all}</option>
            <option value="saved">{copy.saved}</option>
            <option value="review">{copy.review}</option>
          </select>
        </label>
        <label>
          <span>{copy.sort}</span>
          <select
            aria-label={copy.sort}
            value={scope.sort}
            onChange={(event) =>
              onScopeChange({
                sort: event.target.value as typeof scope.sort,
              })
            }
          >
            <option value="recent">{copy.recent}</option>
            <option value="oldest">{copy.oldest}</option>
            <option value="name">{copy.name}</option>
          </select>
        </label>
        <label className="compact-library-density">
          <span>{copy.density}</span>
          <input
            aria-label={copy.density}
            type="range"
            min={88}
            max={184}
            step={8}
            value={density}
            onChange={(event) => {
              const n = Number(event.target.value);
              setDensity(n);
              try {
                window.localStorage.setItem(`library:density:${userId}`, String(n));
              } catch {
                /* storage unavailable */
              }
            }}
          />
        </label>
        <CompactLibrarySelection locale={locale} selection={selection} isLoading={isLoading} onClose={close} />
        {onRefresh ? <button type="button" onClick={onRefresh}><RefreshCw size={15} aria-hidden /> {refreshLabel ?? copy.retry}</button> : null}
      </div>}
    </CompactLibraryPopup>
  );
}
