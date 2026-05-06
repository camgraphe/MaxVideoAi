import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getJobStatus } from '@/lib/api';
import { isExpiredRefundedFailedGalleryItem } from '@/lib/gallery-retention';
import { normalizeGroupSummaries } from '@/lib/normalize-group-summary';
import { adaptGroupSummaries } from '@/lib/video-group-adapter';
import type { SelectedVideoPreview } from '@/lib/video-preview-group';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { ResultProvider, VideoGroup } from '@/types/video-groups';
import {
  isAudioWorkspaceRender,
  serializePendingRenders,
  type LocalRender,
} from '../_lib/render-persistence';
import { buildPendingRenderHydrationState } from '../_lib/workspace-hydration';
import {
  buildPendingGroupSummaries,
  buildPendingSummaryMap,
  buildRenderGroups,
  clearRemovedGroupId,
  clearSelectedPreviewForRemovedRenders,
  filterLocalRenders,
  getGenerationSkeletonCount,
  hasRemovedRenderRefs,
  isGenerationGroupLoading,
  pruneBatchHeroes,
} from '../_lib/workspace-render-groups';
import {
  applyPolledJobStatusToRender,
  applyPolledJobStatusToSelectedPreview,
  buildRecentJobIdSet,
  getRendersNeedingStatusRefresh,
  mergeRecentJobsIntoLocalRenders,
  shouldRemoveCompletedSyncedRender,
} from '../_lib/workspace-render-status';
import { STORAGE_KEYS } from '../_lib/workspace-storage';

type UseWorkspaceRenderStateOptions = {
  recentJobs: Job[];
  engineIdByLabel: ReadonlyMap<string, string>;
  provider: ResultProvider;
  storageScope: string;
  hydratedForScope: string | null;
  formIterations: number | null | undefined;
  compositeOverride: VideoGroup | null;
  compositeOverrideSummary: GroupSummary | null;
  writeScopedStorage: (base: string, value: string | null) => void;
};

type UseWorkspaceRenderStateResult = {
  renders: LocalRender[];
  setRenders: Dispatch<SetStateAction<LocalRender[]>>;
  rendersRef: MutableRefObject<LocalRender[]>;
  selectedPreview: SelectedVideoPreview | null;
  setSelectedPreview: Dispatch<SetStateAction<SelectedVideoPreview | null>>;
  activeBatchId: string | null;
  setActiveBatchId: Dispatch<SetStateAction<string | null>>;
  batchHeroes: Record<string, string>;
  setBatchHeroes: Dispatch<SetStateAction<Record<string, string>>>;
  activeGroupId: string | null;
  setActiveGroupId: Dispatch<SetStateAction<string | null>>;
  viewMode: 'single' | 'quad';
  setViewMode: Dispatch<SetStateAction<'single' | 'quad'>>;
  renderGroups: ReturnType<typeof buildRenderGroups>;
  pendingGroups: GroupSummary[];
  normalizedPendingGroups: GroupSummary[];
  pendingSummaryMap: Map<string, GroupSummary>;
  activeVideoGroups: VideoGroup[];
  activeVideoGroup: VideoGroup | null;
  isGenerationLoading: boolean;
  generationSkeletonCount: number;
  hydratePendingRendersFromStorage: (value: string | null) => void;
  resetRenderState: () => void;
};

