import { z } from 'zod';
import { toolAssetRefSchema, type ToolAssetRef } from './contract';

export const CREATOR_TOOL_IDS = ['lip-sync', 'product-photo-editor', 'product-video-editor', 'motion-transfer'] as const;
export type CreatorToolId = typeof CREATOR_TOOL_IDS[number];
export const creatorSegmentSchema = z.object({ startSec: z.number().finite().min(0), endSec: z.number().finite().positive() }).strict().refine(value => value.endSec > value.startSec, 'Segment end must follow its start.');
const input = z.object({ role: z.enum(['source', 'audio', 'style', 'motion', 'mask']), source: toolAssetRefSchema, segment: creatorSegmentSchema.optional() }).strict();
const instruction = z.string().trim().max(2000).default('');
const audioPolicy = z.enum(['preserve', 'mute']).default('preserve');
const aspectRatio = z.enum(['auto', '1:1', '4:3', '3:4', '16:9', '9:16']).default('auto');
const base = { version: z.literal(1), inputs: z.array(input).min(1).max(3), profileId: z.string().max(80).optional() };
export const creatorOperationInputSchema = z.discriminatedUnion('toolId', [
  z.object({ ...base, toolId: z.literal('product-photo-editor'), settings: z.object({ action: z.enum(['studio', 'lifestyle', 'lighting']).default('studio'), instruction, model: z.enum(['gpt-image-2-5-flare', 'nano-banana-2']).default('gpt-image-2-5-flare'), aspectRatio, preservation: z.enum(['appearance', 'pixels']).default('appearance') }).strict() }).strict(),
  z.object({ ...base, toolId: z.literal('product-video-editor'), settings: z.object({ action: z.enum(['background', 'lighting', 'style']).default('background'), instruction, audioPolicy, resolution: z.enum(['480p', '720p', '1080p']).default('720p') }).strict() }).strict(),
  z.object({ ...base, toolId: z.literal('lip-sync'), settings: z.object({ mode: z.enum(['photo', 'video']), instruction }).strict() }).strict(),
  z.object({ ...base, toolId: z.literal('motion-transfer'), settings: z.object({ orientation: z.enum(['image', 'video']).default('video'), instruction, audioPolicy, resolution: z.enum(['480p', '720p', '1080p']).default('720p') }).strict() }).strict(),
]).superRefine((block, ctx) => {
  const roles = block.inputs.map(entry => entry.role);
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (new Set(roles).size !== roles.length) issue('Choose only one input for each role.');
  const sourceKind = block.toolId === 'product-video-editor' || (block.toolId === 'lip-sync' && block.settings.mode === 'video') ? 'video' : 'image';
  if (!block.inputs.some(entry => entry.role === 'source' && entry.source.kind === sourceKind)) issue(`Choose a ${sourceKind} source.`);
  const allowed = block.toolId === 'product-photo-editor' ? ['source', 'style', 'mask'] : block.toolId === 'lip-sync' ? ['source', 'audio'] : block.toolId === 'motion-transfer' ? ['source', 'motion'] : ['source'];
  for (const entry of block.inputs) {
    if (!allowed.includes(entry.role)) issue('Input role is not supported by this tool.');
    const expected = entry.role === 'source' ? sourceKind : entry.role === 'audio' ? 'audio' : entry.role === 'motion' ? 'video' : 'image';
    if (entry.source.kind !== expected) issue(`The ${entry.role} input must be ${expected}.`);
    if (entry.segment && entry.source.kind === 'image') issue('An image cannot have a segment.');
  }
  if (block.toolId === 'lip-sync' && !roles.includes('audio')) issue('Choose an audio source.');
  if (block.toolId === 'motion-transfer' && !roles.includes('motion')) issue('Choose a performance video.');
});
export type CreatorOperationInput = z.infer<typeof creatorOperationInputSchema>;
export type CreatorSourceInput = CreatorOperationInput['inputs'][number];
export type CreatorSegment = z.infer<typeof creatorSegmentSchema>;
export type CreatorOperationResult = {
  toolId: CreatorToolId; version: 1; jobId: string; sourceAssets: ToolAssetRef[];
  outputs: Array<{ asset: ToolAssetRef; originalUrl: string; thumbnailUrl?: string | null; kind: 'image' | 'video'; durationSec?: number; audioPolicy?: 'preserve' | 'mute'; audioEncoding?: 'source' | 'aac' }>;
};
export type CreatorOperationStatus = {
  operationId: string; toolId: CreatorToolId; jobId: string | null;
  status: 'prepared' | 'running' | 'finalizing' | 'completed' | 'failed';
  result: CreatorOperationResult | null; error: string | null; retryAfterSeconds: number | null;
};
export const CREATOR_DEFAULT_SETTINGS = {
  'product-photo-editor': { action: 'studio', instruction: '', model: 'gpt-image-2-5-flare', aspectRatio: 'auto', preservation: 'appearance' },
  'product-video-editor': { action: 'background', instruction: '', audioPolicy: 'preserve', resolution: '720p' },
  'lip-sync': { mode: 'photo', instruction: '' },
  'motion-transfer': { orientation: 'video', instruction: '', audioPolicy: 'preserve', resolution: '720p' },
} as const;

/** Serializable profile facts; runtime gates are projected by the server. Prices always come from a quote. */
export type CreatorProfileDescriptor = {
  id:string;toolId:CreatorToolId;revision:1;qualification:'canonical'|'tool-specific'|'closed';disclosure:string;
  constraints:{
    sourceKinds:Array<'image'|'video'|'audio'>;
    duration?:{min:number;max:number;wholeSeconds:boolean;matchingAudioVideo?:boolean;maxByOrientation?:{image:number;video:number}};
    audioPolicies:Array<'preserve'|'mute'>;resolution:'provider'|'selectable';
    minVideoFps?:number;maxSourceBytes?:number;pixelPreservation?:boolean;acceptsInstruction?:boolean;
  };
};
export type CreatorAvailableProfile=CreatorProfileDescriptor & {deploymentGateOpen:boolean};
