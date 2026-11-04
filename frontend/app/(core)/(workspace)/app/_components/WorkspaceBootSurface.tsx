'use client';

import { PROMPT_ASSISTANCE_PREVIEW } from '@/lib/prompt-assistance/preview-state';
import { CompositePreviewDock } from '@/components/groups/CompositePreviewDock';
import type { VideoGroup } from '@/types/video-groups';
import { getCompositePreviewPosterSrc } from '../_lib/composite-preview';
import {
  ComposerBootSkeleton,
  EngineSettingsBootSkeleton,
  GalleryRailSkeleton,
  WorkspaceBootPreview,
} from './WorkspaceBootSkeletons';
import { WorkspaceCreationHeading } from './WorkspaceCreationHeading';
import { WorkspaceChrome } from './WorkspaceChrome';

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
          engineSettings={PROMPT_ASSISTANCE_PREVIEW ? undefined : <EngineSettingsBootSkeleton />}
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
  const railTabs = <div className="app-media-rail-switch" aria-hidden><span className="h-11 w-24 rounded-input bg-skeleton" /></div>;
  return (
    <WorkspaceChrome
      railNavigation={PROMPT_ASSISTANCE_PREVIEW ? railTabs : null}
      rail={<div className="app-media-rail">{PROMPT_ASSISTANCE_PREVIEW ? null : railTabs}<GalleryRailSkeleton responsive /></div>}
    >
      <WorkspaceCreationHeading action={<span className="h-11 w-32 rounded-input bg-skeleton" aria-hidden />} />
      <WorkspaceBootContent
        initialPreviewGroup={initialPreviewGroup}
        initialPreviewPosterSrc={initialPreviewPosterSrc}
      />
    </WorkspaceChrome>
  );
}
