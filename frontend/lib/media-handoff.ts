import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { CREATOR_TOOL_IDS, isCreatorToolPublic } from '@/lib/toolbox/creator-availability';
import type { VideoContinuationMode } from '@/lib/video-continuation';

export const MEDIA_HANDOFF_KEY = 'maxvideoai:media-handoff:v1';
const MAX_AGE = 10 * 60 * 1000;
export const MEDIA_TOOL_DESTINATIONS = ['upscale', 'angle', 'background-removal', 'restore-video', 'denoise', 'fix-blur', 'smooth-motion', ...CREATOR_TOOL_IDS] as const;
export type MediaToolDestination = typeof MEDIA_TOOL_DESTINATIONS[number];
export type MediaDestination = 'image' | 'video' | MediaToolDestination;
export type VideoSourceHandoff = { engineId: string; mode: VideoContinuationMode };
type MediaHandoff = { asset: AssetBrowserAsset; videoSource?: VideoSourceHandoff };
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function supportsMediaDestination(asset: Pick<AssetBrowserAsset, 'kind'>, destination: MediaDestination) {
  if (destination === 'video') return true;
  if (destination === 'subtitles') return asset.kind === 'video' || asset.kind === 'audio';
  if (destination === 'lip-sync') return ['image', 'video', 'audio'].includes(asset.kind);
  if (destination === 'product-photo-editor') return asset.kind === 'image';
  if (destination === 'motion-transfer') return asset.kind === 'image' || asset.kind === 'video';
  if (destination === 'image' || destination === 'angle') return asset.kind === 'image';
  if (destination === 'upscale') return asset.kind === 'image' || asset.kind === 'video';
  return MEDIA_TOOL_DESTINATIONS.includes(destination) && asset.kind === 'video';
}
export function discoverableMediaToolDestinations(asset: Pick<AssetBrowserAsset, 'kind'>): MediaToolDestination[] {
  return MEDIA_TOOL_DESTINATIONS.filter(destination => supportsMediaDestination(asset, destination)
    && (!CREATOR_TOOL_IDS.some(id => id === destination) || isCreatorToolPublic(destination)));
}
function writeMediaHandoff(storage: StorageLike, account: string, handoff: MediaHandoff, destination: MediaDestination, token: string, now: number) {
  const { asset } = handoff;
  if (!account || !supportsMediaDestination(asset, destination)) throw new Error('Invalid media destination');
  const value = JSON.stringify({ account, ...handoff, destination, token, createdAt: now });
  if (value.length > 32_000) throw new Error('Media handoff too large');
  storage.setItem(MEDIA_HANDOFF_KEY, value);
  const path = destination === 'image' ? '/app/image' : destination === 'video' ? '/app' : `/app/tools/${destination}`;
  return `${path}?media=${encodeURIComponent(token)}${destination === 'upscale' ? `&kind=${asset.kind}` : ''}`;
}

export function stageMediaHandoff(storage: StorageLike, account: string, asset: AssetBrowserAsset, destination: MediaDestination, token: string, now = Date.now()) {
  return writeMediaHandoff(storage, account, { asset }, destination, token, now);
}

export function stageVideoSourceHandoff(storage: StorageLike, account: string, asset: AssetBrowserAsset, videoSource: VideoSourceHandoff, token: string, now = Date.now()) {
  if (asset.kind !== 'video' || !validVideoSource(videoSource)) throw new Error('Invalid video source destination');
  const href = writeMediaHandoff(storage, account, { asset, videoSource }, 'video', token, now);
  return `${href}&engine=${encodeURIComponent(videoSource.engineId)}&mode=${videoSource.mode}`;
}

function validVideoSource(value: unknown): value is VideoSourceHandoff {
  if (!value || typeof value !== 'object') return false;
  const { engineId, mode } = value as Partial<VideoSourceHandoff>;
  return typeof engineId === 'string' && /^[a-z0-9][a-z0-9-]{0,127}$/.test(engineId) && (mode === 'extend' || mode === 'v2v');
}

function readMediaHandoff(storage: StorageLike, account: string, destination: MediaDestination, token: string, now: number): MediaHandoff | null {
  const raw = storage.getItem(MEDIA_HANDOFF_KEY);
  if (!raw) return null;
  try {
    if (raw.length > 32_000) return null;
    const value = JSON.parse(raw);
    const asset = value.asset;
    if (value.account !== account || value.destination !== destination || value.token !== token || typeof value.createdAt !== 'number' || now < value.createdAt || now - value.createdAt > MAX_AGE) return null;
    if (!asset || typeof asset.id !== 'string' || !asset.id || typeof asset.url !== 'string' || !['image', 'video', 'audio'].includes(asset.kind) || !supportsMediaDestination(asset, destination)) return null;
    const url = new URL(asset.url, 'https://local.invalid');
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (value.videoSource === undefined) return { asset };
    return destination === 'video' && asset.kind === 'video' && validVideoSource(value.videoSource)
      ? { asset, videoSource: value.videoSource }
      : null;
  } catch { return null; }
}

/** Keep a directed video source available until it is attached or explicitly dismissed. */
export function receiveMediaHandoff(storage: StorageLike, account: string, destination: MediaDestination, token: string, now = Date.now()) {
  const handoff = readMediaHandoff(storage, account, destination, token, now);
  if (handoff && !handoff.videoSource) storage.removeItem(MEDIA_HANDOFF_KEY);
  return handoff;
}

export function consumeMediaHandoff(storage: StorageLike, account: string, destination: MediaDestination, token: string, now = Date.now()): AssetBrowserAsset | null {
  const handoff = readMediaHandoff(storage, account, destination, token, now);
  if (!handoff) return null;
  storage.removeItem(MEDIA_HANDOFF_KEY);
  return handoff.asset;
}
