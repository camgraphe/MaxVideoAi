import {readStudioWorkspace} from './workspace-command';
import type {StudioConversationTimeline} from '@/lib/studio/conversation-editing-contract';
import type {WorkspaceProjectSettings,WorkspaceTimelineItem} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {secondsToTimelineFrame} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-frames';
import {buildConversationPreviewMedia} from './conversation-preview-media';

export async function readStudioConversationTimeline(actor: {userId: string;projectId: string},preview = false) {
  const {project,sequences} = await readStudioWorkspace(actor,actor.projectId);
  const active = (project.workspaceState as {activeSequenceId?: string}).activeSequenceId;
  const sequence = sequences.find(value => value.id === active) ?? sequences[0];
  if (!sequence) throw new Error('STUDIO_SEQUENCE_CONFLICT');
  const state = sequence.timelineState as {timelineItems: WorkspaceTimelineItem[]};
  const settings = sequence.settings as WorkspaceProjectSettings;
  const data: StudioConversationTimeline = {projectId: project.id,sequenceId: sequence.id,sequenceName: sequence.name,updatedAt: project.updatedAt,revision: project.revision!,fps: settings.fps,clips: state.timelineItems.map(item => ({id: item.id,title: item.title,kind: item.mediaKind ?? 'video',track: item.track,startFrame: secondsToTimelineFrame(item.startSec,settings.fps),durationFrames: secondsToTimelineFrame(item.durationSec,settings.fps),sourceInFrame: secondsToTimelineFrame(item.sourceStartSec ?? 0,settings.fps),...(item.ref ? {ref: item.ref} : {})}))};
  if (!preview) return {data,settings,items: [] as WorkspaceTimelineItem[]};
  const items = await buildConversationPreviewMedia(actor.userId,state.timelineItems);
  return {data,settings,items};
}
