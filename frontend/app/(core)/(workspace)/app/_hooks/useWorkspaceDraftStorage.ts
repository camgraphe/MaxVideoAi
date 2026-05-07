import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { readLastKnownUserId } from '@/lib/last-known';
import type { Mode } from '@/types/engines';
import {
  consumeWorkspaceOnboardingSkipIntent,
  resolveWorkspaceRequestParams,
} from '../_lib/workspace-hydration';
import {
  readScopedWorkspaceStorage,
  readWorkspaceStorage,
  writeScopedWorkspaceStorage,
  writeWorkspaceStorage,
} from '../_lib/workspace-storage';

type UseWorkspaceDraftStorageOptions = {
  authLoading: boolean;
  authStatus: string;
  authenticatedUserId?: string | null;
};

type UseWorkspaceDraftStorageResult = {
  authChecked: boolean;
  storageScope: string;
  hydratedForScope: string | null;
  setHydratedForScope: Dispatch<SetStateAction<string | null>>;
  readScopedStorage: (base: string) => string | null;
  readStorage: (base: string) => string | null;
  writeScopedStorage: (base: string, value: string | null) => void;
  writeStorage: (base: string, value: string | null) => void;
  fromVideoId: string | null;
  requestedJobId: string | null;
  resolvedRequestedEngineId: string | null;
  requestedEngineToken: string;
  requestedMode: Mode | null;
  searchString: string;
  loginRedirectTarget: string;
  effectiveRequestedEngineId: string | null;
  effectiveRequestedEngineToken: string;
  effectiveRequestedMode: Mode | null;
  skipOnboardingRef: MutableRefObject<boolean>;
  preserveStoredDraftRef: MutableRefObject<boolean>;
  hasStoredFormRef: MutableRefObject<boolean>;
  requestedEngineOverrideIdRef: MutableRefObject<string | null>;
  requestedEngineOverrideTokenRef: MutableRefObject<string | null>;
  requestedModeOverrideRef: MutableRefObject<Mode | null>;
};

export function useWorkspaceDraftStorage({
  authLoading,
  authStatus,
  authenticatedUserId,
}: UseWorkspaceDraftStorageOptions): UseWorkspaceDraftStorageResult {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hydratedForScope, setHydratedForScope] = useState<string | null>(null);

  const storageScope = useMemo(() => userId ?? 'anon', [userId]);
  const readScopedStorage = useCallback(
    (base: string): string | null => readScopedWorkspaceStorage(base, storageScope),
    [storageScope]
  );
  const readStorage = useCallback(
    (base: string): string | null => readWorkspaceStorage(base, storageScope),
    [storageScope]
  );
  const writeScopedStorage = useCallback(
    (base: string, value: string | null) => {
      writeScopedWorkspaceStorage(base, storageScope, value);
    },
    [storageScope]
  );
  const writeStorage = useCallback(
    (base: string, value: string | null) => {
      writeWorkspaceStorage(base, storageScope, value);
    },
    [storageScope]
  );

  const workspaceRequest = useMemo(
    () => resolveWorkspaceRequestParams(searchParams, pathname),
    [pathname, searchParams]
  );
  const {
    fromVideoId,
    requestedJobId,
    resolvedRequestedEngineId,
    requestedEngineToken,
    requestedMode,
    searchString,
    loginRedirectTarget,
  } = workspaceRequest;

  const skipOnboardingRef = useRef<boolean>(false);
  const preserveStoredDraftRef = useRef<boolean>(false);
  const hasStoredFormRef = useRef<boolean>(false);
  const requestedEngineOverrideIdRef = useRef<string | null>(null);
  const requestedEngineOverrideTokenRef = useRef<string | null>(null);
  const requestedModeOverrideRef = useRef<Mode | null>(null);

  useEffect(() => {
    if (!resolvedRequestedEngineId) return;
    requestedEngineOverrideIdRef.current = resolvedRequestedEngineId;
    requestedEngineOverrideTokenRef.current = requestedEngineToken;
    requestedModeOverrideRef.current = requestedMode;
  }, [resolvedRequestedEngineId, requestedEngineToken, requestedMode]);

  const effectiveRequestedEngineId = resolvedRequestedEngineId ?? requestedEngineOverrideIdRef.current;
  const effectiveRequestedEngineToken = requestedEngineToken ?? requestedEngineOverrideTokenRef.current;
  const effectiveRequestedMode = requestedMode ?? requestedModeOverrideRef.current;

  useEffect(() => {
    const skipIntent = consumeWorkspaceOnboardingSkipIntent(fromVideoId);
    if (skipIntent.shouldSkip) {
      skipOnboardingRef.current = true;
    }
    if (process.env.NODE_ENV !== 'production') {
      if (skipIntent.skippedViaFlag) {
        console.log('[app] skip onboarding via flag');
      }
      if (skipIntent.lastTarget) {
        console.log('[app] read last target', {
          lastTarget: skipIntent.lastTarget,
          shouldSkip: skipIntent.lastTargetShouldSkip,
        });
      }
      if (skipIntent.fromVideoId) {
        console.log('[app] skip onboarding due to fromVideoId', { fromVideoId: skipIntent.fromVideoId });
      }
    }
  }, [fromVideoId]);

  useEffect(() => {
    if (authLoading) return;
    if (authenticatedUserId) {
      setUserId(authenticatedUserId);
      setAuthChecked(true);
      return;
    }
    if (authStatus === 'refreshing' || authStatus === 'unknown') {
      const lastKnownUserId = readLastKnownUserId();
      setUserId(lastKnownUserId ?? null);
      setAuthChecked(true);
      return;
    }
    setUserId(null);
    setAuthChecked(true);
  }, [authLoading, authStatus, authenticatedUserId]);

  return {
    authChecked,
    storageScope,
    hydratedForScope,
    setHydratedForScope,
    readScopedStorage,
    readStorage,
    writeScopedStorage,
    writeStorage,
    fromVideoId,
    requestedJobId,
    resolvedRequestedEngineId,
    requestedEngineToken,
    requestedMode,
    searchString,
    loginRedirectTarget,
    effectiveRequestedEngineId,
    effectiveRequestedEngineToken,
    effectiveRequestedMode,
    skipOnboardingRef,
    preserveStoredDraftRef,
    hasStoredFormRef,
    requestedEngineOverrideIdRef,
    requestedEngineOverrideTokenRef,
    requestedModeOverrideRef,
  };
}
