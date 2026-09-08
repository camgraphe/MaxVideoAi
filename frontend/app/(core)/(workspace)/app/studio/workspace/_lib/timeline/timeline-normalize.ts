import { isWorkspaceTimelineVideoTrack } from '../workspace-timeline-tracks';
import type { WorkspaceTimelineItem } from '../workspace-types';
import { shouldMirrorLinkedVideo } from './timeline-linked-audio';

export function normalizeWorkspaceTimelineStarts(items: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
  const tracks = Array.from(new Set(items.filter((item) => !shouldMirrorLinkedVideo(item, items)).map((item) => item.track)));
  const normalizedById = new Map<string, WorkspaceTimelineItem>();

  tracks.forEach((track) => {
    let startSec = 0;
    items
      .filter((item) => item.track === track && !shouldMirrorLinkedVideo(item, items))
      .forEach((item) => {
        normalizedById.set(item.id, { ...item, startSec });
        startSec += item.durationSec;
      });
  });

  items
    .filter((item) => shouldMirrorLinkedVideo(item, items))
    .forEach((item) => {
      const videoItem = items.find((candidate) => candidate.linkedGroupId === item.linkedGroupId && isWorkspaceTimelineVideoTrack(candidate.track));
      const normalizedVideoItem = videoItem ? normalizedById.get(videoItem.id) ?? videoItem : null;
      normalizedById.set(item.id, {
        ...item,
        startSec: normalizedVideoItem?.startSec ?? item.startSec,
        durationSec: normalizedVideoItem?.durationSec ?? item.durationSec,
        sourceStartSec: normalizedVideoItem?.sourceStartSec ?? item.sourceStartSec,
        sourceDurationSec: normalizedVideoItem?.sourceDurationSec ?? item.sourceDurationSec,
      });
    });

  return items.map((item) => normalizedById.get(item.id) ?? item);
}
