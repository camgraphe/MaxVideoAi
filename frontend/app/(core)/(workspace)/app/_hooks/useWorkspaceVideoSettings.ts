import { hasPublishedRecreationSnapshot } from '../_lib/workspace-shared-video-snapshot';
import { buildExampleRecreationSnapshot } from '../_lib/workspace-example-recreation';
import { useWorkspaceAssetLifetime } from './useWorkspaceAssetLifetime';
import { useWorkspaceUploadOperation } from './useWorkspaceUploadOperation';
import { saveAssetToLibrary } from '@/lib/api-assets';
import { importPublicRecipeReferences, publicReferenceImportCopy, type PublicRecipeReferences } from '../_lib/workspace-public-recipe-references';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { QuadPreviewTile } from '@/components/QuadPreviewPanel';
import { authFetch } from '@/lib/authFetch';
import {
  STORYBOARD_GENERATOR_HANDOFF_STORAGE_KEY,
  parseStoryboardGeneratorHandoff,
} from '@/lib/storyboard-generator-handoff';
import {
  mapSharedVideoToGroup,
  type SelectedVideoPreview,
  type SharedVideoPreview,
} from '@/lib/video-preview-group';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { ResultProvider, VideoGroup } from '@/types/video-groups';
import {
  revokeAssetPreview,
  revokeKlingAssetPreview,
  type ReferenceAsset,
} from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import {
  createKlingElement,
  createLocalId,
  createMultiPromptScene,
  normalizeSharedVideoPayload,
} from '../_lib/workspace-input-helpers';
import { STORAGE_KEYS } from '../_lib/workspace-storage';
import {
  applyVideoJobMediaPatchToCompositeOverride,
  applyVideoJobMediaPatchToSelectedPreview,
  buildRequestedJobPreview,
  buildVideoJobMediaPatch,
  buildVideoSettingsFormState,
  buildVideoSettingsSnapshotFromSharedVideo,
  buildVideoSettingsSnapshotFromTile,
  claimSharedVideoHydration,
  resolveVideoSettingsSnapshot,
  type VideoJobPayload,
} from '../_lib/workspace-video-settings';
import { buildWorkspaceStoryboardHandoffState } from '../_lib/workspace-storyboard-handoff';
import { sharedVideoLoadFailureCopy } from '../_lib/workspace-shared-video-copy';
import { resolveRecalledWorkspaceEngine, UnavailableVideoSettingsEngineError, unavailableVideoSettingsCopy } from '../_lib/workspace-recall-engine';

type MemberTier = 'Member' | 'Plus' | 'Pro';
type ShotType = 'customize' | 'intelligent';
type SharedVideoImport = {
  sourceId: string;
  searchString: string;
  generation: () => boolean;
  videoId?: string;
};

type VideoSettingsRecall = {
  revision: string;
  awaitingCommit: boolean;
  generation: () => boolean;
  error?: string;
  cancelImport?: () => void;
};

type VideoSettingsHydrationOptions = {
  promptSuffix?: string;
  publicExample?: boolean;
  requireSnapshot?: boolean;
  publicSnapshot?: unknown;
  onSettled?: (applied: boolean) => void;
};

