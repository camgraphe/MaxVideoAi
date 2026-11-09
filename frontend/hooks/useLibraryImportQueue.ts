'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createLibraryImportQueue } from '@/lib/library-import-queue';
/** Queue lifetime is the real owner/context, independent of an open presentation. */
export function useLibraryImportQueue(
  userId: string | undefined,
  context = 'library',
) {
  const owner = useRef<{
    key: string;
    queue: ReturnType<typeof createLibraryImportQueue>;
    mounted: boolean;
  }>();
  const key = JSON.stringify([userId, context]);
  if (!owner.current || owner.current.key !== key) {
    owner.current?.queue.retire();
    owner.current = {
      key,
      queue: createLibraryImportQueue({ userId: userId ?? '' }),
      mounted: false,
    };
  }
  const current = owner.current;
  useEffect(() => {
    current.mounted = true;
    return () => {
      current.mounted = false;
      queueMicrotask(() => {
        if (!current.mounted) current.queue.retire();
      });
    };
  }, [current]);
  const state = useSyncExternalStore(
    current.queue.subscribe,
    current.queue.getSnapshot,
    current.queue.getSnapshot,
  );
  return { queue: current.queue, state };
}
