import { useCallback, useLayoutEffect, useRef } from 'react';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';

/** One upload keeps its initiating account across preparation, session lookup and every part. */
export function useWorkspaceUploadOperation(
  accountScope: string | null | undefined,
  valid: () => boolean,
) {
  const pending = useRef(new Set<AbortController>());
  useLayoutEffect(() => {
    const operations = pending.current;
    return () => {
      operations.forEach((controller) => controller.abort());
      operations.clear();
    };
  }, [valid]);

  return useCallback(() => {
    const controller = new AbortController();
    const operations = pending.current;
    operations.add(controller);
    return {
      request: (input: RequestInfo | URL, init?: RequestInit) => {
        if (!valid()) controller.abort();
        return ownedAuthFetch(input, accountScope, {
          ...init,
          signal: controller.signal,
        });
      },
      // Cleanup may outlive the route, but can never switch to a new account.
      abortRequest: (input: RequestInfo | URL, init?: RequestInit) =>
        ownedAuthFetch(input, accountScope, {
          ...init,
          signal: AbortSignal.timeout(10_000),
        }),
      cancel: () => controller.abort(),
      finish: () => operations.delete(controller),
    };
  }, [accountScope, valid]);
}
