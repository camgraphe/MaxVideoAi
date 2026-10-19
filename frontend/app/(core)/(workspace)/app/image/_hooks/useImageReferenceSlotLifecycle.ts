import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { cleanupSlotPreview } from '../_lib/image-reference-slot-state';
import { MAX_REFERENCE_SLOTS, type ReferenceSlotValue } from '../_lib/image-workspace-types';

type Slots = (ReferenceSlotValue | null)[];
type Upload = { slotId: string; controller: AbortController };

/** The account-keyed workspace owns the state; every replacement retires that slot's upload. */
export function useImageReferenceSlotLifecycle(accountId: string | null) {
  const [referenceSlots, commitSlots] = useState<Slots>(() => Array(MAX_REFERENCE_SLOTS).fill(null));
  const slotsRef = useRef(referenceSlots);
  const uploads = useRef(new Map<number, Upload>());
  const mounted = useRef(true);
  const owner = useRef(accountId);
  owner.current = accountId;

  // Update intent synchronously, including two user actions in the same React batch.
  const setReferenceSlots: Dispatch<SetStateAction<Slots>> = useCallback((action) => {
    const next = typeof action === 'function' ? action(slotsRef.current) : action;
    slotsRef.current = next;
    for (const [index, upload] of uploads.current) {
      if (next[index]?.id !== upload.slotId || next[index]?.status !== 'uploading') {
        upload.controller.abort();
        uploads.current.delete(index);
      }
    }
    commitSlots(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const pending = uploads.current;
    return () => {
      mounted.current = false;
      for (const upload of pending.values()) upload.controller.abort();
      pending.clear();
      slotsRef.current.forEach(cleanupSlotPreview);
    };
  }, [accountId]);

  const beginUpload = useCallback((index: number, slotId: string) => {
    uploads.current.get(index)?.controller.abort();
    const controller = new AbortController();
    const upload = { slotId, controller };
    uploads.current.set(index, upload);
    return {
      signal: controller.signal,
      isCurrent: () => mounted.current && owner.current === accountId && !controller.signal.aborted
        && uploads.current.get(index) === upload && slotsRef.current[index]?.id === slotId,
      finish: () => {
        if (uploads.current.get(index) === upload) uploads.current.delete(index);
      },
    };
  }, [accountId]);

  return { referenceSlots, setReferenceSlots, beginUpload };
}
