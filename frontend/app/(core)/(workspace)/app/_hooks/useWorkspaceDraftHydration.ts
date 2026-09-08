import { useWorkspaceActiveDraft } from './useWorkspaceActiveDraft';
import type { WorkspaceModelSetup } from '../_lib/workspace-model-candidate';
import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { MultiPromptScene } from '@/components/Composer';
import type { SelectedVideoPreview } from '@/lib/video-preview-group';
import type { EngineCaps, Mode } from '@/types/engines';
import type { Job } from '@/types/jobs';
import { DEFAULT_PROMPT } from '../_lib/workspace-client-helpers';
import type { FormState } from '../_lib/workspace-form-state';
import {
  buildInitialWorkspaceFormState,
  parseStoredMultiPromptScenes,
  readStoredWorkspaceForm,
} from '../_lib/workspace-hydration';
import { createLocalId, createMultiPromptScene } from '../_lib/workspace-input-helpers';
import { STORAGE_KEYS } from '../_lib/workspace-storage';

type ShotType = 'customize' | 'intelligent';
type MemberTier = 'Member' | 'Plus' | 'Pro';

type UseWorkspaceDraftHydrationOptions = {
  authStatus: string;
  accountId: string | null;
  accessToken: string | null;
  locale: string;
  inputAssets: WorkspaceModelSetup['inputAssets'];
  klingElements: WorkspaceModelSetup['klingElements'];
  cfgScale: WorkspaceModelSetup['cfgScale'];
  setInputAssets: Dispatch<SetStateAction<WorkspaceModelSetup['inputAssets']>>;
  setKlingElements: Dispatch<SetStateAction<WorkspaceModelSetup['klingElements']>>;
  setCfgScale: Dispatch<SetStateAction<WorkspaceModelSetup['cfgScale']>>;
  engines: EngineCaps[];
  requestedJobId: string | null;
  fromVideoId: string | null;
  effectiveRequestedEngineId: string | null;
  effectiveRequestedEngineToken: string;
  effectiveRequestedMode: Mode | null;
  storageScope: string;
  hydratedForScope: string | null;
  setHydratedForScope: Dispatch<SetStateAction<string | null>>;
  readStorage: (base: string) => string | null;
  readScopedStorage: (base: string) => string | null;
  writeStorage: (base: string, value: string | null) => void;
  form: FormState | null;
  prompt: string;
  negativePrompt: string;
  multiPromptEnabled: boolean;
  multiPromptScenes: MultiPromptScene[];
  shotType: ShotType;
  voiceIdsInput: string;
  memberTier: MemberTier;
  recentJobs: Job[];
  selectedPreview: SelectedVideoPreview | null;
  rendersLength: number;
  preserveStoredDraftRef: MutableRefObject<boolean>;
  hasStoredFormRef: MutableRefObject<boolean>;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  setNegativePrompt: Dispatch<SetStateAction<string>>;
  setMultiPromptEnabled: Dispatch<SetStateAction<boolean>>;
  setMultiPromptScenes: Dispatch<SetStateAction<MultiPromptScene[]>>;
  setShotType: Dispatch<SetStateAction<ShotType>>;
  setVoiceIdsInput: Dispatch<SetStateAction<string>>;
  setMemberTier: Dispatch<SetStateAction<MemberTier>>;
  setSelectedPreview: Dispatch<SetStateAction<SelectedVideoPreview | null>>;
  hydratePendingRendersFromStorage: (value: string | null) => void;
  resetRenderState: () => void;
};

