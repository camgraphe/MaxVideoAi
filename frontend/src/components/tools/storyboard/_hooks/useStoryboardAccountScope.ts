import { useCallback, useLayoutEffect, useRef } from 'react';

export type StoryboardAccountRequest = {
  accessToken: string;
  signal: AbortSignal;
  isCurrent(): boolean;
};
export type CaptureStoryboardAccountRequest = () => StoryboardAccountRequest | null;

/** The account-keyed workspace owns the lifetime; token refresh keeps its current draft. */
export function useStoryboardAccountScope(accessToken: string | null): CaptureStoryboardAccountRequest {
  const tokenRef = useRef(accessToken);
  const controllerRef = useRef<AbortController | null>(null);
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
    const token = tokenRef.current;
    if (!token || !controller || controller.signal.aborted) return null;
    return {
      accessToken: token,
      signal: controller.signal,
      isCurrent: () => controllerRef.current === controller && !controller.signal.aborted,
    };
  }, []);
}
