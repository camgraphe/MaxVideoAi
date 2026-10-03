import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import {getStudioTimelineInputSchema,asStudioTimelineAgentError,studioTimelineOutputSchema,studioTimelineEditOutputSchema,studioTimelineAssetRefSchema} from '@/server/agent-api/studio-timeline';
import type {AgentPrincipal} from '@/server/agent-api/principal';
import type {MaxVideoAiMcpServices} from '@/server/mcp/server';
import {runAgentTool} from '@/server/mcp/tool-result';

export const getStudioTimelineToolInputSchema = getStudioTimelineInputSchema;
// SDK transport uses v4; the adapter reparses with the canonical command owner.
const frame = z.number().int().min(0).max(5_184_000);
const clipId = z.string().trim().min(1).max(200);
export const editStudioTimelineToolInputSchema = z.object({
  projectId: getStudioTimelineInputSchema.shape.projectId,
  sequenceId: getStudioTimelineInputSchema.shape.projectId,
  expectedRevision: z.number().int().nonnegative(),idempotencyKey: z.string().min(1).max(128),
  edit: z.discriminatedUnion('kind',[
    z.object({kind: z.literal('trim'),clipId,edge: z.enum(['start','end']),durationFrames: frame.positive()}).strict(),
    z.object({kind: z.literal('move'),clipId,startFrame: frame}).strict(),
    z.object({kind: z.literal('gain'),clipId,volume: z.number().min(0).max(100)}).strict(),
    z.object({kind: z.literal('remove'),clipId}).strict(),
    z.object({kind: z.literal('insert'),ref: studioTimelineAssetRefSchema,startFrame: frame,durationFrames: frame.positive()}).strict(),
  ]),
}).strict();

export function registerStudioTimelineTools(server: McpServer,principal: AgentPrincipal,services: MaxVideoAiMcpServices): void {
  if (!services.readStudioTimeline || !services.editStudioTimeline) throw new Error('Studio timeline services are required when their gate is enabled.');
  server.registerTool('get_studio_timeline',{
    title: 'Read an editable Studio timeline',
    description: 'Read one owned connected Studio sequence and its current revision, exact frame positions, clip/ref identities, audio gain and track locks. Omit sequenceId to read the active sequence. Returns edit facts, not media content or an export. No charge.',
    inputSchema: getStudioTimelineToolInputSchema,
    outputSchema: studioTimelineOutputSchema,
    annotations: {readOnlyHint: true,destructiveHint: false,idempotentHint: true,openWorldHint: false},
  },async input=>runAgentTool(async()=>{
    try{return await services.readStudioTimeline!(input,principal);}
    catch(error){throw asStudioTimelineAgentError(error,input.projectId);}
  }));
  server.registerTool('edit_studio_timeline',{
    title: 'Edit a Studio timeline',
    description: 'Save one frame-aligned insert, trim, move, remove or audio gain edit to an owned connected Studio sequence. Use the current expectedRevision from get_studio_timeline. Use owned ready assets or account-owned completed job-output refs for insert; original media remain unchanged. Visual insertion, trimming and removal ripple; moving reorders without overlaps. Audio insertion layers on an available audible unlocked lane; gain is 0–100 percent. No generation or export charge. Reuse the exact idempotencyKey only for the exact same request; changed content requires a new key. On revision conflict, read the current timeline and preserve manual changes before adapting. Respect locked tracks; use integer frames within source duration. Audio inserts do not move existing voice or visuals.',
    inputSchema: editStudioTimelineToolInputSchema,
    outputSchema: studioTimelineEditOutputSchema,
    annotations: {readOnlyHint: false,destructiveHint: true,idempotentHint: true,openWorldHint: false},
  },async input=>runAgentTool(async()=>{
    try{return await services.editStudioTimeline!(input,principal);}
    catch(error){throw asStudioTimelineAgentError(error,input.projectId);}
  }));
}
