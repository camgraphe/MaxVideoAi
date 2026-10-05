import {readStudioWorkspace} from './workspace-command';
import type {StudioConversationTimeline} from '@/lib/studio/conversation-editing-contract';
import type {WorkspaceProjectSettings,WorkspaceTimelineItem} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
import {secondsToTimelineFrame} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/timeline/timeline-frames';
import {buildConversationPreviewMedia} from './conversation-preview-media';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';

/** Safe edit facts shared with the OAuth adapter; no original URL, graph or access token projection. */
export function projectStudioConversationTimeline({project,sequences}: Awaited<ReturnType<typeof readStudioWorkspace>>,sequenceId?: string) {
  const active = (project.workspaceState as {activeSequenceId?: string}).activeSequenceId;
  const sequence = sequenceId ? sequences.find(value => value.id === sequenceId) : sequences.find(value => value.id === active) ?? sequences[0];
  if (!sequence) throw new Error('STUDIO_SEQUENCE_CONFLICT');
  const state = sequence.timelineState as {timelineItems: WorkspaceTimelineItem[];lockedTimelineTracks?: string[];mutedAudioTracks?: string[]};
  const settings = sequence.settings as WorkspaceProjectSettings;
  const data: StudioConversationTimeline = {
    projectId: project.id,sequenceId: sequence.id,sequenceName: sequence.name,
    updatedAt: project.updatedAt,revision: project.revision!,fps: settings.fps,
    lockedTracks: [...state.lockedTimelineTracks ?? []],
    mutedAudioTracks: [...state.mutedAudioTracks ?? []],
    clips: state.timelineItems.map(item => {
      const ref = toolAssetRefSchema.safeParse(item.ref);
      return {
        id: item.id,title: item.title,kind: item.mediaKind ?? 'video',track: item.track,
        startFrame: secondsToTimelineFrame(item.startSec,settings.fps),
        durationFrames: secondsToTimelineFrame(item.durationSec,settings.fps),
        sourceInFrame: secondsToTimelineFrame(item.sourceStartSec ?? 0,settings.fps),
        ...(item.audioMix ? {volume: item.audioMix.volume,muted: item.audioMix.muted} : {}),
        ...(ref.success ? {ref: ref.data} : {}),
      };
    }),
  };
  return {data,settings,items: state.timelineItems};
}

export async function readStudioConversationTimeline(actor: {userId: string;projectId: string},preview = false) {
  const {data,settings,items: rawItems} = projectStudioConversationTimeline(await readStudioWorkspace(actor,actor.projectId));
  if (!preview) return {data,settings,items: [] as WorkspaceTimelineItem[]};
  const items = await buildConversationPreviewMedia(actor.userId,rawItems);
  return {data,settings,items};
}
