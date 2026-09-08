'use client';

import { applyWorkspacePreparedSetup } from '../_lib/workspace-apply-prepared-setup';
import type { WorkspaceSavedModelSetup } from '../_lib/workspace-model-setups';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import {
  prepareWorkspaceModelCandidate,
  type WorkspaceModelSetup,
} from '../_lib/workspace-model-candidate';
import { buildWorkspacePreflightRequest } from '../_lib/workspace-preflight-request';
import {
  decodeWorkspaceModelSetups,
  encodeWorkspaceModelSetups,
  parseWorkspaceSavedModelSetup,
  serializeWorkspaceModelSetup,
  workspaceModelSetupSignature,
  workspaceModelSetupsKey,
  type WorkspaceModelSetupEntries,
  type WorkspaceModelSetupError,
} from '../_lib/workspace-model-setups';
import { workspaceModelReviewCopy } from '../_lib/workspace-model-review-copy';
import { revokeKlingAssetPreview } from '../_lib/workspace-assets';
import { useWorkspacePreflightQuote } from './useWorkspacePreflightQuote';
import { useWorkspaceModelAlternatives } from './useWorkspaceModelAlternatives';

type Setters = {
  [K in keyof WorkspaceModelSetup as `set${Capitalize<K>}`]: (
    value: WorkspaceModelSetup[K],
  ) => void;
};
export type WorkspaceModelReviewOptions = Omit<Setters, 'setForm'> & {
  recoverySetup?: WorkspaceSavedModelSetup | null;
  onRemoveRecovery?: () => void;
  authStatus: 'unknown' | 'refreshing' | 'authed' | 'loggedOut';
  onGuestEngineChange: (engineId: string) => void;
  onRequestAuth: () => void;
  onModelSwitchNotice: (message: string) => void;
  current: WorkspaceModelSetup | null;
  applyPreparedForm: (form: WorkspaceModelSetup['form']) => void;
  engines: EngineCaps[];
  locale: string;
  /** Only a confirmed authenticated account. Never pass last-known draft storageScope. */
  accountId: string | null;
  accessToken: string | null;
  memberTier: 'Member' | 'Plus' | 'Pro';
  disabledEngineReasons?: Record<string, string>;
  engineScores?: Record<string, number | null | undefined>;
};
type Selection = { engineId: string; saved?: WorkspaceModelSetup };
type Store = {
  scope: string | null;
  entries: WorkspaceModelSetupEntries;
  loaded: boolean;
  error?: WorkspaceModelSetupError;
  memoryOnly: boolean;
};

function setupPreviewUrls(setup: WorkspaceModelSetup) {
  const assets = [
    ...Object.values(setup.inputAssets).flat(),
    ...setup.klingElements.flatMap((element) => [
      element.frontal,
      element.video,
      ...element.references,
    ]),
  ];
  return new Set(assets.flatMap((asset) => (asset ? [asset.previewUrl] : [])));
}

