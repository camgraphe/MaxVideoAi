import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { QuadPreviewTile } from '@/components/QuadPreviewPanel';
import { authFetch } from '@/lib/authFetch';
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
  resolveVideoSettingsSnapshot,
  type VideoJobPayload,
} from '../_lib/workspace-video-settings';

type MemberTier = 'Member' | 'Plus' | 'Pro';
type ShotType = 'customize' | 'intelligent';

type UseWorkspaceVideoSettingsOptions = {
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
  const hydratedJobRef = useRef<string | null>(null);
  const restoredPreviewJobRef = useRef<string | null>(null);

  const applyVideoSettingsSnapshot = useCallback(
    (snapshot: unknown) => {
      try {
        const resolved = resolveVideoSettingsSnapshot(snapshot, {
          engines,
          engineMap,
          createLocalId,
          createFallbackScene: createMultiPromptScene,
          createFallbackKlingElement: createKlingElement,
        });
        setPrompt(resolved.prompt);
        setNegativePrompt(resolved.negativePrompt);
        if (resolved.memberTier) {
          setMemberTier(resolved.memberTier);
        }
        if (resolved.cfgScale !== null) {
          setCfgScale(resolved.cfgScale);
        }
        if (resolved.shotType) {
          setShotType(resolved.shotType);
        }
        setVoiceIdsInput(resolved.voiceIdsInput);
        setMultiPromptEnabled(resolved.multiPrompt.enabled);
        setMultiPromptScenes(resolved.multiPrompt.scenes);
        setForm((current) => buildVideoSettingsFormState(resolved, current ?? null));

        const nextInputAssets = resolved.inputAssets;
        if (nextInputAssets) {
          setInputAssets((previous) => {
            Object.values(previous).forEach((entries) => {
              entries.forEach((asset) => revokeAssetPreview(asset));
            });
            return nextInputAssets;
          });
        }

        const nextKlingElements = resolved.klingElements;
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
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Failed to apply settings.');
      }
    },
    [
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
    ]
  );

  const hydrateVideoSettingsFromJob = useCallback(
    async (jobId: string | null | undefined) => {
      if (!jobId) return;
      try {
        const response = await authFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
        if (!response.ok) {
          if (response.status === 404) return;
          return;
        }
        const payload = (await response.json().catch(() => null)) as VideoJobPayload | null;
        if (!payload?.ok) return;
        if (payload.settingsSnapshot) {
          applyVideoSettingsSnapshot(payload.settingsSnapshot);
        }

        const mediaPatch = buildVideoJobMediaPatch(payload);
        if (!mediaPatch) return;

        setSelectedPreview((current) => applyVideoJobMediaPatchToSelectedPreview(current, jobId, mediaPatch));
        setCompositeOverride((current) => applyVideoJobMediaPatchToCompositeOverride(current, jobId, mediaPatch));
      } catch {
        // ignore best-effort recalls from gallery
      }
    },
    [applyVideoSettingsSnapshot, setCompositeOverride, setSelectedPreview]
  );

  const applyVideoSettingsFromTile = useCallback(
    (tile: QuadPreviewTile) => {
      try {
        applyVideoSettingsSnapshot(buildVideoSettingsSnapshotFromTile(tile));
      } catch {
        // ignore
      }
    },
    [applyVideoSettingsSnapshot]
  );

  useEffect(() => {
    if (!sharedVideoSettings) return;
    applyVideoSettingsSnapshot(buildVideoSettingsSnapshotFromSharedVideo(sharedVideoSettings));
    void hydrateVideoSettingsFromJob(sharedVideoSettings.id);
  }, [applyVideoSettingsSnapshot, hydrateVideoSettingsFromJob, sharedVideoSettings]);

  useEffect(() => {
    if (!fromVideoId) return undefined;
    let cancelled = false;
    (async () => {
      let shouldStripParam = false;
      try {
        const res = await authFetch(`/api/videos/${encodeURIComponent(fromVideoId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.ok || !json.video || cancelled) return;
        const video = normalizeSharedVideoPayload(json.video as SharedVideoPreview);
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
        shouldStripParam = true;
      } catch (error) {
        console.warn('[app] failed to load shared video', error);
      } finally {
        if (cancelled) return;
        if (shouldStripParam && searchString.includes('from=')) {
          const params = new URLSearchParams(searchString);
          params.delete('from');
          const next = params.toString();
          replaceRoute(next ? `/app?${next}` : '/app');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    fromVideoId,
    provider,
    replaceRoute,
    searchString,
    setCompositeOverride,
    setCompositeOverrideSummary,
    setSelectedPreview,
    setSharedPrompt,
    setSharedVideoSettings,
  ]);

  useEffect(() => {
    if (!compositeOverride) {
      setSharedPrompt(null);
      setSharedVideoSettings(null);
    }
  }, [compositeOverride, setSharedPrompt, setSharedVideoSettings]);

  useEffect(() => {
    if (!requestedJobId) return;
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
        setNotice(error instanceof Error ? error.message : 'Failed to load job settings.');
      });
  }, [
    applyVideoSettingsSnapshot,
    engines.length,
    provider,
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
    if (rendersLength > 0) return;
    if (compositeOverride) return;
    if (compositeOverrideSummary) return;

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

        applyVideoSettingsSnapshot(payload.settingsSnapshot);
        setCompositeOverride(mapSharedVideoToGroup(restoredPreview.sharedVideo, provider));
        setCompositeOverrideSummary(null);
        setSelectedPreview(restoredPreview.selectedPreview);
      })
      .catch(() => {
        // ignore preview restore failures
      });
  }, [
    applyVideoSettingsSnapshot,
    authChecked,
    compositeOverride,
    compositeOverrideSummary,
    effectiveRequestedEngineId,
    effectiveRequestedEngineToken,
    engines.length,
    fromVideoId,
    hydratedForScope,
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
    applyVideoSettingsSnapshot,
    hydrateVideoSettingsFromJob,
    applyVideoSettingsFromTile,
  };
}
