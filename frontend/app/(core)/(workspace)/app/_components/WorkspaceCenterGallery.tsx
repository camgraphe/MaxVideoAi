import { GroupedJobCard } from '@/components/GroupedJobCard';
import type { GroupedJobAction } from '@/components/GroupedJobCard';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';

export function WorkspaceCenterGallery({
  show,
  groups,
  engineMap,
  isGenerationLoading,
  generationSkeletonCount,
  emptyLabel,
  onOpenGroup,
  onGroupAction,
}: {
  show: boolean;
  groups: GroupSummary[];
  engineMap: ReadonlyMap<string, EngineCaps>;
  isGenerationLoading: boolean;
  generationSkeletonCount: number;
  emptyLabel: string;
  onOpenGroup: (group: GroupSummary) => void;
  onGroupAction: (group: GroupSummary, action: GroupedJobAction) => void;
}) {
  if (!show) return null;

  if (groups.length === 0 && !isGenerationLoading) {
    return (
      <div className="rounded-card border border-border bg-surface-glass-80 p-5 text-center text-sm text-text-secondary">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid grid-gap-sm sm:grid-cols-2">
      {groups.map((group, index) => {
        const engineId = group.hero.engineId;
        const engine = engineId ? engineMap.get(engineId) ?? null : null;
        return (
          <GroupedJobCard
            key={group.id}
            group={group}
            engine={engine ?? undefined}
            onOpen={onOpenGroup}
            onAction={onGroupAction}
            allowRemove={false}
            eagerPreview={index === 0}
          />
        );
      })}
      {isGenerationLoading &&
        Array.from({ length: groups.length ? 0 : generationSkeletonCount }).map((_, index) => (
          <div
            key={`workspace-gallery-skeleton-${index}`}
            className="rounded-card border border-border bg-surface-glass-60 p-0"
            aria-hidden
          >
            <div className="relative overflow-hidden rounded-card">
              <div className="relative" style={{ aspectRatio: '16 / 9' }}>
                <div className="skeleton absolute inset-0" />
              </div>
            </div>
            <div className="border-t border-border bg-surface-glass-70 px-3 py-2">
              <div className="h-3 w-24 rounded-full bg-skeleton" />
            </div>
          </div>
        ))}
    </div>
  );
}
