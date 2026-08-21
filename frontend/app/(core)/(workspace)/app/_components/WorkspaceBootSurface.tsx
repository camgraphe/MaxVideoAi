'use client';

import dynamic from 'next/dynamic';
import type { CompositePreviewDockProps } from '@/components/groups/CompositePreviewDock';
import type { VideoGroup } from '@/types/video-groups';
import { getCompositePreviewPosterSrc } from '../_lib/composite-preview';
import {
  ComposerBootSkeleton,
  CompositePreviewDockSkeleton,
  EngineSettingsBootSkeleton,
  GalleryRailSkeleton,
  WorkspaceBootPreview,
} from './WorkspaceBootSkeletons';
import { WorkspaceChrome } from './WorkspaceChrome';

const CompositePreviewDock = dynamic<CompositePreviewDockProps>(
  () => import('@/components/groups/CompositePreviewDock').then((mod) => mod.CompositePreviewDock),
  {
    loading: () => <CompositePreviewDockSkeleton />,
  }
);

function WorkspaceBootContent({
  initialPreviewGroup,
  initialPreviewPosterSrc,
}: {
  initialPreviewGroup?: VideoGroup | null;
  initialPreviewPosterSrc?: string | null;
}) {
  const posterSrc = getCompositePreviewPosterSrc(initialPreviewGroup ?? null) ?? initialPreviewPosterSrc ?? null;

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      {initialPreviewGroup ? (
        <CompositePreviewDock
          density="workspace"
          group={initialPreviewGroup}
          isLoading={false}
          showTitle={false}
          engineSettings={<EngineSettingsBootSkeleton />}
        />
      ) : (
        <WorkspaceBootPreview posterSrc={posterSrc} />
      )}
      <ComposerBootSkeleton />
    </div>
  );
}

export function WorkspaceBootSurface({
  initialPreviewGroup,
  initialPreviewPosterSrc,
}: {
  initialPreviewGroup?: VideoGroup | null;
  initialPreviewPosterSrc?: string | null;
}) {
  return (
    <WorkspaceChrome
      rail={<GalleryRailSkeleton responsive />}
    >
      <WorkspaceBootContent
        initialPreviewGroup={initialPreviewGroup}
        initialPreviewPosterSrc={initialPreviewPosterSrc}
      />
    </WorkspaceChrome>
  );
}
