'use client';

import { useCallback, useRef, useState } from 'react';

export function usePlaylistAction(setError: (error: string) => void) {
  const [isPending, setIsPending] = useState(false);
  const busy = useRef(false);
  const runAction = useCallback(
    (action: () => void | Promise<void>) => {
      if (busy.current) return;
      busy.current = true;
      setIsPending(true);
      void Promise.resolve()
        .then(action)
        .catch(() => setError('Unable to complete the collection action.'))
        .finally(() => {
          busy.current = false;
          setIsPending(false);
        });
    },
    [setError]
  );
  return { isPending, busy, runAction };
}
