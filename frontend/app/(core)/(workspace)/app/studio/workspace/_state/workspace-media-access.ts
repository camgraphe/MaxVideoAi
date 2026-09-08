import type { WorkspaceAssetRecord, WorkspaceTimelineItem } from '../_lib/workspace-types';

export type StudioMediaAccess = { assetId: string; url: string; expiresAt: string | null };

export function studioMediaAssetId(value: { ref?: unknown }): string | null {
  if (!value.ref || typeof value.ref !== 'object' || Array.isArray(value.ref)) return null;
  const ref = value.ref as Record<string, unknown>;
  return ref.type === 'asset' && ref.kind === 'video' && typeof ref.assetId === 'string'
    ? ref.assetId
    : null;
}

function applyAccess<T extends { ref?: unknown; mediaAccessUrl?: string; mediaAccessExpiresAt?: string | null }>(
  value: T,
  accessById: ReadonlyMap<string, StudioMediaAccess>,
): T {
  const assetId = studioMediaAssetId(value);
  const access = assetId ? accessById.get(assetId) : undefined;
  return access ? { ...value, mediaAccessUrl: access.url, mediaAccessExpiresAt: access.expiresAt } : value;
}

export function applyStudioMediaAccess<
  TSequence extends { timelineItems: WorkspaceTimelineItem[] },
>(state: {
  projectAssets: WorkspaceAssetRecord[];
  timelineItems: WorkspaceTimelineItem[];
  sequences: TSequence[];
}, access: readonly StudioMediaAccess[]): typeof state {
  const accessById = new Map(access.map((item) => [item.assetId, item]));
  return {
    projectAssets: state.projectAssets.map((asset) => applyAccess(asset, accessById)),
    timelineItems: state.timelineItems.map((item) => applyAccess(item, accessById)),
    sequences: state.sequences.map((sequence) => ({
      ...sequence,
      timelineItems: sequence.timelineItems.map((item) => applyAccess(item, accessById)),
    })),
  };
}

export function stripStudioMediaAccess(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripStudioMediaAccess);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== 'mediaAccessUrl' && key !== 'mediaAccessExpiresAt')
    .map(([key, nested]) => [key, stripStudioMediaAccess(nested)]));
}
