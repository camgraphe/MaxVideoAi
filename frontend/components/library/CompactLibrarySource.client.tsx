'use client';
import type { AssetLibraryBrowserProps } from './AssetLibraryBrowser';
import { compactMediaSource } from './media-action-copy';
export function CompactLibrarySource({ locale, source, availableSources, sourceLabels, onSourceChange }: Pick<AssetLibraryBrowserProps, 'source' | 'availableSources' | 'sourceLabels' | 'onSourceChange'> & { locale: string }) {
  const label = locale.startsWith('fr') ? 'Origine' : locale.startsWith('es') ? 'Origen' : 'Source';
  return <label className="compact-library-source" data-active={source !== 'all'}><span>{label}</span>
    <select aria-label={label} value={source} onChange={event => onSourceChange(event.target.value as typeof source)}>
      {availableSources.map(value => <option key={value} value={value}>{compactMediaSource(value, locale, sourceLabels[value] ?? value)}</option>)}
    </select>
  </label>;
}
