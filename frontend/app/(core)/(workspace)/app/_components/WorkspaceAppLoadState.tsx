'use client';

import type { VideoGroup } from '@/types/video-groups';
import { WorkspaceBootSurface } from './WorkspaceBootSurface';

type WorkspaceAppLoadStateOptions = {
  engineCount: number;
  enginesError?: Error | null;
  hasForm: boolean;
  hasSelectedEngine: boolean;
  initialPreviewFallbackGroup: VideoGroup | null;
  initialPreviewPosterSrc: string | null;
  isLoading: boolean;
  loadEnginesError: string;
  noEnginesError: string;
};

export function getWorkspaceAppLoadState({
  engineCount,
  enginesError,
  hasForm,
  hasSelectedEngine,
  initialPreviewFallbackGroup,
  initialPreviewPosterSrc,
  isLoading,
  loadEnginesError,
  noEnginesError,
}: WorkspaceAppLoadStateOptions) {
  if (isLoading && engineCount === 0) {
    return (
      <WorkspaceBootSurface
        initialPreviewGroup={initialPreviewFallbackGroup}
        initialPreviewPosterSrc={initialPreviewPosterSrc}
      />
    );
  }

  if (enginesError && engineCount === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-state-warning">
        {loadEnginesError}: {enginesError.message}
      </main>
    );
  }

  if (!hasSelectedEngine || !hasForm) {
    if (engineCount > 0) {
      return (
        <WorkspaceBootSurface
          initialPreviewGroup={initialPreviewFallbackGroup}
          initialPreviewPosterSrc={initialPreviewPosterSrc}
        />
      );
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        {noEnginesError}
      </main>
    );
  }

  return null;
}
