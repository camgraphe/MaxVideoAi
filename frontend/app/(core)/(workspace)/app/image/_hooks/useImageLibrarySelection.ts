import { mediaReadAccessFields } from '@/lib/library-media-access';
import type { MediaReadAccess } from '@/lib/media-read-access';
import { useRef, type Dispatch, type SetStateAction } from 'react';
import { cleanupSlotPreview, imageReferenceIdentity } from '../_lib/image-reference-slot-state';
import type { LibraryAsset, ReferenceSlotValue } from '../_lib/image-workspace-types';

/** Validates against the lifecycle's synchronous current slots and publishes one complete draft. */
export function useImageLibrarySelection(options: {
  intent: string;
  opening?: object;
  limit: number;
  slotIndex: number | null;
  supported: (mime?: string | null, url?: string | null) => boolean;
  unsupported: () => void;
  setSlots: Dispatch<SetStateAction<(ReferenceSlotValue | null)[]>>;
  close: () => void;
}) {
  const context = useRef({ intent: options.intent, opening: options.opening });
  if (context.current.intent !== options.intent || context.current.opening !== options.opening) context.current = { intent: options.intent, opening: options.opening };
  const captured = context.current;
  const latest = useRef(options);
  latest.current = options;
  function select(assets: LibraryAsset[], slotIndex?: number | null) {
    const live = latest.current;
    if (captured !== context.current || !assets.length) return false;
    if (assets.some((asset) => !live.supported(asset.mime, asset.url))) {
      live.unsupported();
      return false;
    }
    if (
      slotIndex != null &&
      (assets.length !== 1 || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= live.limit)
    )
      return false;
    let accepted = false;
    live.setSlots((previous) => {
      const next = previous.slice();
      const replaced: (ReferenceSlotValue | null)[] = [];
      for (const asset of assets) {
        const identity = imageReferenceIdentity(asset);
        if (
          slotIndex == null &&
          next.some(
            (slot) =>
              slot?.status === 'ready' &&
              (identity && slot.ref ? JSON.stringify(slot.ref) === JSON.stringify(identity) : slot.url === asset.url),
          )
        )
          continue;
        const index = slotIndex ?? next.slice(0, live.limit).findIndex((slot) => slot === null);
        if (index < 0 || index >= live.limit) return previous;
        replaced.push(next[index]);
        next[index] = {
            ...mediaReadAccessFields(asset as MediaReadAccess),
          id: asset.id,
          name: asset.name?.trim() || undefined,
          ref: identity,
          url: asset.url,
          previewUrl: asset.url,
          status: 'ready',
          source: 'library',
          width: asset.width ?? null,
          height: asset.height ?? null,
        };
      }
      accepted = true;
      replaced.forEach(cleanupSlotPreview);
      return next;
    });
    if (accepted) live.close();
    return accepted;
  }
  return {
    handleLibrarySelect: (asset: LibraryAsset, preferredIndex?: number) =>
      select([asset], preferredIndex ?? options.slotIndex),
    handleLibrarySelectMany: (assets: LibraryAsset[]) => select(assets),
  };
}
