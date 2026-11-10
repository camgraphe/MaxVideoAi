'use client';
import type { AssetLibraryBrowserProps } from './AssetLibraryBrowser';
import { compactLibraryCopy } from './compact-library-copy';
import { CompactLibraryPopup } from './CompactLibraryPopup.client';

type Props = NonNullable<AssetLibraryBrowserProps['management']> & {
    locale: string;
    density: number;
    setDensity: (value: number) => void;
  };
export function CompactLibraryFilters({
  userId,
  locale,
  scope,
  onScopeChange,
  density,
  setDensity,
}: Props) {
  const copy = compactLibraryCopy(locale);
  return (
    <CompactLibraryPopup label={copy.filters} active={scope.view !== 'all'}>
      <div className="compact-library-filters">
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
      </div>
    </CompactLibraryPopup>
  );
}
