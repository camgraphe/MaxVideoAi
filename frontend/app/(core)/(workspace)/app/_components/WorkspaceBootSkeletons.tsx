import Image from 'next/image';
import { WorkspacePreviewColumn } from '@/components/groups/WorkspacePreviewColumn';

const COMPOSITE_PREVIEW_POSTER_SIZES = '(max-width: 1024px) 100vw, calc(100vw - 420px)';

export function CompositePreviewDockSkeleton() {
  return (
    <section className="rounded-card border border-border bg-surface-glass-90 shadow-card" aria-hidden>
      <WorkspacePreviewHeaderSkeleton />
      <div className="px-0 py-0">
        <WorkspacePreviewColumn>
          <div className="aspect-video w-full rounded-card border border-surface-on-media-25 bg-placeholder p-[8px]">
            <div className="skeleton h-full w-full rounded-card" />
          </div>
          <WorkspacePreviewToolbarSkeleton />
        </WorkspacePreviewColumn>
      </div>
    </section>
  );
}

export function GalleryRailSkeleton({ responsive = false }: { responsive?: boolean }) {
  return (
    <div
      className={
        responsive
          ? 'flex w-full flex-col gap-4 min-[1088px]:h-[calc(125vh-var(--header-height))] min-[1088px]:max-w-[312px] min-[1088px]:shrink-0 min-[1088px]:gap-0 min-[1088px]:border-l min-[1088px]:border-border min-[1088px]:bg-bg/80 min-[1088px]:px-3 min-[1088px]:pb-6 min-[1088px]:pt-4'
          : 'w-full rounded-card border border-border bg-surface-glass-60 p-3'
      }
      aria-hidden
    >
      <div className="mb-3 h-4 w-24 rounded-full bg-skeleton" />
      <div className="space-y-3">
        <div className="aspect-video rounded-card bg-skeleton" />
        <div className="aspect-video rounded-card bg-skeleton" />
      </div>
    </div>
  );
}

export function WorkspaceBootPreview({ posterSrc }: { posterSrc?: string | null }) {
  return (
    <section className="rounded-card border border-border bg-surface-glass-90 shadow-card" aria-hidden>
      <WorkspacePreviewHeaderSkeleton />
      <div className="px-0 py-0">
        <WorkspacePreviewColumn>
          <div className="relative aspect-video w-full overflow-hidden rounded-card bg-placeholder">
            {posterSrc ? (
              <Image
                src={posterSrc}
                alt=""
                fill
                priority
                sizes={COMPOSITE_PREVIEW_POSTER_SIZES}
                className="object-contain"
              />
            ) : (
              <div className="skeleton absolute inset-0" />
            )}
          </div>
          <WorkspacePreviewToolbarSkeleton />
        </WorkspacePreviewColumn>
      </div>
    </section>
  );
}

export function ComposerBootSkeleton() {
  return (
    <section
      data-composer-density="workspace"
      className="rounded-card border border-border/85 bg-surface p-3 shadow-card sm:px-4 sm:py-2"
      aria-hidden
    >
      <div className="space-y-2">
        <div className="overflow-hidden rounded-[28px] border border-border bg-surface">
          <div className="flex h-10 items-center justify-between gap-2 px-4 pb-1 pt-2">
            <div className="h-3 w-20 rounded-full bg-skeleton" />
            <div className="h-8 w-24 rounded-full bg-skeleton" />
          </div>
          <div className="min-h-[164px] px-4 pb-3 pt-2">
            <div className="h-4 w-3/4 rounded-full bg-skeleton" />
            <div className="mt-3 h-4 w-5/6 rounded-full bg-skeleton" />
            <div className="mt-3 h-4 w-2/3 rounded-full bg-skeleton" />
          </div>
          <div className="border-t border-border/65 px-3 py-1">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-center">
              <div className="flex min-w-0 flex-1 gap-2 overflow-hidden">
                <div className="h-9 w-24 shrink-0 rounded-input bg-skeleton" />
                <div className="h-9 w-24 shrink-0 rounded-input bg-skeleton" />
                <div className="h-9 w-20 shrink-0 rounded-input bg-skeleton" />
              </div>
              <div className="flex w-full items-center gap-2 lg:w-auto">
                <div className="h-10 w-16 rounded-input bg-skeleton" />
                <div className="h-10 min-w-[176px] flex-1 rounded-[24px] bg-skeleton lg:flex-none" />
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-border/65 pt-2">
          <div className="flex gap-2 overflow-hidden">
            <div className="h-9 w-28 shrink-0 rounded-input bg-skeleton" />
            <div className="h-9 w-24 shrink-0 rounded-input bg-skeleton" />
            <div className="h-9 w-32 shrink-0 rounded-input bg-skeleton" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function EngineSettingsBootSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-hidden>
      <div className="h-9 w-40 rounded-input bg-skeleton" />
      <div className="h-9 w-28 rounded-input bg-skeleton" />
      <div className="h-9 w-24 rounded-input bg-skeleton" />
    </div>
  );
}

function WorkspacePreviewHeaderSkeleton() {
  return (
    <header className="border-b border-hairline px-4 py-1">
      <EngineSettingsBootSkeleton />
    </header>
  );
}

function WorkspacePreviewToolbarSkeleton() {
  return (
    <div className="mt-1 flex w-full justify-center">
      <div className="flex w-full items-center justify-center rounded-card border border-surface-on-media-25 bg-surface-glass-80 px-3 py-0 shadow-sm">
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-9 w-9 rounded-lg bg-skeleton" />
          ))}
        </div>
      </div>
    </div>
  );
}
