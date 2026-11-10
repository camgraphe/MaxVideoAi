import { GridLayout, ListLayout, type LayoutInfo, type Rect } from 'react-aria-components/Virtualizer';
import { RecentMediaItems } from '@/lib/recent-media-items';
import type { MediaGridItem } from './MediaMosaicLayout';

export class MediaGridLayout extends GridLayout<MediaGridItem> {
  private recent = new RecentMediaItems<LayoutInfo>();
  getVisibleLayoutInfos(rect: Rect) {
    return this.recent.include(super.getVisibleLayoutInfos(rect), key =>
      this.virtualizer?.collection.getItem(key) ? this.getLayoutInfo(key) : null,
    ).sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  }
}

export class MediaListLayout extends ListLayout<MediaGridItem> {
  private recent = new RecentMediaItems<LayoutInfo>();
  getVisibleLayoutInfos(rect: Rect) {
    return this.recent.include(super.getVisibleLayoutInfos(rect), key =>
      this.virtualizer?.collection.getItem(key) ? this.getLayoutInfo(key) : null,
    ).sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  }
}
