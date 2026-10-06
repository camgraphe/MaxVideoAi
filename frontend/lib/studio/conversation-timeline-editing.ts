import {z} from 'zod';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';
import type {WorkspaceTimelineItem, WorkspaceTimelineTrack} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
import {deleteWorkspaceTimelineItem, positionWorkspaceTimelineItem, resizeWorkspaceTimelineItem, timelineEditTouchesLockedTracks} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-editing';
import {MIN_CLIP_DURATION_SEC, timelineFrameToSeconds, workspaceTimelineSourceTime} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/timeline/timeline-frames';
import {maxResizeDurationForTimelineItem} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/timeline/timeline-trim';
import {readMediaFacts} from '@/lib/media-identity';

const clipId = z.string().trim().min(1).max(200);
const frame = z.number().int().min(0).max(5_184_000);
export const conversationTimelineEditSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('trim'), clipId, edge: z.enum(['start','end']), durationFrames: frame.positive()}).strict(),
  z.object({kind: z.literal('move'), clipId, startFrame: frame}).strict(),
  // Workspace audioMix stores percentages, shared by preview and render.
  z.object({kind: z.literal('gain'), clipId, volume: z.number().min(0).max(100)}).strict(),
  z.object({kind: z.literal('remove'), clipId}).strict(),
]);
export type ConversationTimelineEdit = z.infer<typeof conversationTimelineEditSchema>;
export const conversationTimelineInsertFields={ref:toolAssetRefSchema,startFrame:frame,durationFrames:frame.positive(),sourceInFrame:frame.optional()};
export const conversationTimelineCommandSchema = z.object({
  projectId: z.string().trim().min(1).max(200), sequenceId: z.string().trim().min(1).max(200),
  expectedRevision: z.number().int().nonnegative(), idempotencyKey: z.string().min(1).max(128),
  edit: z.union([conversationTimelineEditSchema,z.object({kind:z.literal('insert'),...conversationTimelineInsertFields}).strict(),z.object({kind:z.literal('assemble'),clips:z.array(z.object(conversationTimelineInsertFields).strict()).min(1).max(12)}).strict()]),
}).strict();
export type ConversationTimelineCommand = z.infer<typeof conversationTimelineCommandSchema>;
export {workspaceTimelineSourceTime as conversationSourceTime};

/** Source-limited whole frames only; a fractional final frame cannot extend past measured bytes. */
export function conversationLibraryInsertTiming(input: {kind: 'image'|'video'|'audio';mediaFacts?: unknown;timelineDurationSec: number;fps: number}): {startFrame: number;durationFrames: number} | null {
  const {kind,timelineDurationSec,fps} = input;
  if (!Number.isInteger(fps) || fps < 1 || fps > 60 || !Number.isFinite(timelineDurationSec) || timelineDurationSec < 0) return null;
  const seconds = kind === 'image' ? 5 : readMediaFacts(input.mediaFacts)?.durationSec;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 1) return null;
  const limitedSeconds = Math.min(seconds,1800,kind === 'audio' && timelineDurationSec >= 1 ? timelineDurationSec : seconds);
  const durationFrames = Math.floor(limitedSeconds*fps);
  const startFrame = kind === 'audio' ? 0 : Math.round(timelineDurationSec*fps);
  return Number.isSafeInteger(startFrame) && startFrame <= 5_184_000 && durationFrames >= fps ? {startFrame,durationFrames} : null;
}

/** The sequence endpoint is exclusive for clips; keep its last frame in the monitor. */
export function conversationMonitorTime(playheadSec: number, durationSec: number, fps: number): number {
  return Math.min(Math.max(0, playheadSec), Math.max(0, durationSec - 1 / Math.max(1, fps)));
}

export function applyConversationTimelineEdit(items: WorkspaceTimelineItem[], rawEdit: ConversationTimelineEdit, fps: number, lockedTracks: WorkspaceTimelineTrack[]): WorkspaceTimelineItem[] {
  const edit = conversationTimelineEditSchema.parse(rawEdit);
  if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('Invalid timeline frame rate.');
  const item = items.find(candidate => candidate.id === edit.clipId);
  if (!item) throw new Error('Timeline clip not found.');
  if (lockedTracks.includes(item.track)) throw new Error('Timeline track is locked.');
  let next: WorkspaceTimelineItem[];
  switch (edit.kind) {
    case 'trim': {
      const durationSec = timelineFrameToSeconds(Math.min(edit.durationFrames,Math.floor(maxResizeDurationForTimelineItem(item,edit.edge)*fps+1e-6)), fps);
      if (durationSec < MIN_CLIP_DURATION_SEC) throw new Error('Clip duration must be at least one second.');
      next = resizeWorkspaceTimelineItem({items, itemId: item.id, edge: edit.edge, nextStartSec: item.startSec, nextDurationSec: durationSec, mode: 'ripple'});
      break;
    }
    case 'move': next = positionWorkspaceTimelineItem(items, item.id, timelineFrameToSeconds(edit.startFrame, fps)); break;
    case 'remove': next = deleteWorkspaceTimelineItem(items, item.id, {ripple: true}); break;
    case 'gain':
      if (item.mediaKind !== 'audio' && item.hasEmbeddedAudio !== true) throw new Error('This clip has no audio to mix.');
      next = items.map(candidate => candidate.id === item.id ? {...candidate, audioMix: {...candidate.audioMix, volume: edit.volume, muted: candidate.audioMix?.muted ?? false}} : candidate);
  }
  if (timelineEditTouchesLockedTracks(items, next, lockedTracks)) throw new Error('Edit would change a locked timeline track.');
  return next;
}