type UseWorkspaceVideoSettingsOptions = {
  locale?: string;
  accountScope?: string | null;
  activeDraftReady?: boolean;
  hasActiveSetup?: boolean;
  draftRevision?: string;
  initialPreviewGroup?: VideoGroup | null;
  engines: EngineCaps[];
  engineMap: Map<string, EngineCaps>;
  provider: ResultProvider;
  fromVideoId: string | null;
  requestedJobId: string | null;
  searchString: string;
  sharedVideoSettings: SharedVideoPreview | null;
  authChecked: boolean;
  hydratedForScope: string | null;
  storageScope: string;
  effectiveRequestedEngineId: string | null;
  effectiveRequestedEngineToken: string | null;
  rendersLength: number;
  compositeOverride: VideoGroup | null;
  compositeOverrideSummary: GroupSummary | null;
  focusComposer: () => void;
  readScopedStorage: (base: string) => string | null;
  writeScopedStorage: (base: string, value: string) => void;
  replaceRoute: (href: string) => void;
  setPrompt: Dispatch<SetStateAction<string>>;
  setNegativePrompt: Dispatch<SetStateAction<string>>;
  setMemberTier: Dispatch<SetStateAction<MemberTier>>;
  setCfgScale: Dispatch<SetStateAction<number | null>>;
  setShotType: Dispatch<SetStateAction<ShotType>>;
  setVoiceIdsInput: Dispatch<SetStateAction<string>>;
  setMultiPromptEnabled: Dispatch<SetStateAction<boolean>>;
  setMultiPromptScenes: Dispatch<SetStateAction<MultiPromptScene[]>>;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  setInputAssets: Dispatch<SetStateAction<Record<string, (ReferenceAsset | null)[]>>>;
  setKlingElements: Dispatch<SetStateAction<KlingElementState[]>>;
  setSelectedPreview: Dispatch<SetStateAction<SelectedVideoPreview | null>>;
  setCompositeOverride: Dispatch<SetStateAction<VideoGroup | null>>;
  setCompositeOverrideSummary: Dispatch<SetStateAction<GroupSummary | null>>;
  setSharedPrompt: Dispatch<SetStateAction<string | null>>;
  setSharedVideoSettings: Dispatch<SetStateAction<SharedVideoPreview | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
};

