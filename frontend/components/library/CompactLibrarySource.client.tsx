'use client';
import { Check } from 'lucide-react';
import type { AssetLibraryBrowserProps } from './AssetLibraryBrowser';
import { compactMediaSource } from './media-action-copy';
import { CompactLibraryPopup } from './CompactLibraryPopup.client';

const origins = new Set(['all', 'upload', 'generated', 'recent']);
/** Type stays in the main navigation; this menu filters the producing tool/origin. */
export function CompactLibrarySource({ locale, source, availableSources, sourceLabels, onSourceChange }: Pick<AssetLibraryBrowserProps, 'source' | 'availableSources' | 'sourceLabels' | 'onSourceChange'> & { locale: string }) {
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const tools = fr ? 'Outils' : es ? 'Herramientas' : 'Tools';
  const label = source === 'all' ? tools : compactMediaSource(source, locale, sourceLabels[source] ?? source);
  return <CompactLibraryPopup className="compact-library-tools-trigger" label={label} active={source !== 'all'}>
    {(close) => <div className="compact-library-tools-menu">
      <p>{fr ? 'Les résultats restent classés dans Images, Vidéos ou Audio.' : es ? 'Los resultados también aparecen en Imágenes, Vídeos o Audio.' : 'Results also appear in Images, Videos or Audio.'}</p>
      {[{ label: tools, values: availableSources.filter(value => !origins.has(value)) }, { label: fr ? 'Autres médias' : es ? 'Otros medios' : 'Other media', values: availableSources.filter(value => origins.has(value)) }].filter(group => group.values.length).map(group => <div key={group.label} role="group" aria-label={group.label}>
        <strong>{group.label}</strong>
        {group.values.map(value => <button key={value} type="button" aria-pressed={source === value} onClick={() => { onSourceChange(value); close(); }}>
          <span>{value === 'all' ? (fr ? 'Tous les outils et imports' : es ? 'Todas las herramientas e importaciones' : 'All tools and imports') : compactMediaSource(value, locale, sourceLabels[value] ?? value)}</span>
          {source === value ? <Check size={14} aria-hidden /> : null}
        </button>)}
      </div>)}
    </div>}
  </CompactLibraryPopup>;
}
