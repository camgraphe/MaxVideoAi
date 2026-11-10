import { Size, WaterfallLayout, type LayoutInfo, type Rect } from 'react-aria-components/Virtualizer';
import { RecentMediaItems } from '@/lib/recent-media-items';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';

export type MediaGridItem = {
  id: string;
  asset: AssetBrowserAsset | null;
  name: string;
};

export function mediaAspect(asset: AssetBrowserAsset | null) {
  if (asset?.kind === 'audio') return 2;
  return asset?.width && asset.width > 0 && asset.height && asset.height > 0
    ? asset.width / asset.height
    : 1;
}

/** Keep React Aria's virtualizer and navigation, but size every poster before scrolling.
 * Measuring only mounted cards makes the scrollbar grow after a jump to the end.
 * The fixed 24px caption and two 1px borders match .compact-mosaic-tile in CSS.
 */
export class MediaMosaicLayout extends WaterfallLayout<MediaGridItem> {
  private recent = new RecentMediaItems<LayoutInfo>();
  getVisibleLayoutInfos(rect: Rect) {
    return this.recent.include(super.getVisibleLayoutInfos(rect), key =>
      this.virtualizer?.collection.getItem(key) ? this.getLayoutInfo(key) : null,
    ).sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  }
  update(context: Parameters<WaterfallLayout<MediaGridItem>['update']>[0]) {
    super.update(context);
    let changed = false;
    const nodes = this.virtualizer?.collection ?? [];
    for (const node of nodes) {
      const info = this.getLayoutInfo(node.key);
      if (!info || node.type !== 'item') continue;
      const height = Math.ceil((info.rect.width - 2) / mediaAspect(node.value?.asset ?? null)) + 26;
      changed = super.updateItemSize(node.key, new Size(info.rect.width, height)) || changed;
    }
    if (changed) super.update(context);
    for (const node of nodes) {
      const info = this.getLayoutInfo(node.key);
      if (info && node.type === 'item') info.estimatedSize = false;
    }
  }
}
