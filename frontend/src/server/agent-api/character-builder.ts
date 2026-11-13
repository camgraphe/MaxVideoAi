import {
  createCharacterBuilderAuthoringService,
} from '@/server/character-studio/authoring';
import type {
  CharacterBuilderAuthoringInput, CharacterBuilderConfirmationInput,
} from '@/server/character-studio/authoring-request';
import type { AgentGenerationStatus } from '@/server/generations/generation-status';
import { AgentApiError } from './errors';
import { requireOAuthGenerationActor } from './generation-actor';
import { buildGenerationResourceLinks } from './generation-status';
import type { AgentPrincipal } from './principal';
import { buildQuoteGenerationRecovery } from './quote-generation-recovery';

async function builderRecovery(status:AgentGenerationStatus|null,quoteId:string,principal:AgentPrincipal,accountUrl:string) {
  const recovery=await buildQuoteGenerationRecovery(status,quoteId,'get_character_builder_status',principal,accountUrl);
  // save_character verifies this exact stored original, not its temporary read grant.
  const original = status?.status === 'completed' && status.result?.surface === 'image'
    ? status.result.imageUrls[0] : null;
  return original && 'surface' in recovery && recovery.result?.surface === 'image'
    ? {...recovery,saveSource:{jobId:status!.jobId,imageUrl:original}}
    : recovery;
}
export function buildCharacterBuilderResourceLinks(result:Awaited<ReturnType<typeof builderRecovery>>) {
  return 'surface' in result?buildGenerationResourceLinks({...result,retry:null}):[];
}
export function createAgentCharacterBuilderService(
  principal:AgentPrincipal,
  options:{executionEnabled:boolean;accountUrl:string},
  createIntegration=createCharacterBuilderAuthoringService,
) {
  requireOAuthGenerationActor(principal);
  if (!principal.clientId) throw new AgentApiError('AUTH_REQUIRED','Connect MaxVideoAI to use Character Builder.');
  const service=createIntegration(principal,options);
  return {
    prepare:(input:CharacterBuilderAuthoringInput)=>service.prepare(input),
    async confirm(input:CharacterBuilderConfirmationInput) {
      return builderRecovery(await service.confirm(input),input.quoteId,principal,options.accountUrl);
    },
    async getQuote(input:{quoteId:string}) {
      const owned=await service.getQuote(input);
      if (!owned) throw new AgentApiError('QUOTE_EXPIRED','This Character Builder quote is unavailable in this context.');
      return {...owned,expiresAt:owned.expiresAt.toISOString()};
    },
    async recover(input:{quoteId:string}) {
      return builderRecovery(await service.recover(input),input.quoteId,principal,options.accountUrl);
    },
  };
}
export type AgentCharacterBuilderService=ReturnType<typeof createAgentCharacterBuilderService>;
