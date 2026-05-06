import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GalleryFeedState } from '@/components/GalleryRail';
import type { GroupedJobAction } from '@/components/GroupedJobCard';
import type { QuadPreviewTile, QuadTileAction } from '@/components/QuadPreviewPanel';
import { normalizeGroupSummary } from '@/lib/normalize-group-summary';
import { adaptGroupSummary } from '@/lib/video-group-adapter';
import type { SelectedVideoPreview } from '@/lib/video-preview-group';
import type { GroupSummary } from '@/types/groups';
import type { ResultProvider, VideoGroup } from '@/types/video-groups';
import type { LocalRenderGroup } from '../_lib/render-persistence';
import {
  buildQuadTileFromGroupMember,
  buildQuadTileFromRender,
  haveSameGroupOrder,
} from '../_lib/workspace-render-groups';
import { emitClientMetric } from '../_lib/workspace-client-helpers';
import { STORAGE_KEYS } from '../_lib/workspace-storage';

type ViewMode = 'single' | 'quad';

type GuidedNavigation = {
  currentIndex: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
} | null;

type UseWorkspaceGalleryActionsOptions = {
  provider: ResultProvider;
  renderGroups: Map<string, LocalRenderGroup>;
  batchHeroes: Record<string, string>;
  preflightCurrency?: string | null;
  fallbackEngineId: string;
  sharedPrompt: string | null;
  selectedPreview: SelectedVideoPreview | null;
  compositeOverrideSummary: GroupSummary | null;
  applyVideoSettingsFromTile: (tile: QuadPreviewTile) => void;
  hydrateVideoSettingsFromJob: (jobId: string | null | undefined) => Promise<void>;
  focusComposer: () => void;
  showNotice: (message: string) => void;
  writeScopedStorage: (base: string, value: string | null) => void;
  setPrompt: Dispatch<SetStateAction<string>>;
  setActiveGroupId: Dispatch<SetStateAction<string | null>>;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  setActiveBatchId: Dispatch<SetStateAction<string | null>>;
  setBatchHeroes: Dispatch<SetStateAction<Record<string, string>>>;
  setSelectedPreview: Dispatch<SetStateAction<SelectedVideoPreview | null>>;
  setCompositeOverride: Dispatch<SetStateAction<VideoGroup | null>>;
  setCompositeOverrideSummary: Dispatch<SetStateAction<GroupSummary | null>>;
  setSharedPrompt: Dispatch<SetStateAction<string | null>>;
};

type UseWorkspaceGalleryActionsResult = {
  previewAutoPlayRequestId: number;
  guidedNavigation: GuidedNavigation;
  handleCopySharedPrompt: () => void;
  handleGalleryGroupAction: (
    group: GroupSummary,
    action: GroupedJobAction,
    options?: { autoPlayPreview?: boolean }
  ) => void;
  handleGalleryFeedStateChange: (state: GalleryFeedState) => void;
  openGroupViaGallery: (group: GroupSummary) => void;
  handleActiveGroupOpen: (group: GroupSummary) => void;
  handleActiveGroupAction: (group: GroupSummary, action: GroupedJobAction) => void;
};

