import {z} from 'zod';
import {conversationTimelineCommandSchema} from './conversation-timeline-editing';
export const studioTimelineReadSchema = z.object({action: z.literal('timeline.read')}).strict();
export const studioTimelineEditSchema = z.object({action: z.literal('timeline.edit'),sequenceId: conversationTimelineCommandSchema.shape.sequenceId,expectedRevision: conversationTimelineCommandSchema.shape.expectedRevision,edit: conversationTimelineCommandSchema.shape.edit}).strict();
const clipId = {type: 'string'};
const integer = {type: 'integer',minimum: 0};
const variant = (properties: Record<string,unknown>) => ({type: 'object',additionalProperties: false,properties,required: Object.keys(properties)});
const ref = {anyOf: [variant({type: {type: 'string',enum: ['asset']},assetId: {type: 'string'},kind: {type: 'string',enum: ['image','video','audio']}}),variant({type: {type: 'string',enum: ['job-output']},jobId: {type: 'string'},outputId: {type: 'string'},kind: {type: 'string',enum: ['image','video','audio']}})]};
export const STUDIO_EDITING_DIRECTOR_TOOLS = [
  {action: 'timeline.read',name: 'timeline_read',description: 'Read the active canonical sequence, exact clip/ref identities, frame rate and current project revision. No charge.',properties: {}},
  {action: 'timeline.edit',name: 'timeline_edit',description: 'Apply one reversible edit to the exact sequence and revision just read. Insert only an attached asset, an existing sequence asset or ready project output. Durations and positions are integer frames. Trim ripples adjacent clips; move reorders without overlapping; gain is 0–100 percent. No generation or export charge. On conflict, read again and preserve the manual edit.',properties: {
    sequenceId: {type: 'string'},expectedRevision: integer,
    edit: {anyOf: [
      variant({kind: {type: 'string',enum: ['trim']},clipId,edge: {type: 'string',enum: ['start','end']},durationFrames: {type: 'integer',minimum: 1}}),
      variant({kind: {type: 'string',enum: ['move']},clipId,startFrame: integer}),
      variant({kind: {type: 'string',enum: ['gain']},clipId,volume: {type: 'number',minimum: 0,maximum: 100}}),
      variant({kind: {type: 'string',enum: ['remove']},clipId}),
      variant({kind: {type: 'string',enum: ['insert']},ref,startFrame: integer,durationFrames: {type: 'integer',minimum: 1}}),
    ]},
  }},
] as const;
export type StudioConversationTimeline = {projectId: string;sequenceId: string;revision: number;fps: number;clips: {id: string;title: string;kind: string;track: string;startFrame: number;durationFrames: number;sourceInFrame: number;ref?: import('@/lib/toolbox/contract').ToolAssetRef}[]};
