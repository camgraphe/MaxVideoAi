'use client';

import { lazy, startTransition, Suspense, useEffect, useState } from 'react';
import type { VideoGroup } from '@/types/video-groups';
import { WorkspaceBootSurface } from './_components/WorkspaceBootSurface';
import { useWorkspaceAppBootstrap } from './_hooks/useWorkspaceAppBootstrap';

const AppClient = lazy(() => import('./AppClient'));

export type WorkspaceEntryProps = {
  initialPreviewGroup?: VideoGroup | null;
  localSeedanceDraftPreview?: boolean;
  seedanceDraftWorkflowEnabled?: boolean;
};

export default function WorkspaceEntry(props: WorkspaceEntryProps) {
  // Auth-scoped catalog and history requests can start while the editor chunk loads.
  const app = useWorkspaceAppBootstrap();
  const [loadEditor, setLoadEditor] = useState(false);
  useEffect(() => {
    // The server already rendered this reader. Keep it visible and playable while the editor loads.
    startTransition(() => setLoadEditor(true));
  }, []);
  const boot = <WorkspaceBootSurface initialPreviewGroup={props.initialPreviewGroup} />;
  if (!loadEditor) return boot;
  return (
    <Suspense fallback={boot}>
      <AppClient {...props} app={app} />
    </Suspense>
  );
}