export function useWorkspaceDraftHydration({
  authStatus,
  accountId,
  accessToken,
  locale,
  inputAssets,
  klingElements,
  cfgScale,
  setInputAssets,
  setKlingElements,
  setCfgScale,
  engines,
  requestedJobId,
  fromVideoId,
  effectiveRequestedEngineId,
  effectiveRequestedEngineToken,
  effectiveRequestedMode,
  storageScope,
  hydratedForScope,
  setHydratedForScope,
  readStorage,
  readScopedStorage,
  writeStorage,
  form,
  prompt,
  negativePrompt,
  multiPromptEnabled,
  multiPromptScenes,
  shotType,
  voiceIdsInput,
  memberTier,
  recentJobs,
  selectedPreview,
  rendersLength,
  preserveStoredDraftRef,
  hasStoredFormRef,
  setForm,
  setPrompt,
  setNegativePrompt,
  setMultiPromptEnabled,
  setMultiPromptScenes,
  setShotType,
  setVoiceIdsInput,
  setMemberTier,
  setSelectedPreview,
  hydratePendingRendersFromStorage,
  resetRenderState,
}: UseWorkspaceDraftHydrationOptions) {
  const activeDraft = useWorkspaceActiveDraft({
    authStatus,
    accountId,
    accessToken,
    locale,
    engines,
    current: form
      ? {
          form,
          inputAssets,
          klingElements,
          cfgScale,
          prompt,
          negativePrompt,
          multiPromptEnabled,
          multiPromptScenes,
          shotType,
          voiceIdsInput,
        }
      : null,
    setForm,
    setInputAssets,
    setKlingElements,
    setCfgScale,
    setPrompt,
    setNegativePrompt,
    setMultiPromptEnabled,
    setMultiPromptScenes,
    setShotType,
    setVoiceIdsInput,
    requestKey:
      requestedJobId ||
      fromVideoId ||
      effectiveRequestedEngineId ||
      effectiveRequestedEngineToken ||
      effectiveRequestedMode
        ? JSON.stringify([
            requestedJobId,
            fromVideoId,
            effectiveRequestedEngineId,
            effectiveRequestedEngineToken,
            effectiveRequestedMode,
          ])
        : '',
    storageReady: accountId === storageScope,
    legacyReady: hydratedForScope === storageScope,
    markLegacyReady: () => {
      hasStoredFormRef.current = true;
      preserveStoredDraftRef.current = false;
      setHydratedForScope(storageScope);
    },
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!engines.length) return;
    if (!activeDraft.allowLegacy || (authStatus === 'loggedOut' && storageScope !== 'anon')) return;
    if (hydratedForScope === storageScope && form) return;
    setHydratedForScope(null);

    resetRenderState();

    try {
      const promptValue = readStorage(STORAGE_KEYS.prompt);
      setPrompt(promptValue ?? DEFAULT_PROMPT);

      const negativeValue = readStorage(STORAGE_KEYS.negativePrompt);
      setNegativePrompt(negativeValue ?? '');

      const storedMultiPromptEnabled = readStorage(STORAGE_KEYS.multiPromptEnabled);
      setMultiPromptEnabled(storedMultiPromptEnabled === 'true');
      setMultiPromptScenes(
        parseStoredMultiPromptScenes(
          readStorage(STORAGE_KEYS.multiPromptScenes),
          createLocalId,
          createMultiPromptScene,
        ),
      );

      const storedShotType = readStorage(STORAGE_KEYS.shotType);
      if (storedShotType === 'customize' || storedShotType === 'intelligent') {
        setShotType(storedShotType);
      }
      const storedVoiceIds = readStorage(STORAGE_KEYS.voiceIds);
      if (typeof storedVoiceIds === 'string') {
        setVoiceIdsInput(storedVoiceIds);
      }

      const formValue = readStorage(STORAGE_KEYS.form);
      const initialForm = buildInitialWorkspaceFormState({
        engines,
        storedFormRaw: readStoredWorkspaceForm(storageScope, formValue),
        effectiveRequestedEngineId,
        effectiveRequestedEngineToken,
        effectiveRequestedMode,
      });
      preserveStoredDraftRef.current = initialForm.preserveStoredDraft;
      hasStoredFormRef.current = initialForm.hasStoredForm;
      if (initialForm.form) {
        setForm(initialForm.form);
      }
      if (initialForm.debugEngineOverride && process.env.NODE_ENV !== 'production') {
        console.log(
          '[generate] engine override from storage hydrate',
          initialForm.debugEngineOverride,
        );
      }
      if (initialForm.formToPersist) {
        const formToPersist = initialForm.formToPersist;
        queueMicrotask(() => {
          try {
            writeStorage(STORAGE_KEYS.form, JSON.stringify(formToPersist));
          } catch {
            // noop
          }
        });
      }

      const storedTier = readStorage(STORAGE_KEYS.memberTier);
      if (storedTier === 'Member' || storedTier === 'Plus' || storedTier === 'Pro') {
        setMemberTier(storedTier);
      }

      const pendingValue = readScopedStorage(STORAGE_KEYS.pendingRenders);
      hydratePendingRendersFromStorage(pendingValue);
    } catch {
      resetRenderState();
    } finally {
      setHydratedForScope(storageScope);
    }
  }, [
    activeDraft.allowLegacy,
    authStatus,
    form,
    engines,
    hydratePendingRendersFromStorage,
    readScopedStorage,
    readStorage,
    resetRenderState,
    writeStorage,
    setHydratedForScope,
    setMemberTier,
    storageScope,
    hydratedForScope,
    effectiveRequestedEngineId,
    effectiveRequestedMode,
    effectiveRequestedEngineToken,
    requestedJobId,
    preserveStoredDraftRef,
    hasStoredFormRef,
    setForm,
    setPrompt,
    setNegativePrompt,
    setMultiPromptEnabled,
    setMultiPromptScenes,
    setShotType,
    setVoiceIdsInput,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeDraft.ready) return;
    if (hydratedForScope !== storageScope) return;
    if (!form) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.form, JSON.stringify({ ...form, updatedAt: Date.now() }));
    } catch {
      // noop
    }
  }, [
    activeDraft.ready,
    form,
    hydratedForScope,
    storageScope,
    writeStorage,
    preserveStoredDraftRef,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeDraft.ready) return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.prompt, prompt);
    } catch {
      // noop
    }
  }, [
    activeDraft.ready,
    prompt,
    hydratedForScope,
    storageScope,
    writeStorage,
    preserveStoredDraftRef,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeDraft.ready) return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.negativePrompt, negativePrompt);
    } catch {
      // noop
    }
  }, [
    activeDraft.ready,
    negativePrompt,
    hydratedForScope,
    storageScope,
    writeStorage,
    preserveStoredDraftRef,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeDraft.ready) return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.multiPromptEnabled, multiPromptEnabled ? 'true' : 'false');
    } catch {
      // noop
    }
  }, [
    activeDraft.ready,
    multiPromptEnabled,
    hydratedForScope,
    storageScope,
    writeStorage,
    preserveStoredDraftRef,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeDraft.ready) return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.multiPromptScenes, JSON.stringify(multiPromptScenes));
    } catch {
      // noop
    }
  }, [
    activeDraft.ready,
    multiPromptScenes,
    hydratedForScope,
    storageScope,
    writeStorage,
    preserveStoredDraftRef,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeDraft.ready) return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.shotType, shotType);
    } catch {
      // noop
    }
  }, [
    activeDraft.ready,
    shotType,
    hydratedForScope,
    storageScope,
    writeStorage,
    preserveStoredDraftRef,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeDraft.ready) return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.voiceIds, voiceIdsInput);
    } catch {
      // noop
    }
  }, [
    activeDraft.ready,
    voiceIdsInput,
    hydratedForScope,
    storageScope,
    writeStorage,
    preserveStoredDraftRef,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!activeDraft.ready) return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.memberTier, memberTier);
    } catch {
      // noop
    }
  }, [
    activeDraft.ready,
    memberTier,
    hydratedForScope,
    storageScope,
    writeStorage,
    preserveStoredDraftRef,
  ]);

  useEffect(() => {
    if (selectedPreview || rendersLength > 0) return;
    if (effectiveRequestedEngineId || effectiveRequestedEngineToken) return;
    if (hasStoredFormRef.current) return;
    const storedPreviewJobId = (readScopedStorage(STORAGE_KEYS.previewJobId) ?? '').trim();
    if (storedPreviewJobId.startsWith('job_')) return;
    const latestJobWithMedia = recentJobs.find((job) => job.thumbUrl || job.videoUrl);
    if (!latestJobWithMedia) return;
    setSelectedPreview({
      id: latestJobWithMedia.jobId,
      videoUrl: latestJobWithMedia.videoUrl ?? undefined,
      previewVideoUrl: latestJobWithMedia.previewVideoUrl ?? undefined,
      aspectRatio: latestJobWithMedia.aspectRatio ?? undefined,
      thumbUrl: latestJobWithMedia.thumbUrl ?? undefined,
      priceCents:
        latestJobWithMedia.finalPriceCents ?? latestJobWithMedia.pricingSnapshot?.totalCents,
      currency: latestJobWithMedia.currency ?? latestJobWithMedia.pricingSnapshot?.currency,
      prompt: latestJobWithMedia.prompt ?? undefined,
    });
  }, [
    effectiveRequestedEngineId,
    effectiveRequestedEngineToken,
    fromVideoId,
    hasStoredFormRef,
    readScopedStorage,
    recentJobs,
    rendersLength,
    requestedJobId,
    selectedPreview,
    setSelectedPreview,
  ]);
  return activeDraft;
}
