import type { QuadPreviewTile, QuadTileAction } from './quad-preview-types';

export const TILE_ACTIONS: Array<{ id: QuadTileAction; label: string; icon: string }> = [
  { id: 'continue', label: 'Continue', icon: '/assets/icons/play.svg' },
  { id: 'refine', label: 'Refine', icon: '/assets/icons/remix.svg' },
  { id: 'branch', label: 'Branch', icon: '/assets/icons/extend.svg' },
  { id: 'copy', label: 'Copy prompt', icon: '/assets/icons/copy.svg' },
  { id: 'open', label: 'Open in player', icon: '/assets/icons/expand.svg' },
];

export function getAspectClass(aspectRatio?: string | null): string {
  const normalized = (aspectRatio ?? '').trim();
  switch (normalized) {
    case '1:1':
    case 'square':
      return 'aspect-square';
    case '9:16':
    case '9/16':
      return 'aspect-[9/16]';
    case '9:21':
    case '9/21':
      return 'aspect-[9/21]';
    case '16:9':
    case '16/9':
      return 'aspect-[16/9]';
    case '3:4':
    case '3/4':
      return 'aspect-[3/4]';
    case '4:3':
    case '4/3':
      return 'aspect-[4/3]';
    case '4:5':
    case '4/5':
      return 'aspect-[4/5]';
    case '5:4':
    case '5/4':
      return 'aspect-[5/4]';
    case '21:9':
    case '21/9':
      return 'aspect-[21/9]';
    default:
      return 'aspect-[16/9]';
  }
}

export function formatCurrency(amountCents?: number, currency = 'USD') {
  if (typeof amountCents !== 'number') return null;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

export function buildTilesWithPlaceholders(sortedTiles: QuadPreviewTile[], iterationCount: number): Array<QuadPreviewTile | null> {
  if (sortedTiles.length === 0) return [];

  const primaryAspectRatio = sortedTiles[0]?.aspectRatio ?? '16:9';
  const desiredSlots = (() => {
    if (iterationCount <= 1) return 1;
    if (iterationCount === 2) return 2;
    if (primaryAspectRatio === '9:16' && iterationCount === 3) return 3;
    if (iterationCount >= 3) return 4;
    return 1;
  })();

  const list: Array<QuadPreviewTile | null> = [...sortedTiles];
  while (list.length < desiredSlots) {
    list.push(null);
  }

  if (primaryAspectRatio === '9:16' && desiredSlots === 4 && sortedTiles.length === 2) {
    const first = sortedTiles[0] ?? null;
    const second = sortedTiles[1] ?? null;
    return [null, first, second, null];
  }

  return list.slice(0, desiredSlots);
}
