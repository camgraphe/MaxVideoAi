import { useMemo, useState } from 'react';
import { adaptGroupSummary } from '@/lib/video-group-adapter';
import {
  mapSelectedPreviewToGroup,
  type SelectedVideoPreview,
} from '@/lib/video-preview-group';
import { normalizeGroupSummary } from '@/lib/normalize-group-summary';
import type { GroupSummary } from '@/types/groups';
import type { ResultProvider, VideoGroup } from '@/types/video-groups';
import { getCompositePreviewPosterSrc } from '../_lib/composite-preview';
import type { WorkspaceViewerTarget } from '../_components/WorkspacePreviewDock';

type UseWorkspacePreviewStateOptions = {
  provider: ResultProvider;
  selectedPreview: SelectedVideoPreview | null;
  pendingSummaryMap: Map<string, GroupSummary>;
  compositeOverride: VideoGroup | null;
  activeVideoGroup: VideoGroup | null;
  initialPreviewGroup: VideoGroup | null;
  effectiveRequestedEngineId: string | null;
  effectiveRequestedEngineToken: string | null;
  requestedJobId: string | null;
  fromVideoId: string | null;
};

export function useWorkspacePreviewState({
  provider,
  selectedPreview,
  pendingSummaryMap,
  compositeOverride,
  activeVideoGroup,
  initialPreviewGroup,
  effectiveRequestedEngineId,
  effectiveRequestedEngineToken,
  requestedJobId,
  fromVideoId,
}: UseWorkspacePreviewStateOptions) {
  const [viewerTarget, setViewerTarget] = useState<WorkspaceViewerTarget>(null);

  const compositeGroup = compositeOverride ?? activeVideoGroup ?? null;
  const selectedPreviewGroup = useMemo(
    () => mapSelectedPreviewToGroup(selectedPreview, provider),
    [selectedPreview, provider]
  );
  const initialPreviewFallbackGroup =
    effectiveRequestedEngineId || effectiveRequestedEngineToken || requestedJobId || fromVideoId
      ? null
      : initialPreviewGroup;
  const displayCompositeGroup = compositeGroup ?? selectedPreviewGroup ?? initialPreviewFallbackGroup;
  const compositePreviewPosterSrc = useMemo(
    () => getCompositePreviewPosterSrc(displayCompositeGroup),
    [displayCompositeGroup]
  );

  const viewerGroup = useMemo<VideoGroup | null>(() => {
    if (!viewerTarget) return null;
    if (viewerTarget.kind === 'pending') {
      const summary = pendingSummaryMap.get(viewerTarget.id);
      if (!summary) return null;
      return adaptGroupSummary(normalizeGroupSummary(summary), provider);
    }
    if (viewerTarget.kind === 'group') {
      return viewerTarget.group;
    }
    return adaptGroupSummary(normalizeGroupSummary(viewerTarget.summary), provider);
  }, [viewerTarget, pendingSummaryMap, provider]);

  return {
    viewerTarget,
    setViewerTarget,
    viewerGroup,
    initialPreviewFallbackGroup,
    displayCompositeGroup,
    compositePreviewPosterSrc,
  };
}