export function useWorkspaceRenderState({
  recentJobs,
  engineIdByLabel,
  provider,
  storageScope,
  hydratedForScope,
  formIterations,
  compositeOverride,
  compositeOverrideSummary,
  writeScopedStorage,
}: UseWorkspaceRenderStateOptions): UseWorkspaceRenderStateResult {
  const [renders, setRenders] = useState<LocalRender[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<SelectedVideoPreview | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchHeroes, setBatchHeroes] = useState<Record<string, string>>({});
  const [galleryRetentionTick, setGalleryRetentionTick] = useState(0);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  const rendersRef = useRef<LocalRender[]>([]);
  const persistedRendersRef = useRef<string | null>(null);
  const pendingPollRef = useRef<number | null>(null);
  const statusErrorCountsRef = useRef<Map<string, { unauthorized: number }>>(new Map());

  const resetRenderState = useCallback(() => {
    setRenders([]);
    setBatchHeroes({});
    setActiveBatchId(null);
    setActiveGroupId(null);
  }, []);

  const hydratePendingRendersFromStorage = useCallback((value: string | null) => {
    const pendingHydration = buildPendingRenderHydrationState(value);
    if (pendingHydration.pendingRenders.length) {
      setRenders(pendingHydration.pendingRenders);
      setBatchHeroes(pendingHydration.batchHeroes);
      setActiveBatchId(pendingHydration.activeBatchId);
      setActiveGroupId(pendingHydration.activeGroupId);
    } else {
      setRenders([]);
      setBatchHeroes({});
      setActiveBatchId(null);
      setActiveGroupId(null);
    }
    persistedRendersRef.current = pendingHydration.serialized;
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setGalleryRetentionTick((current) => current + 1);
    }, 5_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    rendersRef.current = renders;
  }, [renders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    const serialized = serializePendingRenders(renders);
    if (serialized === persistedRendersRef.current) return;
    persistedRendersRef.current = serialized;
    writeScopedStorage(STORAGE_KEYS.pendingRenders, serialized);
  }, [hydratedForScope, renders, storageScope, writeScopedStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const jobsNeedingRefresh = getRendersNeedingStatusRefresh(renders);
    if (!jobsNeedingRefresh.length) {
      if (pendingPollRef.current !== null) {
        window.clearInterval(pendingPollRef.current);
        pendingPollRef.current = null;
      }
      return;
    }
    let cancelled = false;

    const poll = async () => {
      await Promise.all(
        jobsNeedingRefresh.map(async (render) => {
          if (!render.jobId) return;
          try {
            const status = await getJobStatus(render.jobId);
            statusErrorCountsRef.current.delete(render.jobId);
            if (cancelled) return;
            setRenders((prev) =>
              prev.map((item) =>
                item.jobId === render.jobId ? applyPolledJobStatusToRender(item, status) : item
              )
            );
            setSelectedPreview((cur) => applyPolledJobStatusToSelectedPreview(cur, render, status));
          } catch (error) {
            const statusCode = typeof error === 'object' && error ? (error as { status?: unknown }).status : undefined;
            if (statusCode === 404) {
              statusErrorCountsRef.current.delete(render.jobId);
              if (cancelled) return;
              setRenders((prev) => prev.filter((item) => item.jobId !== render.jobId));
              setSelectedPreview((cur) => (cur && cur.id === render.jobId ? null : cur));
              return;
            }

            if (statusCode === 401) {
              const meta = statusErrorCountsRef.current.get(render.jobId) ?? { unauthorized: 0 };
              meta.unauthorized += 1;
              statusErrorCountsRef.current.set(render.jobId, meta);
              if (meta.unauthorized >= 3) {
                statusErrorCountsRef.current.delete(render.jobId);
                if (cancelled) return;
                setRenders((prev) => prev.filter((item) => item.jobId !== render.jobId));
                setSelectedPreview((cur) => (cur && cur.id === render.jobId ? null : cur));
              }
              return;
            }

            // ignore other transient errors and retry on next tick
          }
        })
      );
    };

    void poll();
    if (pendingPollRef.current !== null) {
      window.clearInterval(pendingPollRef.current);
    }
    pendingPollRef.current = window.setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      cancelled = true;
      if (pendingPollRef.current !== null) {
        window.clearInterval(pendingPollRef.current);
        pendingPollRef.current = null;
      }
    };
  }, [renders]);

  useEffect(() => {
    if (!recentJobs.length) return;
    let heroCandidates: Array<{ batchId: string | null; localKey: string }> = [];

    setRenders((previous) => {
      if (!recentJobs.length) return previous;
      const result = mergeRecentJobsIntoLocalRenders(previous, recentJobs, { engineIdByLabel });
      heroCandidates = result.heroCandidates;
      return result.renders;
    });

    if (heroCandidates.length) {
      setBatchHeroes((previous) => {
        const next = { ...previous };
        let modified = false;
        heroCandidates.forEach(({ batchId, localKey }) => {
          if (!batchId || !localKey) return;
          if (!next[batchId]) {
            next[batchId] = localKey;
            modified = true;
          }
        });
        return modified ? next : previous;
      });
    }
  }, [engineIdByLabel, recentJobs]);

  useEffect(() => {
    const shouldRemove = (render: LocalRender) =>
      isAudioWorkspaceRender({ jobId: render.jobId, engineId: render.engineId });
    const removedRefs = filterLocalRenders(renders, shouldRemove);
    if (!hasRemovedRenderRefs(removedRefs)) {
      return;
    }

    setRenders((prev) => {
      if (prev === renders) return removedRefs.renders;
      const nextRemoval = filterLocalRenders(prev, shouldRemove);
      return nextRemoval.changed ? nextRemoval.renders : prev;
    });

    setBatchHeroes((prev) => pruneBatchHeroes(prev, removedRefs.removedGroupIds));
    setActiveBatchId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setActiveGroupId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setSelectedPreview((current) =>
      clearSelectedPreviewForRemovedRenders(current, removedRefs, { clearAudioPreview: true })
    );
  }, [renders]);

  useEffect(() => {
    if (!renders.length || !recentJobs.length) return;
    const recentJobIds = buildRecentJobIdSet(recentJobs);
    if (!recentJobIds.size) return;
    const shouldRemove = (render: LocalRender) => shouldRemoveCompletedSyncedRender(render, recentJobIds);
    const removedRefs = filterLocalRenders(renders, shouldRemove);
    if (!hasRemovedRenderRefs(removedRefs)) {
      return;
    }
    setRenders((prev) => {
      if (prev === renders) return removedRefs.renders;
      const nextRemoval = filterLocalRenders(prev, shouldRemove);
      return nextRemoval.changed ? nextRemoval.renders : prev;
    });
    setBatchHeroes((prev) => pruneBatchHeroes(prev, removedRefs.removedGroupIds));
    setActiveBatchId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setActiveGroupId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setSelectedPreview((current) => clearSelectedPreviewForRemovedRenders(current, removedRefs));
  }, [recentJobs, renders]);

  useEffect(() => {
    if (!renders.length) return;
    const now = Date.now();
    const shouldRemove = (render: LocalRender) => isExpiredRefundedFailedGalleryItem(render, now);
    const removedRefs = filterLocalRenders(renders, shouldRemove);
    if (!hasRemovedRenderRefs(removedRefs)) {
      return;
    }
    setRenders((prev) => {
      if (prev === renders) return removedRefs.renders;
      const nextRemoval = filterLocalRenders(prev, shouldRemove);
      return nextRemoval.changed ? nextRemoval.renders : prev;
    });
    setBatchHeroes((prev) => pruneBatchHeroes(prev, removedRefs.removedGroupIds));
    setActiveBatchId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setActiveGroupId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setSelectedPreview((current) => clearSelectedPreviewForRemovedRenders(current, removedRefs));
  }, [renders, galleryRetentionTick]);

  const renderGroups = useMemo(() => buildRenderGroups(renders), [renders]);
  const effectiveBatchId = useMemo(
    () => activeBatchId ?? selectedPreview?.batchId ?? null,
    [activeBatchId, selectedPreview?.batchId]
  );

  useEffect(() => {
    if (!effectiveBatchId) return;
    if (batchHeroes[effectiveBatchId]) return;
    const group = renderGroups.get(effectiveBatchId);
    if (!group || !group.items.length) return;
    setBatchHeroes((prev) => {
      if (prev[effectiveBatchId]) return prev;
      return { ...prev, [effectiveBatchId]: group.items[0].localKey };
    });
  }, [effectiveBatchId, renderGroups, batchHeroes]);

  useEffect(() => {
    const currentIterations = formIterations ?? 1;
    if (currentIterations <= 1 && viewMode !== 'single') {
      setViewMode('single');
    }
  }, [formIterations, viewMode]);

  const pendingGroups = useMemo(() => buildPendingGroupSummaries(renderGroups, batchHeroes), [renderGroups, batchHeroes]);
  const normalizedPendingGroups = useMemo(() => normalizeGroupSummaries(pendingGroups), [pendingGroups]);
  const pendingSummaryMap = useMemo(() => buildPendingSummaryMap(pendingGroups), [pendingGroups]);
  const activeVideoGroups = useMemo(() => adaptGroupSummaries(pendingGroups, provider), [pendingGroups, provider]);

  useEffect(() => {
    if (compositeOverrideSummary) {
      return;
    }
    if (!pendingGroups.length) {
      if (activeGroupId !== null) {
        setActiveGroupId(null);
      }
      return;
    }
    if (!activeGroupId || !pendingGroups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(pendingGroups[0].id);
    }
  }, [pendingGroups, activeGroupId, compositeOverrideSummary]);

  const activeVideoGroup = useMemo<VideoGroup | null>(() => {
    if (compositeOverride) return null;
    if (!activeVideoGroups.length) return null;
    if (!activeGroupId) return activeVideoGroups[0] ?? null;
    return activeVideoGroups.find((group) => group.id === activeGroupId) ?? activeVideoGroups[0] ?? null;
  }, [activeVideoGroups, activeGroupId, compositeOverride]);

  const isGenerationLoading = useMemo(() => isGenerationGroupLoading(pendingGroups), [pendingGroups]);
  const generationSkeletonCount = useMemo(
    () => getGenerationSkeletonCount(renders, formIterations),
    [renders, formIterations]
  );

  return {
    renders,
    setRenders,
    rendersRef,
    selectedPreview,
    setSelectedPreview,
    activeBatchId,
    setActiveBatchId,
    batchHeroes,
    setBatchHeroes,
    activeGroupId,
    setActiveGroupId,
    viewMode,
    setViewMode,
    renderGroups,
    pendingGroups,
    normalizedPendingGroups,
    pendingSummaryMap,
    activeVideoGroups,
    activeVideoGroup,
    isGenerationLoading,
    generationSkeletonCount,
    hydratePendingRendersFromStorage,
    resetRenderState,
  };
}
