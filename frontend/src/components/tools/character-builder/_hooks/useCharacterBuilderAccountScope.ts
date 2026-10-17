import { useCallback, useLayoutEffect, useRef } from 'react';

import type { CaptureCharacterBuilderAccountRequest } from '../_lib/character-builder-types';

/** The account-keyed workspace owns this lifetime; token refresh does not discard a draft. */
export function useCharacterBuilderAccountScope(accessToken: string | null): CaptureCharacterBuilderAccountRequest {
  const controllerRef = useRef<AbortController | null>(null);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  useLayoutEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => {
      controller.abort();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, []);
  return useCallback(() => {
    const controller = controllerRef.current;
    const currentToken = tokenRef.current;
    if (!currentToken || !controller || controller.signal.aborted) return null;
    return {
      accessToken: currentToken,
      signal: controller.signal,
      isCurrent: () => controllerRef.current === controller && !controller.signal.aborted,
    };
  }, []);
}
