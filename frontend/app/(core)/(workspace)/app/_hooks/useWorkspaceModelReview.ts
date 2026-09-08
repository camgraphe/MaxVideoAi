'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import { prepareWorkspaceModelCandidate, type WorkspaceModelSetup } from '../_lib/workspace-model-candidate';
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

type Setters = {
  [K in keyof WorkspaceModelSetup as `set${Capitalize<K>}`]: (value: WorkspaceModelSetup[K]) => void;
};
export type WorkspaceModelReviewOptions = Omit<Setters, 'setForm'> & {
  authStatus: 'unknown' | 'refreshing' | 'authed' | 'loggedOut';
  onGuestEngineChange: (engineId: string) => void;
  onRequestAuth: () => void;
  current: WorkspaceModelSetup | null;
  applyPreparedForm: (form: WorkspaceModelSetup['form']) => void;
  engines: EngineCaps[];
  locale: string;
  /** Only a confirmed authenticated account. Never pass last-known draft storageScope. */
  accountId: string | null;
  accessToken: string | null;
  memberTier: 'Member' | 'Plus' | 'Pro';
  disabledEngineReasons?: Record<string, string>;
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
    ...setup.klingElements.flatMap((element) => [element.frontal, element.video, ...element.references]),
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
  } = options;
  const eligibleAccount = authStatus === 'authed' && accountId && accessToken ? accountId : null;
  const waitingForAccount = !eligibleAccount && authStatus !== 'loggedOut';
  const selectorDisabledReasons = waitingForAccount
    ? Object.fromEntries(engines.map((engine) => [engine.id, workspaceModelReviewCopy(locale).authPending]))
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
  const [authScope, setAuthScope] = useState({ accountId: eligibleAccount, accessToken, authStatus });
  const scopeMatches =
    authScope.accountId === eligibleAccount &&
    authScope.accessToken === accessToken &&
    authScope.authStatus === authStatus;
  if (!scopeMatches) {
    setAuthScope({ accountId: eligibleAccount, accessToken, authStatus });
    setPanel(null);
    setSelection(null);
    setError(null);
    if (store.scope !== eligibleAccount)
      setStore({ scope: eligibleAccount, entries: {}, loaded: false, memoryOnly: false });
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
      ? engines.find((engine) => engine.id === selection.engineId && engine.availability !== 'paused')
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
    [validScope, engines, options.disabledEngineReasons, onGuestEngineChange, authScope, authStatus],
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
        ? Object.entries(store.entries).map(([modelId, value]) => ({
            modelId,
            saved: parseWorkspaceSavedModelSetup(value, modelId),
            engine: engines.find((engine) => engine.id === modelId),
          }))
        : [],
    [active, store.loaded, store.entries, engines],
  );
  const selectSavedSetup = useCallback(
    (modelId: string) => {
      if (!validScope()) return;
      const saved = parseWorkspaceSavedModelSetup(latest.current.store.entries[modelId], modelId);
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
    const entries = { ...latest.current.store.entries };
    delete entries[modelId];
    persist(entries);
  };
  const clearUnreadableStore = () => {
    if (validScope() && latest.current.store.error) persist({});
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
    const snapshot = serializeWorkspaceModelSetup(current);
    if (!snapshot.ok) {
      setError(snapshot.error);
      return;
    }
    const committed = structuredClone(candidate.setup);
    if (
      !persist({
        ...latest.current.store.entries,
        [current.form.engineId]: {
          modelId: current.form.engineId,
          updatedAt: Date.now(),
          setup: snapshot.setup,
        },
      })
    )
      return;
    // All owners receive the already prepared values in the same React event, before schema effects run.
    options.setInputAssets(committed.inputAssets);
    options.setKlingElements(committed.klingElements);
    options.setPrompt(committed.prompt);
    options.setNegativePrompt(committed.negativePrompt);
    options.setMultiPromptEnabled(committed.multiPromptEnabled);
    options.setMultiPromptScenes(committed.multiPromptScenes);
    options.setShotType(committed.shotType);
    options.setVoiceIdsInput(committed.voiceIdsInput);
    options.setCfgScale(committed.cfgScale);
    options.applyPreparedForm(committed.form);
    // The snapshot has durable originals. Release only temporary previews no longer used by the live setup.
    const retainedPreviews = setupPreviewUrls(committed);
    for (const previewUrl of setupPreviewUrls(current)) {
      if (!retainedPreviews.has(previewUrl)) revokeKlingAssetPreview({ previewUrl });
    }
    latest.current.selection = null;
    setPanel(null);
    setSelection(null);
  };
  // Captured quote retries are guarded too; the quote hook creates a fresh scoped observation.
  const retry = () => {
    if (validScope() && latest.current.signature === signature && latest.current.selection === selection) {
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
    close,
    apply,
    selectSavedSetup,
    removeSavedSetup,
    clearUnreadableStore,
    open,
    retry,
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
