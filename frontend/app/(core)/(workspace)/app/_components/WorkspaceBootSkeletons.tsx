import Image from 'next/image';

const COMPOSITE_PREVIEW_POSTER_SIZES = '(max-width: 1024px) 100vw, calc(100vw - 420px)';

export function CompositePreviewDockSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface-glass-60 p-4" aria-hidden>
      <div className="mx-auto aspect-video w-full max-w-[760px] overflow-hidden rounded-card bg-skeleton" />
      <div className="mx-auto mt-3 flex w-full max-w-[760px] gap-2">
        <div className="h-8 w-32 rounded-full bg-skeleton" />
        <div className="h-8 w-24 rounded-full bg-skeleton" />
      </div>
    </div>
  );
}

export function GalleryRailSkeleton() {
  return (
    <div className="w-full rounded-card border border-border bg-surface-glass-60 p-3" aria-hidden>
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
      <div className="border-b border-hairline px-4 py-3">
        <div className="h-9 w-full max-w-[520px] rounded-full bg-skeleton" />
      </div>
      <div className="px-4 py-4">
        <div className="relative mx-auto aspect-video w-full max-w-[960px] overflow-hidden rounded-card bg-placeholder">
          {posterSrc ? (
            <Image
              src={posterSrc}
              alt=""
              fill
              priority
              sizes={COMPOSITE_PREVIEW_POSTER_SIZES}
              className="object-cover"
            />
          ) : (
            <div className="skeleton absolute inset-0" />
          )}
        </div>
        <div className="mx-auto mt-3 flex w-full max-w-[760px] gap-2">
          <div className="h-8 w-32 rounded-full bg-skeleton" />
          <div className="h-8 w-24 rounded-full bg-skeleton" />
        </div>
      </div>
    </section>
  );
}

export function ComposerBootSkeleton() {
  return (
    <section className="rounded-card border border-border bg-surface-glass-80 p-4 shadow-card" aria-hidden>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="h-4 w-36 rounded-full bg-skeleton" />
        <div className="h-8 w-28 rounded-full bg-skeleton" />
      </div>
      <div className="min-h-[156px] rounded-card border border-hairline bg-surface-2 p-4">
        <div className="h-4 w-3/4 rounded-full bg-skeleton" />
        <div className="mt-3 h-4 w-5/6 rounded-full bg-skeleton" />
        <div className="mt-3 h-4 w-2/3 rounded-full bg-skeleton" />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-input bg-skeleton" />
          <div className="h-9 w-24 rounded-input bg-skeleton" />
        </div>
        <div className="h-11 w-36 rounded-input bg-skeleton" />
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
