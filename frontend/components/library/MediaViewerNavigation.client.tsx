'use client';
import { hasStoredLibraryThumbnail } from '@/lib/library-image';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import { LibraryImageThumbnail } from './LibraryImageThumbnail.client';
/** Never warms originals; parent replaces the exact displayed source and every action together. */
export function MediaViewerNavigation({
  asset,
  assets,
  onSelect,
  locale,
}: {
  asset: AssetBrowserAsset;
  assets: AssetBrowserAsset[];
  onSelect: (asset: AssetBrowserAsset) => void;
  locale: string;
}) {
  const index = assets.findIndex(
    (item) => item.id === asset.id && item.url === asset.url,
  );
  if (index < 0 || assets.length < 2) return null;
  const labels = locale.startsWith('fr')
    ? ['Précédent', 'Suivant', 'Sortie']
    : locale.startsWith('es')
      ? ['Anterior', 'Siguiente', 'Resultado']
      : ['Previous', 'Next', 'Output'];
  return (
    <nav className="app-library-neighbors" aria-label={labels[2]}>
      <button
        type="button"
        aria-label={labels[0]}
        disabled={index === 0}
        onClick={() => onSelect(assets[index - 1])}
      >
        ‹
      </button>
      {assets.slice(Math.max(0, index - 2), index + 3).map((item) => (
        <button
          type="button"
          key={`${item.id}:${item.url}`}
          aria-current={item === assets[index] ? 'true' : undefined}
          aria-label={`${labels[2]} ${assets.indexOf(item) + 1}`}
          onClick={() => {
            if (item !== assets[index]) onSelect(item);
          }}
        >
          {hasStoredLibraryThumbnail(item) ? (
            <LibraryImageThumbnail asset={item} posterOnly alt="" />
          ) : (
            <span>{item.kind === 'audio' ? '♪' : '▧'}</span>
          )}
        </button>
      ))}
      <button
        type="button"
        aria-label={labels[1]}
        disabled={index === assets.length - 1}
        onClick={() => onSelect(assets[index + 1])}
      >
        ›
      </button>
    </nav>
  );
}
