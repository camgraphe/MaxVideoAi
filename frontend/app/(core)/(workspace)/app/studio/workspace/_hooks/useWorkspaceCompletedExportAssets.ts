'use client';

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  workspaceProjectAssetFromCompletedTimelineExport,
  type WorkspaceTimelineRenderManifest,
} from '../_lib/workspace-timeline-export';
import type { WorkspaceAssetRecord } from '../_lib/workspace-types';
import type { TimelineExportClientJob } from '../_state/workspace-state';

type UseWorkspaceCompletedExportAssetsParams = {
  activeExportJob: TimelineExportClientJob | null;
  exportManifest: WorkspaceTimelineRenderManifest;
  onNotice: (message: string) => void;
  projectMediaAddedNotice: string;
  setProjectAssets: Dispatch<SetStateAction<WorkspaceAssetRecord[]>>;
  subtitleCopy: string;
};

export function useWorkspaceCompletedExportAssets({
  activeExportJob,
  exportManifest,
  onNotice,
  projectMediaAddedNotice,
  setProjectAssets,
  subtitleCopy,
}: UseWorkspaceCompletedExportAssetsParams) {
  const registeredExportAssetJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeExportJob || registeredExportAssetJobIdRef.current === activeExportJob.id) return;
    const exportAsset = workspaceProjectAssetFromCompletedTimelineExport(
      activeExportJob,
      exportManifest,
      subtitleCopy
    );
    if (!exportAsset) return;

    registeredExportAssetJobIdRef.current = activeExportJob.id;
    setProjectAssets((current) => [
      exportAsset,
      ...current.filter((asset) => asset.id !== exportAsset.id),
    ].slice(0, 120));
    onNotice(projectMediaAddedNotice.replace('{filename}', exportAsset.filename));
  }, [activeExportJob, exportManifest, onNotice, projectMediaAddedNotice, setProjectAssets, subtitleCopy]);
}
