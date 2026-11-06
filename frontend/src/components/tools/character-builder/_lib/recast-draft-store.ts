import type { RecastFraming, RecastResolution } from '@/lib/character-studio-recast-format';
import { RECAST_FRAMINGS, RECAST_RESOLUTIONS } from '@/lib/character-studio-recast-format';
import type { RecastImage } from './recast-submit';
import type { RecastTrack } from '../_components/useRecastTrack';

export type RecastDraft = {
  version: 1;
  portrait: Omit<RecastImage, 'url'> & { url?: string } | null;
  product: Omit<RecastImage, 'url'> & { url?: string } | null;
  video: Omit<RecastTrack, 'url'> | null;
  audio: Omit<RecastTrack, 'url'> | null;
  prompt: string;
  dialogue: string;
  manualSeconds: number | null;
  resolution: RecastResolution;
  aspectRatio: RecastFraming;
};

// Binary references stay on this device. Never persist object URLs, prices or purchase tokens.
export function draftImage(image: RecastImage | null): RecastDraft['portrait'] {
  return image && (image.file
    ? { name: image.name, file: image.file }
    : { name: image.name, url: image.url, jobId: image.jobId });
}
export function restoreDraftImage(image: RecastDraft['portrait']): RecastImage | null {
  return image ? { ...image, url: image.file ? URL.createObjectURL(image.file) : image.url! } : null;
}
export function draftTrack(track: RecastTrack | null): RecastDraft['video'] {
  if (!track) return null;
  const { file, name, range, originalSeconds } = track;
  return { file, name, range, originalSeconds };
}
export function hasRecastDraft(draft: RecastDraft) {
  return Boolean(draft.portrait || draft.product || draft.video || draft.audio || draft.prompt || draft.dialogue ||
    draft.manualSeconds !== null || draft.resolution !== '720p' || draft.aspectRatio !== 'auto');
}

function validDraft(value: RecastDraft): boolean {
  if (!value || value.version !== 1 || typeof value.prompt !== 'string' || value.prompt.length > 2000 ||
      typeof value.dialogue !== 'string' || value.dialogue.length > 500 ||
      !RECAST_RESOLUTIONS.includes(value.resolution) || !RECAST_FRAMINGS.includes(value.aspectRatio) ||
      !(value.manualSeconds === null || Number.isInteger(value.manualSeconds) && value.manualSeconds >= 2 && value.manualSeconds <= 30)) return false;
  const image = (item: RecastDraft['portrait']) => item === null || item && typeof item.name === 'string' &&
    (item.file instanceof File && item.file.size <= 20 * 1024 * 1024 && item.file.type.startsWith('image/') ||
      !item.file && typeof item.url === 'string' && /^https?:\/\//.test(item.url));
  const track = (item: RecastDraft['video'], max: number) => item === null || item &&
    item.file instanceof File && item.file.size > 0 && item.file.size <= max * 1024 * 1024 && typeof item.name === 'string' &&
    (!item.range || Number.isFinite(item.range.startSec) && Number.isFinite(item.range.endSec) &&
      item.range.startSec >= 0 && item.range.endSec > item.range.startSec && item.range.endSec - item.range.startSec <= 15.001);
  return Boolean(image(value.portrait) && image(value.product) && track(value.video, 100) && track(value.audio, 15));
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('maxvideoai-character-recast', 1);
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(new Error('DRAFT_STORAGE_UNAVAILABLE')); }, 5000);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onerror = () => { clearTimeout(timer); reject(request.error); };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (settled) request.result.close();
      else resolve(request.result);
    };
  });
}

export async function loadRecastDraft(accountId: string): Promise<RecastDraft | null> {
  const db = await database();
  try {
    const record = await new Promise<{ savedAt: number; draft: RecastDraft } | undefined>((resolve, reject) => {
      const request = db.transaction('drafts').objectStore('drafts').get(accountId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return record && Date.now() - record.savedAt < 7 * 24 * 3600 * 1000 && validDraft(record.draft) ? record.draft : null;
  } finally { db.close(); }
}

export async function saveRecastDraft(accountId: string, draft: RecastDraft | null): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      if (draft) store.put({ savedAt: Date.now(), draft }, accountId);
      else store.delete(accountId);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('DRAFT_STORAGE_UNAVAILABLE'));
    });
  } finally { db.close(); }
}
