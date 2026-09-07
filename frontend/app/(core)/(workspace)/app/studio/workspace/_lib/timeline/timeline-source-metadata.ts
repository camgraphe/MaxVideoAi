import type { WorkspaceTimelineItem } from '../workspace-types';

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function normalizeWorkspaceTimelineSourceMetadata(item: WorkspaceTimelineItem): WorkspaceTimelineItem {
  const measured = item.sourceMetadata?.measurementStatus === 'measured';
  if (measured) {
    return {
      ...item,
      sourceDurationSec: positiveNumber(item.sourceDurationSec),
      sourceWidth: positiveNumber(item.sourceWidth),
      sourceHeight: positiveNumber(item.sourceHeight),
      sourceMetadata: { measurementStatus: 'measured' },
    };
  }

  const requestedSettings = {
    sourceDurationSec: positiveNumber(item.requestedSettings?.sourceDurationSec) ?? positiveNumber(item.sourceDurationSec),
    sourceWidth: positiveNumber(item.requestedSettings?.sourceWidth) ?? positiveNumber(item.sourceWidth),
    sourceHeight: positiveNumber(item.requestedSettings?.sourceHeight) ?? positiveNumber(item.sourceHeight),
  };
  const hasRequestedSettings = Object.values(requestedSettings).some((value) => value !== undefined);
  return {
    ...item,
    sourceDurationSec: undefined,
    sourceWidth: undefined,
    sourceHeight: undefined,
    requestedSettings: hasRequestedSettings ? requestedSettings : item.requestedSettings,
    sourceMetadata: { measurementStatus: 'unknown' },
  };
}

export function normalizeWorkspaceTimelineItemsSourceMetadata(
  items: WorkspaceTimelineItem[]
): WorkspaceTimelineItem[] {
  return items.map(normalizeWorkspaceTimelineSourceMetadata);
}
