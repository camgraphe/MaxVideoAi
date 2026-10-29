import {z} from 'zod';
import {conversationTimelineCommandSchema} from './conversation-timeline-editing';
export const studioTimelineReadSchema = z.object({action: z.literal('timeline.read')}).strict();
export const studioTimelineEditSchema = z.object({action: z.literal('timeline.edit'),sequenceId: conversationTimelineCommandSchema.shape.sequenceId,expectedRevision: conversationTimelineCommandSchema.shape.expectedRevision,edit: conversationTimelineCommandSchema.shape.edit}).strict();
const clipId = {type: 'string'};
const integer = {type: 'integer',minimum: 0};
const variant = (properties: Record<string,unknown>) => ({type: 'object',additionalProperties: false,properties,required: Object.keys(properties)});
const ref = {anyOf: [variant({type: {type: 'string',enum: ['asset']},assetId: {type: 'string'},kind: {type: 'string',enum: ['image','video','audio']}}),variant({type: {type: 'string',enum: ['job-output']},jobId: {type: 'string'},outputId: {type: 'string'},kind: {type: 'string',enum: ['image','video','audio']}})]};
const insertFields={ref,startFrame:integer,durationFrames:{type:'integer',minimum:1},sourceInFrame:integer};
export const STUDIO_EDITING_DIRECTOR_TOOLS = [
  {action: 'timeline.read',name: 'timeline_read',description: 'Read the active canonical sequence, exact clip/ref identities, frame rate and current project revision and per-clip audio mixing support. No charge.',properties: {}},
  {action: 'timeline.edit',name: 'timeline_edit',description: 'Apply one reversible edit to the exact sequence and revision just read. Assemble up to 12 known clips atomically in supplied list order, without analysis. For full ready clips use null startFrame/durationFrames: the server appends visuals using measured whole frames; audio starts at zero. If the original is already present, keep it and append only its continuation. sourceInFrame selects the original excerpt; zero starts at the beginning. Insert only an attached asset, an existing sequence asset or ready project output. Durations and positions are integer frames. Audio inserts layer at startFrame on a free, unlocked, unmuted audio track, preserving existing voice, music and visuals; visual inserts ripple. Trim ripples adjacent clips; move reorders without overlapping; gain is 0–100 percent. Unknown video sound supports 0 (mute) or 100 (original level) only; read audio.canMute/canRestoreOriginalVolume/canAdjustVolume without trial edits. Replace keeps the selected clip ID, start, duration and track with a sufficiently long owned source; no loop or retiming. Old source captions detach. Pin owned subtitles to a source clip or an unchanged sequence mix. No generation or export charge. On conflict, read again and preserve the manual edit.',properties: {
    sequenceId: {type: 'string'},expectedRevision: integer,
    edit: {anyOf: [
      variant({kind: {type: 'string',enum: ['trim']},clipId,edge: {type: 'string',enum: ['start','end']},durationFrames: {type: 'integer',minimum: 1}}),
      variant({kind: {type: 'string',enum: ['move']},clipId,startFrame: integer}),
      variant({kind: {type: 'string',enum: ['gain']},clipId,volume: {type: 'number',minimum: 0,maximum: 100}}),
      variant({kind: {type: 'string',enum: ['remove']},clipId}),
      variant({kind:{type:'string',enum:['replace']},clipId,ref,sourceInFrame:integer}),
      variant({kind:{type:'string',enum:['sequence-subtitles']},documentId:{type:['string','null']},revision:{type:'integer',minimum:1}}),
      variant({kind:{type:'string',enum:['subtitles']},clipId,documentId:{type:['string','null']},revision:{type:'integer',minimum:1}}),
      variant({kind: {type: 'string',enum: ['insert']},...insertFields}),
      variant({kind:{type:'string',enum:['assemble']},clips:{type:'array',minItems:1,maxItems:12,items:variant({...insertFields,startFrame:{type:['integer','null'],minimum:0,description:'Null appends visuals in list order; audio starts at zero.'},durationFrames:{type:['integer','null'],minimum:1,description:'Null uses all remaining measured whole source frames (images use five seconds).'}})}}),
    ]},
  }},
] as const;
export type StudioConversationTimeline = {projectId: string;sequenceId: string;sequenceName: string;updatedAt: string;revision: number;fps: number;aspectRatio:string;resolution:string;lockedTracks?: string[];mutedAudioTracks?: string[];clips: {id: string;title: string;kind: string;track: string;startFrame: number;durationFrames: number;sourceInFrame: number;volume?: number;muted?: boolean;audio?: import('@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-audio-provenance').WorkspaceTimelineAudioMixSupport;ref?: import('@/lib/toolbox/contract').ToolAssetRef;subtitle?:{documentId:string;revision:number}}[]};
