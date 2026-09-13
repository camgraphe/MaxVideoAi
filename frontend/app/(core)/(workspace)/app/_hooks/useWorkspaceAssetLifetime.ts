import { useCallback, useLayoutEffect, useRef } from 'react';

/** A captured command belongs to one confirmed account generation and one mount. */
export function useWorkspaceAssetLifetime(accountScope: string | null = 'legacy') {
  const current = useRef({ accountScope });
  if (current.current.accountScope !== accountScope) current.current = { accountScope };
  const generation = current.current;
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(
    () => mounted.current && current.current === generation && accountScope !== null,
    [accountScope, generation],
  );
}
