import type { McpDistributionProfile } from '@/server/mcp/distribution-profile';
import { characterBuilderOutputSchemas } from '@/server/mcp/output-schemas/character-builder';
import { withToolErrorOutput } from '@/server/mcp/output-schemas/tool-errors';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildCharacterBuilderResourceLinks, type AgentCharacterBuilderService } from '@/server/agent-api/character-builder';
import { characterBuilderAuthoringInput, characterBuilderQuoteInput, characterBuilderConfirmationInput } from '@/server/character-studio/authoring-request';
import { runAgentTool, runAgentToolWithResourceLinks } from '@/server/mcp/tool-result';

const reads={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
export function registerCharacterBuilderTools(server:McpServer,service:()=>AgentCharacterBuilderService,
  options:{executionEnabled:boolean;distributionProfile?:McpDistributionProfile}):void {
  const profile=options.distributionProfile??'direct';
  if (options.executionEnabled) {
    server.registerTool('prepare_character_builder',{
    ...(profile==='openai-directory'?{outputSchema:withToolErrorOutput(characterBuilderOutputSchemas.prepare_character_builder)}:{}),
      title:'Prepare a Character Studio identity or look',
      description:'Author one private Character Builder image and prepare its exact quote without spending. Supply structured traits, outfit, scene and output settings. Unspecified fields use the current Builder defaults; custom descriptions express details outside the offered choices. Identity and style references require exact owned image asset IDs from list_media or reference import. To make a look, use the exact saved characterId; its identity traits and original are preserved while outfit, hair and scene can change. Use list_saved_characters and get_saved_character to disambiguate names. Quality and format use the same live Builder pricing as the app. Show the returned recipe, exact USD total and expiry, then obtain explicit approval before confirm_character_builder. Every changed recipe or reference requires a new quote. The result retains a real Builder recipe and can be saved on request using save_character.',
      inputSchema:characterBuilderAuthoringInput,
      annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},
    },input=>runAgentTool(()=>service().prepare(input),{profile,tool:'prepare_character_builder'}));
    server.registerTool('confirm_character_builder',{
    ...(profile==='openai-directory'?{outputSchema:withToolErrorOutput(characterBuilderOutputSchemas.confirm_character_builder)}:{}),
      title:'Confirm one exactly priced Character Builder image',
      description:'Submit one paid Character Builder image only after explicit approval of the exact fresh quote and recipe. Send its quoteId, amountCents, USD currency and confirmed=true. Do not use confirm_generation for a Builder quote. After timeout or an ambiguous response, recover the same quote using get_character_builder_status. A failure, refund or reconnect does not authorize a replacement; any further attempt needs a fresh quote and new approval. Save a completed original only when requested using save_character with the returned saveSource jobId and imageUrl, not a temporary presentation URL.',
      inputSchema:characterBuilderConfirmationInput,
      annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:true},
    },input=>runAgentToolWithResourceLinks(()=>service().confirm(input),buildCharacterBuilderResourceLinks,{profile,tool:'confirm_character_builder'}));
  }
  server.registerTool('get_character_builder_quote',{
    ...(profile==='openai-directory'?{outputSchema:withToolErrorOutput(characterBuilderOutputSchemas.get_character_builder_quote)}:{}),
    title:'Read an existing Character Builder quote and recipe',
    description:'Read the immutable Character Builder recipe, exact amount, expiry and state using its quoteId in the same account and OAuth client. This does not renew, reprice or approve the quote. Use get_character_builder_status to recover an existing submission.',
    inputSchema:characterBuilderQuoteInput,annotations:reads,
  },input=>runAgentTool(()=>service().getQuote(input),{profile,tool:'get_character_builder_quote'}));
  server.registerTool('get_character_builder_status',{
    ...(profile==='openai-directory'?{outputSchema:withToolErrorOutput(characterBuilderOutputSchemas.get_character_builder_status)}:{}),
    title:'Recover a Character Builder image by quote',
    description:'Recover the existing Character Builder job using its original quoteId after timeout, disconnect or ambiguous confirmation. Account and OAuth client scope remain enforced when execution closes. Follow retry.afterSeconds and stop automatic polling when retry is null. Deliver only completed image results. To save on request, pass saveSource.jobId and saveSource.imageUrl to save_character; presentation URLs are temporary. A missing job, failure or refund never authorizes a replacement.',
    inputSchema:characterBuilderQuoteInput,annotations:reads,
  },input=>runAgentToolWithResourceLinks(()=>service().recover(input),buildCharacterBuilderResourceLinks,{profile,tool:'get_character_builder_status'}));
}