export function useWorkspaceGalleryActions({
  provider,
  renderGroups,
  batchHeroes,
  preflightCurrency,
  fallbackEngineId,
  sharedPrompt,
  selectedPreview,
  compositeOverrideSummary,
  applyVideoSettingsFromTile,
  hydrateVideoSettingsFromJob,
  focusComposer,
  showNotice,
  writeScopedStorage,
  setPrompt,
  setActiveGroupId,
  setViewMode,
  setActiveBatchId,
  setBatchHeroes,
  setSelectedPreview,
  setCompositeOverride,
  setCompositeOverrideSummary,
  setSharedPrompt,
}: UseWorkspaceGalleryActionsOptions): UseWorkspaceGalleryActionsResult {
  const [guidedSampleFeed, setGuidedSampleFeed] = useState<GalleryFeedState>({
    visibleGroups: [],
    sampleOnly: false,
  });
  const [previewAutoPlayRequestId, setPreviewAutoPlayRequestId] = useState(0);

  const isGuidedSamplesActive = guidedSampleFeed.sampleOnly;
  const guidedSampleGroups = guidedSampleFeed.visibleGroups;

  const handleQuadTileAction = useCallback(
    (action: QuadTileAction, tile: QuadPreviewTile) => {
      emitClientMetric('tile_action', { action, batchId: tile.batchId, version: tile.iterationIndex + 1 });
      const jobId = tile.jobId ?? tile.id;
      switch (action) {
        case 'continue': {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(jobId);
          setPrompt(tile.prompt);
          focusComposer();
          break;
        }
        case 'refine': {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(jobId);
          setPrompt(`${tile.prompt}\n\n// refine here`);
          focusComposer();
          break;
        }
        case 'branch': {
          showNotice('Branching flow is coming soon in this build.');
          break;
        }
        case 'copy': {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(tile.prompt).then(
              () => showNotice('Prompt copied to clipboard'),
              () => showNotice('Unable to copy prompt, please copy manually.')
            );
          } else {
            showNotice('Clipboard not available in this context.');
          }
          break;
        }
        case 'open': {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(jobId);
          setActiveBatchId(tile.batchId);
          setViewMode('quad');
          setSelectedPreview({
            id: tile.id,
            localKey: tile.localKey,
            batchId: tile.batchId,
            iterationIndex: tile.iterationIndex,
            iterationCount: tile.iterationCount,
            videoUrl: tile.videoUrl,
            previewVideoUrl: tile.previewVideoUrl,
            aspectRatio: tile.aspectRatio,
            thumbUrl: tile.thumbUrl,
            progress: tile.progress,
            message: tile.message,
            priceCents: tile.priceCents,
            currency: tile.currency,
            etaLabel: tile.etaLabel,
            prompt: tile.prompt,
          });
          break;
        }
        default:
          break;
      }
    },
    [
      applyVideoSettingsFromTile,
      focusComposer,
      hydrateVideoSettingsFromJob,
      setActiveBatchId,
      setPrompt,
      setSelectedPreview,
      setViewMode,
      showNotice,
    ]
  );

  const handleCopySharedPrompt = useCallback(() => {
    const promptValue = sharedPrompt ?? selectedPreview?.prompt ?? null;
    if (!promptValue) {
      showNotice('No prompt available to copy.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(promptValue).then(
        () => showNotice('Prompt copied to clipboard'),
        () => showNotice('Unable to copy prompt, please copy manually.')
      );
    } else {
      showNotice('Clipboard not available in this context.');
    }
  }, [sharedPrompt, selectedPreview, showNotice]);

  const handleGalleryGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction, options?: { autoPlayPreview?: boolean }) => {
      if (action === 'remove') {
        return;
      }
      if (group.source === 'active') {
        setActiveGroupId(group.id);
        const renderGroup = renderGroups.get(group.id);
        if (!renderGroup || renderGroup.items.length === 0) return;
        const preferredHeroKey =
          batchHeroes[group.id] ?? renderGroup.items.find((item) => item.videoUrl)?.localKey ?? renderGroup.items[0]?.localKey;
        const heroRender = preferredHeroKey
          ? renderGroup.items.find((item) => item.localKey === preferredHeroKey) ?? renderGroup.items[0]
          : renderGroup.items[0];
        if (!heroRender) return;
        const heroJobId = heroRender.jobId ?? heroRender.id;
        if (action === 'compare') {
          emitClientMetric('compare_used', { batchId: group.id });
          showNotice('Compare view is coming soon.');
          return;
        }
        const tile = buildQuadTileFromRender(heroRender, renderGroup, preflightCurrency ?? 'USD');
        if (action === 'open') {
          if (options?.autoPlayPreview) {
            setPreviewAutoPlayRequestId((current) => current + 1);
          }
          handleQuadTileAction('open', tile);
          setCompositeOverride(null);
          setCompositeOverrideSummary(null);
          setSharedPrompt(null);
          return;
        }
        if (action === 'continue') {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(heroJobId);
          handleQuadTileAction('continue', tile);
          return;
        }
        if (action === 'refine') {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(heroJobId);
          handleQuadTileAction('refine', tile);
          return;
        }
        if (action === 'branch') {
          handleQuadTileAction('branch', tile);
        }
        return;
      }

      const hero = group.hero;

      if (action === 'compare') {
        emitClientMetric('compare_used', { batchId: group.id });
        showNotice('Compare view is coming soon.');
        return;
      }

      if (action === 'branch') {
        showNotice('Branching flow is coming soon in this build.');
        return;
      }

      const tile = buildQuadTileFromGroupMember(group, hero, fallbackEngineId);
      const heroJobId = hero.jobId ?? tile.id;

      if (action === 'open') {
        if (options?.autoPlayPreview) {
          setPreviewAutoPlayRequestId((current) => current + 1);
        }
        const targetBatchId = tile.batchId ?? group.batchId ?? null;
        if (tile.iterationCount > 1) {
          setViewMode('quad');
        } else {
          setViewMode('single');
        }
        if (targetBatchId) {
          setActiveBatchId(targetBatchId);
          if (tile.localKey) {
            setBatchHeroes((prev) => ({ ...prev, [targetBatchId]: tile.localKey! }));
          }
        }
        setSelectedPreview({
          id: tile.id,
          localKey: tile.localKey,
          batchId: tile.batchId,
          iterationIndex: tile.iterationIndex,
          iterationCount: tile.iterationCount,
          videoUrl: tile.videoUrl,
          previewVideoUrl: tile.previewVideoUrl,
          aspectRatio: tile.aspectRatio,
          thumbUrl: tile.thumbUrl,
          progress: tile.progress,
          message: tile.message,
          priceCents: tile.priceCents,
          currency: tile.currency,
          etaLabel: tile.etaLabel,
          prompt: tile.prompt,
        });
        const normalizedSummary = normalizeGroupSummary(group);
        setCompositeOverride(adaptGroupSummary(normalizedSummary, provider));
        setCompositeOverrideSummary(normalizedSummary);
        try {
          if (heroJobId.startsWith('job_')) {
            writeScopedStorage(STORAGE_KEYS.previewJobId, heroJobId);
          }
        } catch {
          // ignore storage failures
        }
        applyVideoSettingsFromTile(tile);
        void hydrateVideoSettingsFromJob(heroJobId);
        return;
      }

      if (action === 'continue' || action === 'refine') {
        applyVideoSettingsFromTile(tile);
        void hydrateVideoSettingsFromJob(heroJobId);
        handleQuadTileAction(action, tile);
        return;
      }
    },
    [
      renderGroups,
      batchHeroes,
      preflightCurrency,
      handleQuadTileAction,
      showNotice,
      fallbackEngineId,
      setActiveGroupId,
      setViewMode,
      setActiveBatchId,
      setBatchHeroes,
      setSelectedPreview,
      provider,
      setCompositeOverride,
      setCompositeOverrideSummary,
      applyVideoSettingsFromTile,
      hydrateVideoSettingsFromJob,
      writeScopedStorage,
      setSharedPrompt,
    ]
  );

  const handleGalleryFeedStateChange = useCallback((state: GalleryFeedState) => {
    setGuidedSampleFeed((prev) => {
      if (prev.sampleOnly === state.sampleOnly && haveSameGroupOrder(prev.visibleGroups, state.visibleGroups)) {
        return prev;
      }
      return state;
    });
  }, []);

  useEffect(() => {
    if (isGuidedSamplesActive) return;
    if (compositeOverrideSummary?.hero.job?.curated) {
      setCompositeOverride(null);
      setCompositeOverrideSummary(null);
    }
  }, [compositeOverrideSummary, isGuidedSamplesActive, setCompositeOverride, setCompositeOverrideSummary]);

  useEffect(() => {
    if (!isGuidedSamplesActive || guidedSampleGroups.length === 0) return;
    const currentGroupId = compositeOverrideSummary?.id ?? null;
    if (currentGroupId && guidedSampleGroups.some((group) => group.id === currentGroupId)) {
      return;
    }
    handleGalleryGroupAction(guidedSampleGroups[0], 'open');
  }, [compositeOverrideSummary?.id, guidedSampleGroups, handleGalleryGroupAction, isGuidedSamplesActive]);

  const currentGuidedSampleIndex = useMemo(() => {
    if (!isGuidedSamplesActive || guidedSampleGroups.length === 0) return -1;
    const currentGroupId = compositeOverrideSummary?.id ?? null;
    if (!currentGroupId) return -1;
    return guidedSampleGroups.findIndex((group) => group.id === currentGroupId);
  }, [compositeOverrideSummary?.id, guidedSampleGroups, isGuidedSamplesActive]);

  const openGuidedSampleAt = useCallback(
    (index: number) => {
      const target = guidedSampleGroups[index];
      if (!target) return;
      handleGalleryGroupAction(target, 'open', { autoPlayPreview: true });
    },
    [guidedSampleGroups, handleGalleryGroupAction]
  );

  const guidedNavigation = useMemo(() => {
    if (!isGuidedSamplesActive || guidedSampleGroups.length === 0) return null;
    const activeIndex = currentGuidedSampleIndex >= 0 ? currentGuidedSampleIndex : 0;
    return {
      currentIndex: activeIndex,
      total: guidedSampleGroups.length,
      canPrev: activeIndex > 0,
      canNext: activeIndex < guidedSampleGroups.length - 1,
      onPrev: () => openGuidedSampleAt(activeIndex - 1),
      onNext: () => openGuidedSampleAt(activeIndex + 1),
    };
  }, [currentGuidedSampleIndex, guidedSampleGroups, isGuidedSamplesActive, openGuidedSampleAt]);

  const openGroupViaGallery = useCallback(
    (group: GroupSummary) => {
      handleGalleryGroupAction(group, 'open', { autoPlayPreview: true });
    },
    [handleGalleryGroupAction]
  );

  const handleActiveGroupOpen = useCallback(
    (group: GroupSummary) => {
      handleGalleryGroupAction(group, 'open', { autoPlayPreview: true });
    },
    [handleGalleryGroupAction]
  );

  const handleActiveGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      if (action === 'remove') return;
      handleGalleryGroupAction(group, action, { autoPlayPreview: action === 'open' });
    },
    [handleGalleryGroupAction]
  );

  return {
    previewAutoPlayRequestId,
    guidedNavigation,
    handleCopySharedPrompt,
    handleGalleryGroupAction,
    handleGalleryFeedStateChange,
    openGroupViaGallery,
    handleActiveGroupOpen,
    handleActiveGroupAction,
  };
}