export function useWorkspaceModelReview(options: WorkspaceModelReviewOptions) {
  const {
    current,
    engines,
    locale,
    accountId,
    accessToken,
    memberTier,
    authStatus,
    onGuestEngineChange,
    onRequestAuth,
    onModelSwitchNotice,
  } = options;
  const eligibleAccount = authStatus === 'authed' && accountId && accessToken ? accountId : null;
  const waitingForAccount = !eligibleAccount && authStatus !== 'loggedOut';
  const selectorDisabledReasons = waitingForAccount
    ? Object.fromEntries(
        engines.map((engine) => [engine.id, workspaceModelReviewCopy(locale).authPending]),
      )
    : options.disabledEngineReasons;
  const [store, setStore] = useState<Store>({
    scope: eligibleAccount,
    entries: {},
    loaded: false,
    memoryOnly: false,
  });
  const [panel, setPanel] = useState<'compare' | 'saved' | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<WorkspaceModelSetupError | 'account' | null>(null);
  const [authScope, setAuthScope] = useState({
    accountId: eligibleAccount,
    accessToken,
    authStatus,
  });
  const scopeMatches =
    authScope.accountId === eligibleAccount &&
    authScope.accessToken === accessToken &&
    authScope.authStatus === authStatus;
  if (!scopeMatches) {
    setAuthScope({ accountId: eligibleAccount, accessToken, authStatus });
    setPanel(null);
    setSelection(null);
    setError(null);
    // Pending auth masks the last confirmed store without losing its memory-only snapshots.
    // Only a confirmed replacement account or logout retires that store.
    if (!waitingForAccount && store.scope !== eligibleAccount)
      setStore({
        scope: eligibleAccount,
        entries: {},
        loaded: false,
        memoryOnly: false,
      });
  }
  const signature = workspaceModelSetupSignature(current);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const latest = useRef({ authScope, signature, selection, options, store });
  latest.current = { authScope, signature, selection, options, store };
  const active = scopeMatches && store.scope === eligibleAccount;
  useEffect(() => {
    if (!eligibleAccount || store.scope !== eligibleAccount || store.loaded) return;
    let next: Store;
    try {
      next = {
        ...store,
        ...decodeWorkspaceModelSetups(
          sessionStorage.getItem(workspaceModelSetupsKey(eligibleAccount)),
          eligibleAccount,
        ),
        loaded: true,
      };
    } catch {
      next = { ...store, loaded: true, memoryOnly: true };
    }
    setStore(next);
  }, [eligibleAccount, store]);
  const target =
    active && selection
      ? engines.find(
          (engine) => engine.id === selection.engineId && engine.availability !== 'paused',
        )
      : null;
  const candidate = useMemo(
    () =>
      current && target
        ? prepareWorkspaceModelCandidate({
            engine: target,
            current,
            locale,
            currentEngine: engines.find((engine) => engine.id === current.form.engineId),
            restoreSetup: selection?.saved,
          })
        : null,
    [current, target, locale, engines, selection],
  );
  const configurationOnly = Boolean(
    candidate?.blockingReasons.length &&
      candidate.blockingReasons.every(
        (reason) =>
          reason.scope === 'generation' &&
          (reason.code === 'missing-input' || reason.code === 'invalid-input'),
      ),
  );
  const request =
    candidate && target && candidate.applicable && !candidate.blockingReasons.length
      ? buildWorkspacePreflightRequest({
          form: candidate.setup.form,
          selectedEngine: target,
          submissionMode: candidate.workflow.submissionMode,
          effectiveDurationSec: candidate.effectiveDurationSec,
          supportsAudioToggle: candidate.supportsAudioToggle,
          voiceControlEnabled: candidate.voiceControlEnabled,
          inputAssets: candidate.setup.inputAssets,
          memberTier,
        })
      : null;
  const quote = useWorkspacePreflightQuote({
    request,
    iterations: candidate?.setup.form.iterations ?? 1,
    accessToken: eligibleAccount ? accessToken : null,
    authChecked: Boolean(eligibleAccount),
  });
  const alternatives = useWorkspaceModelAlternatives({
    enabled: active && panel === 'compare' && !selection,
    current,
    engines,
    locale,
    memberTier,
    disabledEngineReasons: options.disabledEngineReasons,
    engineScores: options.engineScores,
    accessToken: eligibleAccount ? accessToken : null,
  });
  const latestQuote = useRef(quote.preflight);
  latestQuote.current = quote.preflight;
  const validScope = useCallback(
    () => mounted.current && latest.current.authScope === authScope && Boolean(eligibleAccount),
    [authScope, eligibleAccount],
  );
  const close = useCallback(() => {
    if (!validScope()) return;
    setPanel(null);
    latest.current.selection = null;
    setSelection(null);
    setError(null);
  }, [validScope]);
  const requestModel = useCallback(
    (engineId: string) => {
      if (!mounted.current || latest.current.authScope !== authScope) return;
      if (authStatus === 'loggedOut') {
        if (
          engines.some((engine) => engine.id === engineId && engine.availability !== 'paused') &&
          !options.disabledEngineReasons?.[engineId]
        )
          onGuestEngineChange(engineId);
        return;
      }
      if (!validScope()) return;
      if (latest.current.options.current?.form.engineId === engineId) {
        setPanel(null);
        latest.current.selection = null;
        setSelection(null);
        return;
      }
      if (
        !engines.some((engine) => engine.id === engineId && engine.availability !== 'paused') ||
        options.disabledEngineReasons?.[engineId]
      )
        return;
      latest.current.selection = { engineId };
      setSelection(latest.current.selection);
      setPanel('compare');
      setError(null);
    },
    [
      validScope,
      engines,
      options.disabledEngineReasons,
      onGuestEngineChange,
      authScope,
      authStatus,
    ],
  );
  const open = useCallback(
    (next: 'compare' | 'saved') => {
      if (!mounted.current || latest.current.authScope !== authScope) return;
      if (authStatus === 'loggedOut') {
        onRequestAuth();
        return;
      }
      if (!validScope()) return;
      setPanel(next);
      latest.current.selection = null;
      setSelection(null);
      setError(null);
    },
    [validScope, authScope, authStatus, onRequestAuth],
  );
  const savedSetups = useMemo(
    () =>
      active && store.loaded
        ? Object.entries({
            ...store.entries,
            ...(options.recoverySetup
              ? { [options.recoverySetup.modelId]: options.recoverySetup }
              : {}),
          }).map(([modelId, value]) => ({
            modelId,
            saved: parseWorkspaceSavedModelSetup(value, modelId),
            engine: engines.find((engine) => engine.id === modelId),
          }))
        : [],
    [active, store.loaded, store.entries, engines, options.recoverySetup],
  );
  const selectSavedSetup = useCallback(
    (modelId: string) => {
      if (!validScope()) return;
      const saved = parseWorkspaceSavedModelSetup(
        latest.current.options.recoverySetup?.modelId === modelId
          ? latest.current.options.recoverySetup
          : latest.current.store.entries[modelId],
        modelId,
      );
      if (
        !saved ||
        !engines.some((engine) => engine.id === modelId && engine.availability !== 'paused') ||
        options.disabledEngineReasons?.[modelId]
      )
        return;
      latest.current.selection = { engineId: modelId, saved: saved.setup };
      setSelection(latest.current.selection);
      setPanel('compare');
      setError(null);
    },
    [validScope, engines, options.disabledEngineReasons],
  );
  const persist = (entries: WorkspaceModelSetupEntries) => {
    if (!validScope() || !eligibleAccount) return false;
    const encoded = encodeWorkspaceModelSetups(eligibleAccount, entries);
    if (!encoded.ok) {
      setError(encoded.error);
      return false;
    }
    // A failed read does not authorize overwriting a record we could not inspect.
    // Once storage fails, retain this account's complete working store in page memory.
    let memoryOnly = latest.current.store.memoryOnly;
    if (!memoryOnly) {
      try {
        sessionStorage.setItem(workspaceModelSetupsKey(eligibleAccount), encoded.value);
      } catch {
        memoryOnly = true;
      }
    }
    const next = { scope: eligibleAccount, entries, loaded: true, memoryOnly };
    latest.current.store = next;
    setStore(next);
    setError(null);
    return true;
  };
  const removeSavedSetup = (modelId: string) => {
    if (!validScope()) return;
    if (latest.current.options.recoverySetup?.modelId === modelId) {
      latest.current.options.onRemoveRecovery?.();
      return;
    }
    const entries = { ...latest.current.store.entries };
    delete entries[modelId];
    persist(entries);
  };
  const clearUnreadableStore = () => {
    if (validScope() && latest.current.store.error) persist({});
  };
  const commitPreparedSetup = (
    source: WorkspaceModelSetup,
    prepared: WorkspaceModelSetup,
  ) => {
    const snapshot = serializeWorkspaceModelSetup(source);
    if (!snapshot.ok) {
      setError(snapshot.error);
      return false;
    }
    const committed = structuredClone(prepared);
    if (
      !persist({
        ...latest.current.store.entries,
        [source.form.engineId]: {
          modelId: source.form.engineId,
          updatedAt: Date.now(),
          setup: snapshot.setup,
        },
      })
    )
      return false;
    // All owners receive the already prepared values in the same React event, before schema effects run.
    applyWorkspacePreparedSetup(committed, {
      ...latest.current.options,
      setForm: latest.current.options.applyPreparedForm,
    });
    // The snapshot has durable originals. Release only temporary previews no longer used by the live setup.
    const retainedPreviews = setupPreviewUrls(committed);
    for (const previewUrl of setupPreviewUrls(source)) {
      if (!retainedPreviews.has(previewUrl)) revokeKlingAssetPreview({ previewUrl });
    }
    latest.current.selection = null;
    setPanel(null);
    setSelection(null);
    return true;
  };
  const switchModel = (engineId: string) => {
    if (!mounted.current || latest.current.authScope !== authScope) return;
    const engine = engines.find(
      (entry) => entry.id === engineId && entry.availability !== 'paused',
    );
    if (!engine || options.disabledEngineReasons?.[engineId]) return;
    if (authStatus === 'loggedOut') {
      onGuestEngineChange(engineId);
      return;
    }
    if (!validScope()) return;
    const source = latest.current.options.current;
    if (!source || source.form.engineId === engineId) {
      setPanel(null);
      latest.current.selection = null;
      setSelection(null);
      return;
    }
    if (!latest.current.store.loaded || latest.current.store.error) {
      const key = latest.current.store.error ?? 'incomplete';
      setError(key);
      onModelSwitchNotice(workspaceModelReviewCopy(locale)[key]);
      return;
    }
    const prepared = prepareWorkspaceModelCandidate({
      engine,
      current: source,
      locale,
      currentEngine: engines.find((entry) => entry.id === source.form.engineId),
    });
    const blockingReason = prepared.blockingReasons.find(({ scope }) => scope === 'apply');
    if (!prepared.applicable || blockingReason) {
      onModelSwitchNotice(
        blockingReason
          ? workspaceModelReviewCopy(locale).reasons[blockingReason.code]
          : workspaceModelReviewCopy(locale).incomplete,
      );
      return;
    }
    if (!commitPreparedSetup(source, prepared.setup)) {
      onModelSwitchNotice(workspaceModelReviewCopy(locale).incomplete);
      return;
    }
    if (prepared.removedReferences.length)
      onModelSwitchNotice(
        workspaceModelReviewCopy(locale).switchPreserved(prepared.removedReferences.length),
      );
  };
  const canApply = Boolean(
    active &&
      eligibleAccount &&
      store.loaded &&
      !store.error &&
      current &&
      candidate?.applicable &&
      !options.disabledEngineReasons?.[target?.id ?? ''] &&
      (configurationOnly || (!candidate.blockingReasons.length && quote.preflight)),
  );
  const apply = () => {
    // Reject closures from a replaced account, source draft, target, or quote observation.
    if (
      !validScope() ||
      latest.current.signature !== signature ||
      latest.current.selection !== selection ||
      latestQuote.current !== quote.preflight ||
      !canApply ||
      !current ||
      !candidate
    )
      return;
    commitPreparedSetup(current, candidate.setup);
  };
  // Captured quote retries are guarded too; the quote hook creates a fresh scoped observation.
  const retry = () => {
    if (
      validScope() &&
      latest.current.signature === signature &&
      latest.current.selection === selection
    ) {
      latestQuote.current = null;
      quote.retry();
    }
  };
  return {
    panel: active ? panel : null,
    candidate: active ? candidate : null,
    target,
    current,
    quote,
    configurationOnly,
    canApply,
    requestModel,
    switchModel,
    close,
    apply,
    selectSavedSetup,
    removeSavedSetup,
    clearUnreadableStore,
    open,
    retry,
    alternatives,
    savedSetups,
    error: active ? (error ?? store.error) : null,
    storageError: active ? store.error : undefined,
    memoryOnly: active && store.memoryOnly,
    available: Boolean(eligibleAccount && active),
    disabledEngineReasons: options.disabledEngineReasons,
    selectorDisabledReasons,
    waitingForAccount,
    commandsAvailable: !waitingForAccount,
  };
}