export function useWorkspaceVideoSettings({
  locale = 'en',
  accountScope,
  activeDraftReady = true,
  hasActiveSetup = false,
  draftRevision = '',
  initialPreviewGroup = null,
  engines,
  engineMap,
  provider,
  fromVideoId,
  requestedJobId,
  searchString,
  sharedVideoSettings,
  authChecked,
  hydratedForScope,
  storageScope,
  effectiveRequestedEngineId,
  effectiveRequestedEngineToken,
  rendersLength,
  compositeOverride,
  compositeOverrideSummary,
  focusComposer,
  readScopedStorage,
  writeScopedStorage,
  replaceRoute,
  setPrompt,
  setNegativePrompt,
  setMemberTier,
  setCfgScale,
  setShotType,
  setVoiceIdsInput,
  setMultiPromptEnabled,
  setMultiPromptScenes,
  setForm,
  setInputAssets,
  setKlingElements,
  setSelectedPreview,
  setCompositeOverride,
  setCompositeOverrideSummary,
  setSharedPrompt,
  setSharedVideoSettings,
  setNotice,
}: UseWorkspaceVideoSettingsOptions) {
  const valid = useWorkspaceAssetLifetime(accountScope);
  const beginPublicImport = useWorkspaceUploadOperation(accountScope === 'public' ? null : accountScope, valid);
  const revisionRef = useRef(draftRevision);
  revisionRef.current = draftRevision;
  const pendingRecallRef = useRef<VideoSettingsRecall | null>(null);
  const [pendingRecall, setPendingRecall] = useState<VideoSettingsRecall | null>(null);
  const [failedRecall, setFailedRecall] = useState<VideoSettingsRecall | null>(null);
  const guestPublicRecallRef = useRef<{ jobId: string; options: VideoSettingsHydrationOptions; recall: VideoSettingsRecall } | null>(null);
  const clearPublicRecallIntent = useCallback(() => {
    const retained = guestPublicRecallRef.current;
    guestPublicRecallRef.current = null;
    if (!fromVideoId && !retained) return;
    const params = new URLSearchParams(searchString);
    params.delete('from');
    const next = params.toString();
    replaceRoute(next ? `/app?${next}` : '/app');
  }, [fromVideoId, searchString, replaceRoute]);
  const recallPending = Boolean(pendingRecall && pendingRecallRef.current === pendingRecall &&
    pendingRecall.generation === valid && (pendingRecall.awaitingCommit || pendingRecall.revision === draftRevision));
  const recallFailureMessage = locale === 'fr'
    ? 'Impossible de restaurer ces réglages vidéo. Sélectionnez de nouveau la vidéo ou modifiez les réglages avant de générer.'
    : locale === 'es'
      ? 'No se pudieron restaurar estos ajustes de vídeo. Selecciona el vídeo de nuevo o cambia los ajustes antes de generar.'
      : 'Unable to restore these video settings. Select the video again or change the settings before generating.';
  const recallError = failedRecall?.generation === valid && (failedRecall.awaitingCommit || failedRecall.revision === draftRevision)
    ? failedRecall.error ?? recallFailureMessage : undefined;
  const recallBlocked = recallPending || Boolean(recallError);
  const snapshotCommitPendingRef = useRef(false);
  // The immediate complete snapshot belongs to this recall. Later edits do not.
  useLayoutEffect(() => {
    snapshotCommitPendingRef.current = false;
    for (const recall of [pendingRecallRef.current, failedRecall]) {
      if (recall?.generation === valid && recall.awaitingCommit) {
        recall.revision = draftRevision;
        recall.awaitingCommit = false;
      }
    }
  });
  useLayoutEffect(() => {
    const pending = pendingRecallRef.current;
    if (pending && (pending.generation !== valid || pending.revision !== draftRevision)) {
      // Once another edit commits, undoing it must not revive this request.
      pending.cancelImport?.();
      if (pending.generation === valid) clearPublicRecallIntent();
      pendingRecallRef.current = null;
      setPendingRecall(current => current === pending ? null : current);
    }
    if (failedRecall && (failedRecall.generation !== valid || failedRecall.revision !== draftRevision)) {
      if (failedRecall.generation === valid) clearPublicRecallIntent();
      setFailedRecall(null);
    }
  }, [valid, draftRevision, failedRecall, clearPublicRecallIntent]);
  const hydratedJobRef = useRef<string | null>(null);
  const restoredPreviewJobRef = useRef<string | null>(null);
  const appliedStoryboardHandoffRef = useRef<string | null>(null);
  const appliedSharedVideoIdRef = useRef<string | null>(null);
  const exampleRecreationRef = useRef<{ videoId: string; searchString: string } | null>(null);
  const sharedVideoImportRef = useRef<SharedVideoImport | null>(null);
  const [settledSharedImport, setSettledSharedImport] = useState<SharedVideoImport | null>(null);
  const [committingSharedImport, setCommittingSharedImport] = useState<SharedVideoImport | null>(null);
  // Keep the composer closed until this explicit import commits or fails. Startup
  // schema/settings reconciliation can then run without being mistaken for a user edit.
  const sharedVideoImportPending = Boolean(fromVideoId && (
    settledSharedImport?.sourceId !== fromVideoId ||
    settledSharedImport.searchString !== searchString ||
    settledSharedImport.generation !== valid
  ));
  const finishSharedVideoImport = useCallback((imported: SharedVideoImport, applied: boolean) => {
    if (!valid() || imported.generation !== valid || sharedVideoImportRef.current !== imported ||
      imported.sourceId !== fromVideoId || imported.searchString !== searchString) return;
    setSettledSharedImport(imported);
    if (applied) {
      const params = new URLSearchParams(imported.searchString);
      params.delete('from');
      const next = params.toString();
      replaceRoute(next ? `/app?${next}` : '/app');
    }
  }, [valid, fromVideoId, searchString, replaceRoute]);
  // Active-draft persistence runs earlier in this commit. Only now may clearing
  // `from` let ordinary draft restoration run again without restoring the old setup.
  useLayoutEffect(() => {
    if (!committingSharedImport) return;
    finishSharedVideoImport(committingSharedImport, true);
    setCommittingSharedImport(null);
  }, [committingSharedImport, finishSharedVideoImport]);
  useEffect(() => {
    if (!fromVideoId) setSettledSharedImport(null);
  }, [fromVideoId]);
  useLayoutEffect(() => {
    // A new explicit source owns subsequent writes. Clearing our completed `from`
    // param still lets that source's original job enrich its freshly imported draft.
    if (fromVideoId) {
      pendingRecallRef.current?.cancelImport?.();
      pendingRecallRef.current = null;
      guestPublicRecallRef.current = null;
    }
  }, [fromVideoId, searchString, valid]);

  const applyVideoSettingsSnapshot = useCallback(
    (snapshot: unknown, promptSuffix = '', preparedReferences?: PublicRecipeReferences) => {
      if (!valid()) return false;
      try {
        const resolved = resolveVideoSettingsSnapshot(snapshot, {
          engines,
          engineMap,
          createLocalId,
          createFallbackScene: createMultiPromptScene,
          createFallbackKlingElement: createKlingElement,
        });
        pendingRecallRef.current = null;
        setPendingRecall(null);
        setFailedRecall(null);
        snapshotCommitPendingRef.current = true;
        setPrompt(resolved.prompt + promptSuffix);
        setNegativePrompt(resolved.negativePrompt);
        if (resolved.memberTier) {
          setMemberTier(resolved.memberTier);
        }
        setCfgScale(resolved.cfgScale);
        setShotType(resolved.shotType ?? 'customize');
        setVoiceIdsInput(resolved.voiceIdsInput);
        setMultiPromptEnabled(resolved.multiPrompt.enabled);
        setMultiPromptScenes(resolved.multiPrompt.scenes);
        setForm(buildVideoSettingsFormState(resolved));

        const nextInputAssets = preparedReferences ? preparedReferences.inputAssets : resolved.inputAssets;
        if (nextInputAssets) {
          setInputAssets((previous) => {
            Object.values(previous).forEach((entries) => {
              entries.forEach((asset) => revokeAssetPreview(asset));
            });
            return nextInputAssets;
          });
        }

        const nextKlingElements = preparedReferences ? preparedReferences.klingElements : resolved.klingElements;
        if (nextKlingElements) {
          setKlingElements((previous) => {
            previous.forEach((element) => {
              revokeKlingAssetPreview(element.frontal);
              element.references.forEach((asset) => revokeKlingAssetPreview(asset));
              revokeKlingAssetPreview(element.video);
            });
            return nextKlingElements;
          });
        }

        queueMicrotask(() => {
          focusComposer();
        });
        return true;
      } catch (error) {
        setNotice(error instanceof UnavailableVideoSettingsEngineError
          ? unavailableVideoSettingsCopy(locale)
          : error instanceof Error ? error.message : 'Failed to apply settings.');
        return false;
      }
    },
    [
      valid,
      locale,
      engineMap,
      engines,
      focusComposer,
      setCfgScale,
      setForm,
      setInputAssets,
      setKlingElements,
      setMemberTier,
      setMultiPromptEnabled,
      setMultiPromptScenes,
      setNegativePrompt,
      setNotice,
      setPrompt,
      setShotType,
      setVoiceIdsInput,
    ],
  );

  const hydrateVideoSettingsFromJob = useCallback(
    async (jobId: string | null | undefined, options?: VideoSettingsHydrationOptions) => {
      if (!jobId || !valid()) return;
      pendingRecallRef.current?.cancelImport?.();
      const recall: VideoSettingsRecall = { revision: revisionRef.current, awaitingCommit: snapshotCommitPendingRef.current, generation: valid };
      pendingRecallRef.current = recall;
      setPendingRecall(options?.requireSnapshot || options?.publicExample ? recall : null);
      setFailedRecall(null);
      if (options?.publicExample && accountScope === 'public' && !options.publicSnapshot) {
        guestPublicRecallRef.current = { jobId, options, recall };
      }
      const isCurrent = () => valid() && pendingRecallRef.current === recall &&
        (recall.awaitingCommit || revisionRef.current === recall.revision);
      try {
        const response = options?.publicSnapshot ? null
          : await authFetch(`/api/${options?.publicExample ? 'videos' : 'jobs'}/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
        if (response && !response.ok) return;
        const json = options?.publicSnapshot ? { ok: true, settingsSnapshot: options.publicSnapshot }
          : await response!.json().catch(() => null);
        if (!json?.ok || !isCurrent()) return;
        let payload: VideoJobPayload;
        if (options?.publicExample && !options.publicSnapshot) {
          if (!json.video || typeof json.video.id !== 'string') return;
          // Public examples have their own safe recipe. The original job remains
          // owner-only, including when a signed-in visitor chooses a starter card.
          const video = normalizeSharedVideoPayload(json.video as SharedVideoPreview);
          payload = {
            ok: true,
            settingsSnapshot: buildVideoSettingsSnapshotFromSharedVideo(video),
            videoUrl: video.videoUrl ?? undefined,
            previewVideoUrl: video.previewVideoUrl ?? undefined,
            thumbUrl: video.thumbUrl ?? undefined,
            aspectRatio: video.aspectRatio ?? undefined,
          };
        } else {
          payload = json as VideoJobPayload;
        }
        if (payload.settingsSnapshot) {
          let references: PublicRecipeReferences | undefined;
          if (options?.publicExample) {
            const operation = beginPublicImport();
            recall.cancelImport = operation.cancel;
            try {
              const resolved = resolveVideoSettingsSnapshot(payload.settingsSnapshot, {
                engines, engineMap, createLocalId, createFallbackScene: createMultiPromptScene,
                createFallbackKlingElement: createKlingElement,
              });
              references = await importPublicRecipeReferences(resolved, accountScope === 'public' ? null
                : asset => saveAssetToLibrary({ ...asset, publicVideoId: jobId }, { fetch: operation.request }), isCurrent);
            } catch (error) {
              if (isCurrent()) recall.error = error instanceof UnavailableVideoSettingsEngineError
                ? unavailableVideoSettingsCopy(locale) : publicReferenceImportCopy(locale, accountScope === 'public');
              if (isCurrent() && accountScope === 'public' && !options.publicSnapshot
                && error instanceof Error && error.message === 'PUBLIC_REFERENCE_SIGN_IN') {
                // Preserve the already-loaded public identity across the login page.
                // Settling this URL first keeps the guest shell available without a second detail read.
                const params = new URLSearchParams(searchString);
                params.set('from', jobId);
                const retained = { sourceId: jobId, videoId: jobId, searchString: params.toString(), generation: valid };
                sharedVideoImportRef.current = retained;
                setSettledSharedImport(retained);
                replaceRoute(`/app?${retained.searchString}`);
              }
              throw error;
            } finally { operation.finish(); }
          }
          if (!isCurrent() || !applyVideoSettingsSnapshot(payload.settingsSnapshot, options?.promptSuffix, references)) return;
          guestPublicRecallRef.current = null;
          options?.onSettled?.(true);
        }

        const mediaPatch = buildVideoJobMediaPatch(payload);
        if (!mediaPatch) return;

        setSelectedPreview((current) =>
          applyVideoJobMediaPatchToSelectedPreview(current, jobId, mediaPatch),
        );
        setCompositeOverride((current) =>
          applyVideoJobMediaPatchToCompositeOverride(current, jobId, mediaPatch),
        );
      } catch {
        // Complete inline snapshots need only best-effort media enrichment.
      } finally {
        if (pendingRecallRef.current === recall) {
          if ((options?.requireSnapshot || options?.publicExample) && isCurrent()) {
            setFailedRecall(recall);
            setNotice(recall.error ?? recallFailureMessage);
            options?.onSettled?.(false);
          }
          pendingRecallRef.current = null;
          if (valid()) setPendingRecall(current => current === recall ? null : current);
        }
      }
    },
    [valid, accountScope, searchString, replaceRoute, beginPublicImport, engines, engineMap, locale, applyVideoSettingsSnapshot, recallFailureMessage, setNotice, setCompositeOverride, setSelectedPreview],
  );

  useEffect(() => {
    const selected = guestPublicRecallRef.current;
    if (!activeDraftReady || !valid() || !selected || !accountScope || accountScope === 'public'
      || selected.recall.generation === valid) return;
    guestPublicRecallRef.current = null;
    void hydrateVideoSettingsFromJob(selected.jobId, selected.options);
  }, [activeDraftReady, valid, accountScope, hydrateVideoSettingsFromJob]);

  const applyVideoSettingsFromTile = useCallback(
    (tile: QuadPreviewTile, options?: { promptSuffix?: string }) => {
      if (!valid()) return false;
      pendingRecallRef.current?.cancelImport?.();
      pendingRecallRef.current = null;
      clearPublicRecallIntent();
      setPendingRecall(null);
      setFailedRecall(null);
      try {
        // Feed metadata is a display summary, not a generation recipe. Keep the
        // last committed draft intact until detail supplies its full settings.
        if (tile.settingsSnapshot == null || tile.curated) {
          return Boolean(resolveRecalledWorkspaceEngine(tile.engineId, engines, engineMap));
        }
        return applyVideoSettingsSnapshot(buildVideoSettingsSnapshotFromTile(tile), options?.promptSuffix);
      } catch (error) {
        setNotice(error instanceof UnavailableVideoSettingsEngineError
          ? unavailableVideoSettingsCopy(locale)
          : error instanceof Error ? error.message : 'Failed to apply settings.');
        return false;
      }
    },
    [valid, engines, engineMap, locale, setNotice, applyVideoSettingsSnapshot, clearPublicRecallIntent],
  );

  useEffect(() => {
    if (!activeDraftReady || !valid()) return;
    const imported = sharedVideoImportRef.current;
    if (sharedVideoSettings && imported && (
      imported.videoId !== sharedVideoSettings.id || imported.sourceId !== fromVideoId ||
      imported.searchString !== searchString || imported.generation !== valid
    )) return;
    const recreation = exampleRecreationRef.current;
    const hydrationId = recreation && recreation.videoId === sharedVideoSettings?.id
      ? `${recreation.videoId}:${recreation.searchString}`
      : sharedVideoSettings?.id;
    const hydrationClaim = claimSharedVideoHydration(
      appliedSharedVideoIdRef.current,
      hydrationId,
      engines.length,
    );
    appliedSharedVideoIdRef.current = hydrationClaim.nextAppliedVideoId;
    if (!hydrationClaim.shouldApply || !sharedVideoSettings) return;
    if (recreation?.videoId === sharedVideoSettings.id) {
      const snapshot = buildExampleRecreationSnapshot(sharedVideoSettings, recreation.searchString, engines);
      if (snapshot) applyVideoSettingsSnapshot(snapshot);
      else setNotice(locale === 'fr'
        ? 'Cette configuration n’est plus disponible avec ce modèle. Choisissez vos réglages dans l’app.'
        : locale === 'es'
          ? 'Esta configuración ya no está disponible con este modelo. Elige los ajustes en la aplicación.'
          : 'This configuration is no longer available with this model. Choose your settings in the app.');
      // Do not hydrate the original job: it would replace the chosen model and may restore private inputs.
    } else {
      // Only the server's copied/public recipe or authored keyframe recipe contains
      // reusable references. Legacy personal settings are never imported here.
      void hydrateVideoSettingsFromJob(sharedVideoSettings.id, { publicExample: true, requireSnapshot: true,
        publicSnapshot: buildVideoSettingsSnapshotFromSharedVideo(sharedVideoSettings),
        onSettled: applied => {
          if (imported?.videoId === sharedVideoSettings.id && imported.generation === valid) {
            if (applied) setCommittingSharedImport(imported);
            else finishSharedVideoImport(imported, false); // Retain `from` for sign-in/retry.
          }
          if (applied && !hasPublishedRecreationSnapshot(sharedVideoSettings)) void hydrateVideoSettingsFromJob(sharedVideoSettings.id);
        },
      });
      return;
    }
    if (imported?.videoId === sharedVideoSettings.id && imported.generation === valid) {
      setCommittingSharedImport(imported);
    }
  }, [
    activeDraftReady,
    fromVideoId,
    searchString,
    valid,
    applyVideoSettingsSnapshot,
    engines,
    locale,
    setNotice,
    hydrateVideoSettingsFromJob,
    finishSharedVideoImport,
    sharedVideoSettings,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!searchString.includes('storyboard=1')) return;
    if (!activeDraftReady || !valid()) return;
    if (!authChecked) return;
    if (!engines.length) return;
    if (hydratedForScope !== storageScope) return;

    const storyboardHandoffKey = `${STORYBOARD_GENERATOR_HANDOFF_STORAGE_KEY}:${storageScope}`;
    const rawHandoff = window.sessionStorage.getItem(storyboardHandoffKey);
    const handoff = parseStoryboardGeneratorHandoff(rawHandoff);
    const params = new URLSearchParams(searchString);
    const stripStoryboardParam = () => {
      params.delete('storyboard');
      const next = params.toString();
      replaceRoute(next ? `/app?${next}` : '/app');
    };

    if (!handoff) {
      window.sessionStorage.removeItem(storyboardHandoffKey);
      stripStoryboardParam();
      setNotice('Storyboard handoff expired. Generate or select a storyboard again.');
      return;
    }

    const handoffKey = `${handoff.createdAt}:${handoff.engineId}:${handoff.mode}:${handoff.imageUrl ?? 'prompt-only'}`;
    if (appliedStoryboardHandoffRef.current === handoffKey) return;
    appliedStoryboardHandoffRef.current = handoffKey;

    try {
      const applied = buildWorkspaceStoryboardHandoffState(handoff, engines, null);
      setPrompt(applied.prompt);
      setNegativePrompt('');
      setVoiceIdsInput('');
      setMultiPromptEnabled(false);
      setMultiPromptScenes([createMultiPromptScene()]);
      setShotType('customize');
      setForm(applied.form);
      setInputAssets((previous) => {
        Object.values(previous).forEach((entries) => {
          entries.forEach((asset) => revokeAssetPreview(asset));
        });
        return applied.inputAssets;
      });
      setKlingElements((previous) => {
        previous.forEach((element) => {
          revokeKlingAssetPreview(element.frontal);
          element.references.forEach((asset) => revokeKlingAssetPreview(asset));
          revokeKlingAssetPreview(element.video);
        });
        return [createKlingElement()];
      });
      setSelectedPreview(null);
      setCompositeOverride(null);
      setCompositeOverrideSummary(null);
      setSharedPrompt(null);
      setSharedVideoSettings(null);
      setNotice(null);
      window.sessionStorage.removeItem(storyboardHandoffKey);
      stripStoryboardParam();
      queueMicrotask(() => {
        focusComposer();
      });
    } catch (error) {
      window.sessionStorage.removeItem(storyboardHandoffKey);
      stripStoryboardParam();
      setNotice(error instanceof Error ? error.message : 'Failed to apply storyboard settings.');
    }
  }, [
    activeDraftReady,
    valid,
    authChecked,
    engines,
    focusComposer,
    hydratedForScope,
    replaceRoute,
    searchString,
    setCompositeOverride,
    setCompositeOverrideSummary,
    setForm,
    setInputAssets,
    setKlingElements,
    setMultiPromptEnabled,
    setMultiPromptScenes,
    setNegativePrompt,
    setNotice,
    setPrompt,
    setSelectedPreview,
    setSharedPrompt,
    setSharedVideoSettings,
    setShotType,
    setVoiceIdsInput,
    storageScope,
  ]);

  useEffect(() => {
    if (!fromVideoId || !activeDraftReady || !valid()) return undefined;
    if (!sharedVideoImportPending) return undefined;
    const imported: SharedVideoImport = { sourceId: fromVideoId, searchString, generation: valid };
    sharedVideoImportRef.current = imported;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/videos/${encodeURIComponent(fromVideoId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Shared video request failed');
        const json = await res.json();
        if (cancelled || !valid()) return;
        if (!json?.ok || !json.video || typeof json.video.id !== 'string') {
          throw new Error('Shared video response unavailable');
        }
        const video = normalizeSharedVideoPayload(json.video as SharedVideoPreview);
        imported.videoId = video.id;
        // A fresh explicit choice may select the same video again after editing it.
        appliedSharedVideoIdRef.current = null;
        exampleRecreationRef.current = new URLSearchParams(searchString).get('remix') === '1'
          ? { videoId: video.id, searchString }
          : null;
        const overrideGroup = mapSharedVideoToGroup(video, provider);
        setCompositeOverride(overrideGroup);
        setCompositeOverrideSummary(null);
        setSharedPrompt(video.prompt ?? video.promptExcerpt ?? null);
        setSharedVideoSettings(video);
        setSelectedPreview({
          id: video.id,
          videoUrl: video.videoUrl ?? undefined,
          previewVideoUrl: video.previewVideoUrl ?? undefined,
          thumbUrl: video.thumbUrl ?? undefined,
          aspectRatio: video.aspectRatio ?? undefined,
          prompt: video.prompt ?? video.promptExcerpt ?? undefined,
        });
      } catch (error) {
        if (!cancelled && valid()) {
          console.warn('[app] failed to load shared video', error);
          setNotice(sharedVideoLoadFailureCopy(locale));
          finishSharedVideoImport(imported, false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeDraftReady,
    sharedVideoImportPending,
    finishSharedVideoImport,
    valid,
    fromVideoId,
    locale,
    provider,
    replaceRoute,
    searchString,
    setCompositeOverride,
    setCompositeOverrideSummary,
    setSelectedPreview,
    setSharedPrompt,
    setSharedVideoSettings,
    setNotice,
  ]);

  useEffect(() => {
    if (!compositeOverride) {
      setSharedPrompt(null);
      setSharedVideoSettings(null);
    }
  }, [compositeOverride, setSharedPrompt, setSharedVideoSettings]);

  useEffect(() => {
    if (!requestedJobId || !activeDraftReady || !valid()) return;
    const revision = revisionRef.current;
    let cancelled = false;
    if (!engines.length) return;
    if (hydratedJobRef.current === requestedJobId) return;
    hydratedJobRef.current = requestedJobId;
    setNotice(null);
    void authFetch(`/api/jobs/${encodeURIComponent(requestedJobId)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as VideoJobPayload | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? `Failed to load job (${response.status})`);
        }
        if (cancelled || !valid() || revisionRef.current !== revision) return;
        applyVideoSettingsSnapshot(payload.settingsSnapshot);

        try {
          if (requestedJobId.startsWith('job_')) {
            writeScopedStorage(STORAGE_KEYS.previewJobId, requestedJobId);
          }
        } catch {
          // ignore storage failures
        }

        const requestedPreview = buildRequestedJobPreview(requestedJobId, payload);
        if (requestedPreview) {
          setCompositeOverride(mapSharedVideoToGroup(requestedPreview.sharedVideo, provider));
          setCompositeOverrideSummary(null);
          setSelectedPreview(requestedPreview.selectedPreview);
        }
      })
      .catch((error) => {
        if (cancelled || !valid() || revisionRef.current !== revision) return;
        setNotice(error instanceof Error ? error.message : 'Failed to load job settings.');
      });
    return () => {
      cancelled = true;
      hydratedJobRef.current = null;
    };
  }, [
    applyVideoSettingsSnapshot,
    engines.length,
    provider,
    activeDraftReady,
    valid,
    requestedJobId,
    setCompositeOverride,
    setCompositeOverrideSummary,
    setNotice,
    setSelectedPreview,
    writeScopedStorage,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authChecked) return;
    if (!engines.length) return;
    if (hydratedForScope !== storageScope) return;
    if (effectiveRequestedEngineId || effectiveRequestedEngineToken) return;
    if (requestedJobId) return;
    if (fromVideoId) return;
    // The server already chose the latest render for this visit. A remembered
    // gallery selection is only a fallback when that initial preview is absent.
    if (initialPreviewGroup) return;
    if (rendersLength > 0) return;
    if (compositeOverride) return;
    if (compositeOverrideSummary) return;

    if (!activeDraftReady || !valid()) return;
    const revision = revisionRef.current;
    let cancelled = false;
    const storedJobId = (readScopedStorage(STORAGE_KEYS.previewJobId) ?? '').trim();
    if (!storedJobId.startsWith('job_')) return;
    if (restoredPreviewJobRef.current === storedJobId) return;
    restoredPreviewJobRef.current = storedJobId;

    void authFetch(`/api/jobs/${encodeURIComponent(storedJobId)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as VideoJobPayload | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? `Failed to load job (${response.status})`);
        }

        const restoredPreview = buildRequestedJobPreview(storedJobId, payload);
        if (!restoredPreview) {
          throw new Error('Job has no preview media');
        }

        if (cancelled || !valid() || revisionRef.current !== revision) return;
        if (!hasActiveSetup) applyVideoSettingsSnapshot(payload.settingsSnapshot);
        setCompositeOverride(mapSharedVideoToGroup(restoredPreview.sharedVideo, provider));
        setCompositeOverrideSummary(null);
        setSelectedPreview(restoredPreview.selectedPreview);
      })
      .catch(() => {
        // ignore preview restore failures
      });
    return () => {
      cancelled = true;
      restoredPreviewJobRef.current = null;
    };
  }, [
    applyVideoSettingsSnapshot,
    activeDraftReady,
    valid,
    hasActiveSetup,
    authChecked,
    compositeOverride,
    compositeOverrideSummary,
    effectiveRequestedEngineId,
    effectiveRequestedEngineToken,
    engines.length,
    fromVideoId,
    hydratedForScope,
    initialPreviewGroup,
    provider,
    readScopedStorage,
    rendersLength,
    requestedJobId,
    setCompositeOverride,
    setCompositeOverrideSummary,
    setSelectedPreview,
    storageScope,
  ]);

  return {
    sharedVideoImportPending,
    recallPending,
    recallBlocked,
    recallError,
    applyVideoSettingsSnapshot,
    hydrateVideoSettingsFromJob,
    applyVideoSettingsFromTile,
  };
}
