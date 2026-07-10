import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import { ImageWorkspaceGalleryRail } from './ImageWorkspaceGalleryRail';

type ImageWorkspaceGalleryRailBaseProps = {
  activeGroups: GroupSummary[];
  engineCapsList: EngineCaps[];
  isImageJob: (job: Job) => boolean;
  onOpenGroup: (group: GroupSummary) => void;
  selectedEngineCaps: EngineCaps;
};

type ImageWorkspaceShellProps = {
  children: ReactNode;
  galleryRailProps: ImageWorkspaceGalleryRailBaseProps;
  isDesktopLayout: boolean;
};

export function ImageWorkspaceShell({
  children,
  galleryRailProps,
  isDesktopLayout,
}: ImageWorkspaceShellProps) {
  return (
    <>
      <div className={clsx('flex w-full flex-1 min-w-0', isDesktopLayout ? 'flex-row' : 'flex-col')}>
        <div className="flex w-full flex-1 min-w-0 flex-col overflow-hidden">
          <main className="flex w-full flex-1 min-w-0 flex-col gap-[var(--stack-gap-lg)] p-4 sm:px-6 sm:py-4">
            {children}
          </main>
        </div>
        {isDesktopLayout ? (
          <ImageWorkspaceGalleryRail {...galleryRailProps} variant="desktop" />
        ) : null}
      </div>
      {!isDesktopLayout ? (
        <ImageWorkspaceGalleryRail {...galleryRailProps} variant="mobile" />
      ) : null}
    </>
  );
}
