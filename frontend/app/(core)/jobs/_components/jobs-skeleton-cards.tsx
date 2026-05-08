export function renderSkeletonCards(count: number, prefix: string) {
  return Array.from({ length: count }).map((_, index) => (
    <div key={`${prefix}-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
      <div className="relative overflow-hidden rounded-card">
        <div className="relative" style={{ aspectRatio: '16 / 9' }}>
          <div className="skeleton absolute inset-0" />
        </div>
      </div>
      <div className="border-t border-border bg-surface-glass-70 px-3 py-2">
        <div className="h-3 w-24 rounded-full bg-skeleton" />
      </div>
    </div>
  ));
}
