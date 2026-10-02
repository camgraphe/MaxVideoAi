import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {prepareStudioExportInputSchema,confirmStudioExportInputSchema,getStudioExportInputSchema,preparedStudioExportOutputSchema,confirmStudioExportOutputSchema,getStudioExportOutputSchema} from '@/server/agent-api/studio-export';
import {asStudioExportAgentError} from '@/server/studio/conversation-export-command';
import type {AgentPrincipal} from '@/server/agent-api/principal';
import type {MaxVideoAiMcpServices} from '@/server/mcp/server';
import {runAgentTool} from '@/server/mcp/tool-result';
export {prepareStudioExportInputSchema,confirmStudioExportInputSchema,getStudioExportInputSchema};

export function registerStudioExportTools(server:McpServer,principal:AgentPrincipal,services:MaxVideoAiMcpServices):void{
  if(!services.prepareStudioExport||!services.confirmStudioExport||!services.getStudioExport)throw new Error('Studio export services are required when their gate is enabled.');
  server.registerTool('prepare_studio_export',{
    title:'Prepare an exact Studio export quote',
    description:'Prepare a non-spending exact MP4 export quote from the owned saved Studio sequence at its current revision. Choose draft, standard or high quality and includeAudio. The server snapshots the saved edit; never supply a manifest, media URL or estimate token. Present the returned price and wait for explicit human approval of this exact quote before confirming. Exact retries reuse the same idempotencyKey; changed content requires a new key.',
    inputSchema:prepareStudioExportInputSchema,outputSchema:preparedStudioExportOutputSchema,
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async input=>runAgentTool(async()=>{try{return await services.prepareStudioExport!(input,principal);}catch(error){throw asStudioExportAgentError(error);}}));
  server.registerTool('confirm_studio_export',{
    title:'Confirm one quoted Studio export',
    description:'Start exactly one owned saved-cut render after explicit human approval of the exact prepare_studio_export quote. Requires projectId, scoped quoteId and confirmed=true. Exact retries recover the accepted job without another render or charge; changed or expired cuts require a fresh quote and new approval. An accepted job is not a completed film.',
    inputSchema:confirmStudioExportInputSchema,outputSchema:confirmStudioExportOutputSchema,
    annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:true},
  },async input=>runAgentTool(async()=>{try{return await services.confirmStudioExport!(input,principal);}catch(error){throw asStudioExportAgentError(error);}}));
  server.registerTool('get_studio_export',{
    title:'Read an owned Studio export',
    description:'Observe the owned render job belonging to an exact scoped projectId and quoteId. Returns null before confirmation, then saved status, progress and recorded billing. Completed artifacts receive fresh temporary read access for the OAuth host; artifactDelivery=unavailable means the film remains completed but delivery must be checked again. Never starts, retries or charges a render.',
    inputSchema:getStudioExportInputSchema,outputSchema:getStudioExportOutputSchema,
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async input=>runAgentTool(async()=>{try{return await services.getStudioExport!(input,principal);}catch(error){throw asStudioExportAgentError(error);}}));
}
