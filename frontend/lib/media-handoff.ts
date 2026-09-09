import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';

export const MEDIA_HANDOFF_KEY = 'maxvideoai:media-handoff:v1';
const MAX_AGE = 10 * 60 * 1000;
export const MEDIA_TOOL_DESTINATIONS = ['upscale', 'angle', 'background-removal', 'restore-video', 'denoise', 'fix-blur', 'smooth-motion'] as const;
export type MediaToolDestination = typeof MEDIA_TOOL_DESTINATIONS[number];
export type MediaDestination = 'image' | 'video' | MediaToolDestination;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function supportsMediaDestination(asset: Pick<AssetBrowserAsset, 'kind'>, destination: MediaDestination) {
  if (destination === 'video') return true;
  if (destination === 'image' || destination === 'angle') return asset.kind === 'image';
  if (destination === 'upscale') return asset.kind === 'image' || asset.kind === 'video';
  return MEDIA_TOOL_DESTINATIONS.includes(destination) && asset.kind === 'video';
}
export function stageMediaHandoff(storage: StorageLike, account: string, asset: AssetBrowserAsset, destination: MediaDestination, token: string, now = Date.now()) {
  if (!account || !supportsMediaDestination(asset, destination)) throw new Error('Invalid media destination');
  const value = JSON.stringify({ account, asset, destination, token, createdAt: now });
  if (value.length > 32_000) throw new Error('Media handoff too large');
  storage.setItem(MEDIA_HANDOFF_KEY, value);
  const path = destination === 'image' ? '/app/image' : destination === 'video' ? '/app' : `/app/tools/${destination}`;
  return `${path}?media=${encodeURIComponent(token)}${destination === 'upscale' ? `&kind=${asset.kind}` : ''}`;
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
