'use client';

import clsx from 'clsx';
import { useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AppCreationContent } from '@/components/app/AppCreationContent';
import { recentMediaCopy } from '@/components/library/recent-media-copy';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { PROMPT_ASSISTANCE_PREVIEW } from '@/lib/prompt-assistance/preview-state';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { StarterMedia } from '@/lib/starter-media';
import { ImageWorkspaceGalleryRail } from './ImageWorkspaceGalleryRail';

type ImageWorkspaceGalleryRailBaseProps = {
  activeGroups: GroupSummary[];
  engineCapsList: EngineCaps[];
  isImageJob: (job: Job) => boolean;
  onOpenGroup: (group: GroupSummary) => void;
  selectedEngineCaps: EngineCaps;
  onSelectStarter: (item: StarterMedia) => void;
};

type ImageWorkspaceShellProps = {
  children: ReactNode;
  galleryRailProps: ImageWorkspaceGalleryRailBaseProps;
  isDesktopLayout: boolean;
  recentMedia?: ReactNode;
  onOpenRecentMedia?: () => void;
};

export function ImageWorkspaceShell({
  children,
  galleryRailProps,
  isDesktopLayout,
  recentMedia,
  onOpenRecentMedia,
}: ImageWorkspaceShellProps) {
  const [view, setView] = useState<'activity' | 'recent'>('activity');
  const activityId = useId(), recentId = useId();
  const railRef = useRef<HTMLDivElement>(null);
  const { locale } = useI18n();
  const copy = recentMediaCopy(locale);
  const navigation = <div className="app-media-rail-switch" role="group" aria-label={copy.title}>
    <button type="button" aria-pressed={view === 'activity'} aria-controls={activityId} onClick={() => setView('activity')}>{copy.activity}</button>
    <button type="button" aria-pressed={view === 'recent'} aria-controls={recentId} onClick={() => { if (view !== 'recent') onOpenRecentMedia?.(); setView('recent'); }}>{copy.title}</button>
    <Link href="/app/library" prefetch={false} className="app-media-rail-view-all">{copy.viewAll}</Link>
  </div>;
  if (PROMPT_ASSISTANCE_PREVIEW) return <AppCreationContent railNavigation={navigation}>
    <div className="flex min-w-0 flex-1 flex-col min-[768px]:flex-row">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="app-workspace-main flex min-w-0 flex-none flex-col gap-[var(--stack-gap-lg)] p-4 min-[768px]:flex-1 lg:px-7 lg:py-2">
          <div className="app-creation-heading flex items-center justify-end gap-3 md:hidden">
            {(['activity', 'recent'] as const).map(target => <button key={target} type="button" className="app-recent-mobile-open"
              aria-controls={target === 'activity' ? activityId : recentId} onClick={() => {
                if (target === 'recent' && view !== 'recent') onOpenRecentMedia?.();
                setView(target);
                requestAnimationFrame(() => {
                  railRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                  railRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });
                });
              }}>{target === 'activity' ? copy.activity : copy.title}</button>)}
          </div>
          {children}
        </main>
      </div>
      <div ref={railRef} className="app-results-rail app-image-media-rail">
        <div className="app-media-rail">
          <div className="app-image-mobile-rail-navigation">{navigation}</div>
          <div id={activityId} hidden={view !== 'activity'}>
            <ImageWorkspaceGalleryRail {...galleryRailProps} variant="responsive" />
          </div>
          <div id={recentId} hidden={view !== 'recent'} className="app-image-recent-panel">{view === 'recent' ? recentMedia : null}</div>
        </div>
      </div>
    </div>
  </AppCreationContent>;
  return (
    <AppCreationContent><div className={clsx('flex w-full flex-1 min-w-0', isDesktopLayout ? 'flex-row' : 'flex-col')}>
      <div className="flex w-full flex-1 min-w-0 flex-col overflow-hidden">
        <main className="app-workspace-main flex w-full flex-1 min-w-0 flex-col gap-[var(--stack-gap-lg)] p-4 sm:px-6 sm:py-4">
          {children}
        </main>
        {!isDesktopLayout ? (
          <ImageWorkspaceGalleryRail {...galleryRailProps} variant="mobile" />
        ) : null}
      </div>
      {isDesktopLayout ? (
        <ImageWorkspaceGalleryRail {...galleryRailProps} variant="desktop" />
      ) : null}
    </div></AppCreationContent>
  );
}
