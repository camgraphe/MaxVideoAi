import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';

export const MEDIA_HANDOFF_KEY = 'maxvideoai:media-handoff:v1';
const MAX_AGE = 10 * 60 * 1000;
export type MediaDestination = 'image' | 'video';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function supportsMediaDestination(asset: Pick<AssetBrowserAsset, 'kind'>, destination: MediaDestination) {
  return destination === 'video' || asset.kind === 'image';
}
export function stageMediaHandoff(storage: StorageLike, account: string, asset: AssetBrowserAsset, destination: MediaDestination, token: string, now = Date.now()) {
  if (!account || !supportsMediaDestination(asset, destination)) throw new Error('Invalid media destination');
  const value = JSON.stringify({ account, asset, destination, token, createdAt: now });
  if (value.length > 32_000) throw new Error('Media handoff too large');
  storage.setItem(MEDIA_HANDOFF_KEY, value);
  return `${destination === 'image' ? '/app/image' : '/app'}?media=${encodeURIComponent(token)}`;
}
export function consumeMediaHandoff(storage: StorageLike, account: string, destination: MediaDestination, token: string, now = Date.now()): AssetBrowserAsset | null {
  const raw = storage.getItem(MEDIA_HANDOFF_KEY);
  if (!raw) return null;
  storage.removeItem(MEDIA_HANDOFF_KEY);
  try {
    if (raw.length > 32_000) return null;
    const value = JSON.parse(raw);
    const asset = value.asset;
    if (value.account !== account || value.destination !== destination || value.token !== token || typeof value.createdAt !== 'number' || now < value.createdAt || now - value.createdAt > MAX_AGE) return null;
    if (!asset || typeof asset.id !== 'string' || !asset.id || typeof asset.url !== 'string' || !['image', 'video', 'audio'].includes(asset.kind) || !supportsMediaDestination(asset, destination)) return null;
    const url = new URL(asset.url, 'https://local.invalid');
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    return asset;
  } catch { return null; }
}
