'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import {
  prepareWorkspaceModelCandidate,
  type WorkspaceModelSetup,
} from '../_lib/workspace-model-candidate';
import {
  serializeWorkspaceModelSetup,
  workspaceModelSetupSignature,
  type WorkspaceModelSetupError,
} from '../_lib/workspace-model-setups';
import {
  decodeWorkspaceActiveDraft,
  encodeWorkspaceActiveDraft,
  workspaceActiveDraftKey,
  type WorkspaceActiveDraftRecord,
} from '../_lib/workspace-active-draft';
import {
  applyWorkspacePreparedSetup,
  type WorkspaceSetupSetters,
} from '../_lib/workspace-apply-prepared-setup';
import { useWorkspaceAssetLifetime } from './useWorkspaceAssetLifetime';

type Status = WorkspaceModelSetupError | 'unavailable' | 'retired' | null;
type Store = WorkspaceActiveDraftRecord & {
  account: string | null;
  loaded: boolean;
  memoryOnly: boolean;
  error: Status;
};
// Bounded fallback: only the last confirmed account, for this document/module lifetime.
// It survives route unmounts, never a reload, logout, or a different confirmed account.
let memory: Store | null = null;
export type WorkspaceActiveDraftOptions = WorkspaceSetupSetters & {
  authStatus: string;
  accountId: string | null;
  accessToken: string | null;
  current: WorkspaceModelSetup | null;
  engines: EngineCaps[];
  locale: string;
  requestKey: string;
  legacyReady: boolean;
  storageReady: boolean;
  markLegacyReady: () => void;
};
export function useWorkspaceActiveDraft(options: WorkspaceActiveDraftOptions) {
  const account =
    options.authStatus === 'authed' && options.accountId && options.accessToken
      ? options.accountId
      : null;
  const valid = useWorkspaceAssetLifetime(account);
  const [store, setStore] = useState<Store>({
    account,
    loaded: false,
    current: null,
    recovery: null,
    memoryOnly: false,
    error: null,
  });
  const [phase, setPhase] = useState<{
    account: string | null;
    requestKey: string;
    generation: () => boolean;
    stage: 'commit' | 'ready';
    restored: boolean;
  } | null>(null);
  const [saveError, setSaveError] = useState<Status>(null);
  const storeRef = useRef(store);
  storeRef.current = store;
  const phaseMatches =
    phase?.account === account &&
    phase?.generation === valid &&
    phase?.requestKey === options.requestKey;
  const ready = Boolean(
    account && store.account === account && phaseMatches && phase?.stage === 'ready',
  );
  const signature = workspaceModelSetupSignature(options.current);

  const save = useCallback(
    (next: Store) => {
      const encoded = encodeWorkspaceActiveDraft(next, account!);
      if (!encoded.ok) {
        setSaveError(encoded.error);
        return false;
      }
      let memoryOnly = next.memoryOnly;
      if (!memoryOnly) {
        try {
          sessionStorage.setItem(workspaceActiveDraftKey(account!), encoded.value);
        } catch {
          memoryOnly = true;
        }
      }
      const committed = { ...next, memoryOnly };
      memory = committed;
      storeRef.current = committed;
      setStore(committed);
      return true;
    },
    [account],
  );

  useLayoutEffect(() => {
    if (options.authStatus === 'loggedOut' || (account && memory?.account !== account))
      memory = null;
    if (options.authStatus === 'loggedOut' && storeRef.current.account !== null) {
      const cleared: Store = {
        account: null,
        loaded: false,
        current: null,
        recovery: null,
        memoryOnly: false,
        error: null,
      };
      storeRef.current = cleared;
      setStore(cleared);
      setPhase(null);
    }
    if (!account || !options.engines.length || !options.storageReady) return;
    if (phaseMatches) return;
    let loaded = storeRef.current;
    if (loaded.account !== account || !loaded.loaded) {
      if (memory?.account === account) loaded = memory;
      else {
        loaded = {
          account,
          loaded: true,
          current: null,
          recovery: null,
          memoryOnly: false,
          error: null,
        };
        try {
          loaded = {
            ...loaded,
            ...decodeWorkspaceActiveDraft(
              sessionStorage.getItem(workspaceActiveDraftKey(account)),
              account,
            ),
          };
        } catch {
          loaded.memoryOnly = true;
        }
      }
    }
    let restored = false;
    if (loaded.current && options.requestKey) {
      // Retain the displaced setup before any explicit-request owner can write a replacement.
      loaded = { ...loaded, recovery: loaded.current };
      save(loaded);
    } else if (loaded.current && !options.requestKey) {
      const saved = loaded.current.setup;
      const engine = options.engines.find(
        (e) => e.id === saved.form.engineId && e.availability !== 'paused',
      );
      const candidate = engine
        ? prepareWorkspaceModelCandidate({
            engine,
            current: saved,
            currentEngine: engine,
            restoreSetup: saved,
            locale: options.locale,
          })
        : null;
      if (candidate?.applicable) {
        // Same-model restoration preserves every authored field and sparse slot; validation
        // rejects roles that no longer fit instead of silently migrating them to another model.
        applyWorkspacePreparedSetup(saved, options);
        options.markLegacyReady();
        restored = true;
      } else {
        const rejected: Store = {
          ...loaded,
          current: null,
          recovery: loaded.current,
          error: engine ? 'invalid' : 'retired',
        };
        loaded = save(rejected) ? storeRef.current : rejected;
      }
    }
    storeRef.current = loaded;
    setStore(loaded);
    setSaveError(null);
    setPhase({
      account,
      requestKey: options.requestKey,
      generation: valid,
      stage: 'commit',
      restored,
    });
  }, [options, account, phaseMatches, valid, save]);
  useLayoutEffect(() => {
    if (
      !account ||
      !phaseMatches ||
      phase?.stage !== 'commit' ||
      !options.current ||
      !options.legacyReady
    )
      return;
    setPhase({ ...phase, stage: 'ready' });
  }, [account, phaseMatches, phase, options]);
  useLayoutEffect(() => {
    if (!ready || !valid() || !options.current || store.error) return;
    const serialized = serializeWorkspaceModelSetup(options.current);
    if (!serialized.ok) {
      setSaveError(serialized.error);
      return;
    }
    const next = {
      ...store,
      current: {
        modelId: serialized.setup.form.engineId,
        updatedAt: Date.now(),
        setup: serialized.setup,
      },
    };
    // No debounce: a committed final edit is saved before route-unmount cleanup.
    if (JSON.stringify(store.current?.setup) !== JSON.stringify(serialized.setup)) {
      if (!save(next)) return;
    }
    setSaveError(null);
  }, [ready, valid, signature, store, options, save]);
  const removeRecovery = () => {
    if (!valid()) return;
    save({ ...storeRef.current, recovery: null });
  };
  const discardRejected = () => {
    if (!valid()) return;
    const next = { ...storeRef.current, error: null };
    if (save(next)) setSaveError(null);
  };
  return {
    revision: signature,
    ready: account ? ready : options.authStatus === 'loggedOut' && options.legacyReady,
    allowLegacy: !account
      ? options.authStatus === 'loggedOut'
      : Boolean(phaseMatches && !phase?.restored),
    loaded: Boolean(account && store.account === account && store.loaded && phaseMatches),
    hasActiveSetup: Boolean(account && store.account === account && store.current),
    recoverySetup: account && store.account === account ? store.recovery : null,
    error: account && store.account === account ? (saveError ?? store.error) : null,
    memoryOnly: Boolean(account && store.account === account && store.memoryOnly),
    discardRejected,
    removeRecovery,
  };
}
